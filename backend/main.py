import os
import joblib
import pandas as pd
import asyncio
import random
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai

# --- SQLALCHEMY IMPORTS ---
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base

# ==========================================
# 1. AI Configuration
# ==========================================
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('models/gemini-2.5-flash')

# ==========================================
# 2. Server Setup
# ==========================================
app = FastAPI(title="AgriVolt AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 3. SQLite Database Setup
# ==========================================
SQLALCHEMY_DATABASE_URL = "sqlite:////data/agrivolt.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Existing B2B Table
class PartnershipDB(Base):
    __tablename__ = "partnerships"
    
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, index=True)
    contact_person = Column(String)
    email = Column(String)
    solar_acreage = Column(String)

# NEW: Telemetry History Table
class TelemetryLogDB(Base):
    __tablename__ = "telemetry_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(String, index=True)
    temperature_c = Column(Float)
    soil_moisture = Column(Float)
    shading_percent = Column(Float)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# 4. Load the Trained Machine Learning Model
# ==========================================
try:
    ml_model = joblib.load("backend/yield_model.joblib")
    print("Machine Learning model loaded successfully!")
except Exception as e:
    ml_model = None
    print(f"Warning: ML model not found. {e}")

# ==========================================
# 5. Data Structure Definitions (Pydantic)
# ==========================================
class FarmData(BaseModel):
    crop_type: str
    shading_percent: float
    temperature_c: float
    soil_moisture: float
    user_message: Optional[str] = ""

class PartnershipRequest(BaseModel):
    Company_Name: str
    Contact_Person: str
    Email: str
    Solar_Acreage: str


# ==========================================
# 6. NEW: WebSocket Manager & Background Task
# ==========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

async def mock_iot_data_generator():
    """Background task to simulate physical IoT hardware feeding data every 90 seconds."""
    while True:
        await asyncio.sleep(90) 
        
        # 1. Generate realistic fluctuating numbers
        mock_data = {
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "temperature_c": round(random.uniform(28.0, 32.5), 1),
            "soil_moisture": round(random.uniform(55.0, 75.0), 1),
            "shading_percent": round(random.uniform(20.0, 40.0), 1)
        }
        
        # 2. Save directly to SQLite (Needs its own session away from active routes)
        db = SessionLocal()
        try:
            new_log = TelemetryLogDB(**mock_data)
            db.add(new_log)
            db.commit()
        finally:
            db.close()
            
        # 3. Push live data to any connected frontend dashboard
        await manager.broadcast(mock_data)

# Start the background data generator when the server boots up
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(mock_iot_data_generator())


# ==========================================
# ENDPOINT 1: WebSocket Live Telemetry Feed
# ==========================================
@app.websocket("/ws/live-telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We just need to keep the connection open. The server pushes data automatically.
            await websocket.receive_text() 
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ==========================================
# ENDPOINT 2: Get Telemetry History Log
# ==========================================
@app.get("/api/telemetry/history")
async def get_telemetry_history(limit: int = 15, db: Session = Depends(get_db)):
    """Fetches the most recent database entries for the frontend dropdown bridge."""
    try:
        # Fetch the newest 'limit' entries, descending order
        logs = db.query(TelemetryLogDB).order_by(TelemetryLogDB.id.desc()).limit(limit).all()
        return {"status": "success", "data": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database read error: {str(e)}")

# ==========================================
# ENDPOINT 3: Machine Learning Yield Predictor
# ==========================================
@app.post("/api/predict")
async def predict_yield(data: FarmData):
    if not ml_model:
        return {"error": "Model not loaded on server."}
    
    try:
        input_df = pd.DataFrame([{
            'crop_type': data.crop_type,
            'shading_percent': data.shading_percent,
            'temperature_c': data.temperature_c,
            'soil_moisture': data.soil_moisture
        }])
        
        predicted_yield = ml_model.predict(input_df)[0]
        return {"yield_kg_m2": round(predicted_yield, 2)}
        
    except Exception as e:
        return {"error": str(e)}

# ==========================================
# ENDPOINT 4: Gemini Agronomist AI Core
# ==========================================
@app.post("/api/chat")
async def chat_with_agronomist(data: FarmData):
    system_prompt = f"""
    You are the AgriVolt AI Agronomist, an expert in agrivoltaics and crop microclimates.
    
    Current Farm Context:
    - Crop: {data.crop_type}
    - Solar Panel Shading: {data.shading_percent}%
    - Ambient Temperature: {data.temperature_c}°C
    - Soil Moisture: {data.soil_moisture}%
    
    The farmer is asking the following question: "{data.user_message}"
    
    Provide a helpful, direct, and scientifically accurate response based on their specific crop and current environmental metrics. Keep the response concise and actionable.
    """
    try:
        response = model.generate_content(system_prompt)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"System Error: {str(e)}"}

# ==========================================
# ENDPOINT 5 & 6: Store & View B2B Requests
# ==========================================
@app.post("/api/partnerships")
async def save_partnership(request: PartnershipRequest, db: Session = Depends(get_db)):
    try:
        new_partner = PartnershipDB(
            company_name=request.Company_Name,
            contact_person=request.Contact_Person,
            email=request.Email,
            solar_acreage=request.Solar_Acreage
        )
        
        db.add(new_partner)
        db.commit()
        db.refresh(new_partner)
        
        print(f"Success: B2B Request saved for {new_partner.company_name}")
        return {"status": "success", "message": "Partnership stored securely."}
        
    except Exception as e:
        print(f"Database Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to store partnership data.")

@app.get("/api/partnerships")
async def get_all_partnerships(db: Session = Depends(get_db)):
    try:
        partnerships = db.query(PartnershipDB).all()
        return {"total": len(partnerships), "data": partnerships}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database read error: {str(e)}")
    
    
# ==========================
# ENDPOINT 7: ONLINE HOSTING
# ==========================

from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")