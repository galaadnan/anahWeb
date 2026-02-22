import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI()

# حل مشكلة الـ CORS التي تظهر في الصورة عندك
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# المسار الثابت لمجلد الموديل
model_path = r"C:\Users\lovem\OneDrive\سطح المكتب\Anahbackup\Anah-mental-health-web-application-main\ai model\UBC-NLP_MARBERTv2\checkpoint-1821"

# تحميل الموديل "مرة واحدة" عند البداية لتسريع الطلبات اللاحقة
print("⏳ جاري تحميل المحرك الثقيل (1.1GB)... يرجى الانتظار")
try:
    classifier = pipeline("text-classification", model=model_path, tokenizer=model_path)
    print("✅✅ أناه جاهز الآن! التحليل سيكون سريعاً.")
except Exception as e:
    print(f"❌ خطأ في التحميل: {e}")

class Entry(BaseModel):
    text: str

@app.post("/analyze")
async def analyze(entry: Entry):
    try:
        # هنا يتم التحليل بسرعة لأن الموديل محمل مسبقاً في الذاكرة
        result = classifier(entry.text)
        return result[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))