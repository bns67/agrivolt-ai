import os
import joblib
import pandas as pd
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai

# 1. AI Configuration
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('models/gemini-2.5-flash')

# 2. Server Setup
app = FastAPI(title="AgriVolt AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Load the Trained Machine Learning Model
# This path works because you run uvicorn from the root agrivolt-ai folder
try:
    ml_model = joblib.load("backend/yield_model.joblib")
    print("Machine Learning model loaded successfully!")
except Exception as e:
    ml_model = None
    print(f"Warning: ML model not found. {e}")

# 4. Data Structure Definition
class FarmData(BaseModel):
    crop_type: str
    shading_percent: float
    temperature_c: float
    soil_moisture: float
    user_message: Optional[str] = ""  # Made optional so the ML endpoint doesn't require a chat message

# ==========================================
# ENDPOINT 1: Machine Learning Yield Predictor
# ==========================================
@app.post("/api/predict")
async def predict_yield(data: FarmData):
    if not ml_model:
        return {"error": "Model not loaded on server."}
    
    try:
        # Translate the frontend data into the Pandas DataFrame the pipeline expects
        input_df = pd.DataFrame([{
            'crop_type': data.crop_type,
            'shading_percent': data.shading_percent,
            'temperature_c': data.temperature_c,
            'soil_moisture': data.soil_moisture
        }])
        
        # Run the AI prediction
        predicted_yield = ml_model.predict(input_df)[0]
        
        # Return the number rounded to 2 decimal places
        return {"yield_kg_m2": round(predicted_yield, 2)}
        
    except Exception as e:
        return {"error": str(e)}

# ==========================================
# ENDPOINT 2: Gemini Agronomist Chatbot
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