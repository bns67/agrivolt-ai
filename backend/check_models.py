import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load your API key from the .env file
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

print("Connecting to Google Servers...")
print("Your API key has access to the following text models:\n")

try:
    # Ask Google for a list of all models your key can use
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Failed to connect. Error: {e}")