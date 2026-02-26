import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

# ذاكرة بسيطة لآخر شعور (اقتصادية)
last_emotion_memory = {}

SYSTEM_PROMPT = """
أنت أناه، مساعد دعم عاطفي عربي متزن.
استخدم لغة فصحى محايدة.
اجعل الرد سطرين كحد أقصى.
ابدأ بتفهم موجز، ثم اقترح خطوة عملية بسيطة.
أحياناً اختم بسؤال قصير يعزز الوعي الذاتي.
تجنب المبالغة أو النصائح الطبية.
"""

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(
    BASE_DIR,
    "ai model",
    "UBC-NLP_MARBERTv2",
    "checkpoint-1821"
)

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
        result = classifier(entry.text)
        return result[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        user_message = request.message.strip()

        # منع استهلاك غير ضروري
        if len(user_message) < 3:
            return {
                "emotion": "غير محدد",
                "reply": "اكتب جملة أوضح قليلاً لأتمكن من مساعدتك."
            }

        # تحليل المشاعر
        emotion_result = classifier(user_message)
        emotion = emotion_result[0]["label"]

        # جلب آخر شعور
        previous_emotion = last_emotion_memory.get("last")

        # حفظ الشعور الجديد
        last_emotion_memory["last"] = emotion

        # بناء البرومبت
        if previous_emotion and previous_emotion != emotion:
            prompt = f"""
المستخدم كان يشعر بـ {previous_emotion}.
الآن يشعر بـ {emotion}.
رسالة المستخدم: {user_message}
"""
        else:
            prompt = f"المستخدم يشعر بـ {emotion}. رسالة المستخدم: {user_message}"

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=80,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
        )

        reply_text = response.choices[0].message.content.strip()

        return {
            "emotion": emotion,
            "reply": reply_text
        }

    except Exception:
        return {
            "emotion": emotion if "emotion" in locals() else "غير محدد",
            "reply": "خذ لحظة هدوء قصيرة، والتنفس ببطء قد يساعد."
        }