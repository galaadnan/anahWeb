import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

# حل مشكلة الـ CORS التي تظهر في الصورة عندك
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# المسار الثابت لمجلد الموديل
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(
    BASE_DIR,
    "ai model",
    "UBC-NLP_MARBERTv2",
    "checkpoint-1821"
)
# تحميل الموديل "مرة واحدة" عند البداية لتسريع الطلبات اللاحقة
print("⏳ جاري تحميل المحرك الثقيل (1.1GB)... يرجى الانتظار")
try:
    classifier = pipeline("text-classification", model=model_path, tokenizer=model_path)
    print("✅✅ أناه جاهز الآن! التحليل سيكون سريعاً.")
except Exception as e:
    print(f"❌ خطأ في التحميل: {e}")

class Entry(BaseModel):
    text: str

class ChatRequest(BaseModel):
    message: str

@app.post("/analyze")
async def analyze(entry: Entry):
    try:
        # هنا يتم التحليل بسرعة لأن الموديل محمل مسبقاً في الذاكرة
        result = classifier(entry.text)
        return result[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        # تحليل المشاعر
        emotion_result = classifier(request.message)
        emotion = emotion_result[0]["label"]

        # بناء البرومبت
        prompt = f"المستخدم يشعر بـ {emotion}. رد بدعم قصير ولطيف: {request.message}"

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "أنت أناه، مساعد دعم عاطفي هادئ، لا تعطي نصائح طبية، وتكتب ردود قصيرة ولطيفة."},
                {"role": "user", "content": prompt}
            ],
        )

        reply_text = response.choices[0].message.content

        return {
            "emotion": emotion,
            "reply": reply_text
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))