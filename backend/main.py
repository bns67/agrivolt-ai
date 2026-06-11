from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
# import joblib
# import google.generativeai as genai

app = FastAPI(title="AgriVolt AI API")

# Allow the frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins for local testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS ---
class FarmData(BaseModel):
    crop_type: str
    shading_percent: float
    temperature_c: float
    soil_moisture: float

class ChatbotRequest(BaseModel):
    crop_type: str
    shading_percent: float
    current_yield: float
    user_question: str

# --- ENDPOINTS ---
@app.post("/api/predict")
def predict_yield(data: FarmData):
    # TODO for Hani (Week 3): Load the .pkl models and replace this dummy logic
    predicted_yield = 0.0
    
    if data.crop_type == "tomato":
        predicted_yield = 85.5 
    elif data.crop_type == "lettuce":
        predicted_yield = 92.0 
    elif data.crop_type == "potato":
        predicted_yield = 78.2 
    else:
        return {"error": "Crop not supported"}

    return {
        "status": "success",
        "crop": data.crop_type,
        "predicted_yield_kg": predicted_yield
    }

@app.post("/api/chat")
def ask_agronomist(data: ChatbotRequest):
    # TODO for Hani (Week 2): Add the real API key and uncomment the genai logic
    
    system_context = f"""
    You are an expert agronomist in Malaysia. 
    The farmer is growing {data.crop_type} under solar panels. 
    Currently, the panels are causing {data.shading_percent}% shading. 
    The predicted yield is {data.current_yield} kg.
    Keep your answer under 3 sentences, use plain language, and be helpful.
    """
    
    # genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
    # model = genai.GenerativeModel('gemini-pro')
    # response = model.generate_content(f"{system_context}\n\nFarmer asks: {data.user_question}")
    # ai_answer = response.text
    
    # Dummy response for Week 1/2 UI testing
    ai_answer = f"Hello! I see your {data.crop_type} is at {data.shading_percent}% shading. To improve the {data.current_yield}kg yield, ensure irrigation is steady."
    
    return {"reply": ai_answer}