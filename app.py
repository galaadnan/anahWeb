from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from transformers import pipeline
import os
from openai import OpenAI

# Configure server to serve static files (CSS, JS, Images)
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# ------------------------------------------------
# ⚙️ Dual Model System (Primary + Backup)
# ------------------------------------------------
pipe = None
PRIMARY_MODEL = "raghadddddddd/anahEmotions"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_MODEL_PATH = os.path.join(BASE_DIR, "ai model", "UBC-NLP_MARBERTv2", "checkpoint-1821")

print("⏳ Starting Anah engine...")

try:
    # 1. First Attempt: Fast cloud model
    pipe = pipeline("text-classification", model=PRIMARY_MODEL, truncation=True)
    print(f"✅ (Plan A): Fast model loaded successfully from {PRIMARY_MODEL}")

except Exception as e1:
    print(f"⚠️ Failed to connect to the fast model, switching to Plan B... Reason: {e1}")
    
    try:
        # 2. Plan B: Heavy local model (Backup)
        pipe = pipeline("text-classification", model=BACKUP_MODEL_PATH, tokenizer=BACKUP_MODEL_PATH, truncation=True)
        print("✅✅ (Plan B): Heavy backup model loaded successfully!")
    except Exception as e2:
        print(f"❌ Critical Error: Failed to load both models. Check local model path. Reason: {e2}")

# ------------------------------------------------
# 🧠 Chatbot Memory & Prompt
# ------------------------------------------------
last_emotion_memory = {}

# System prompt is kept in Arabic to instruct the AI to respond in Arabic
SYSTEM_PROMPT = """
أنت أناه، مساعد دعم عاطفي عربي متزن.
استخدم لغة فصحى محايدة.
اجعل الرد سطرين كحد أقصى.
ابدأ بتفهم موجز، ثم اقترح خطوة عملية بسيطة.
أحياناً اختم بسؤال قصير يعزز الوعي الذاتي.
تجنب المبالغة أو النصائح الطبية.
"""

# ------------------------------------------------
# 🌐 Website Routes
# ------------------------------------------------

@app.route("/")
def index():
    return send_from_directory(".", "home.html")

@app.route("/predict", methods=["POST"])
def predict():
    if pipe is None:
        return jsonify({"error": "الموديل غير متاح حالياً، يرجى التحقق من التيرمنال"}), 500

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    result = pipe(text)[0] 
    label = result.get("label") or "غير محدد"
    score = float(result.get("score", 0.0))

    return jsonify({
        "mood": label,
        "score": score
    })

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = data.get("message") or data.get("text") or ""
    user_message = user_message.strip()

    if len(user_message) < 3:
        return jsonify({"reply": "اكتب جملة أوضح قليلاً لأتمكن من مساعدتك."})

    try:
        emotion = "غير محدد"
        if pipe:
            emotion_result = pipe(user_message)[0]
            emotion = emotion_result.get("label", "غير محدد")

        previous_emotion = last_emotion_memory.get("last")
        last_emotion_memory["last"] = emotion

        if previous_emotion and previous_emotion != emotion:
            prompt = f"المستخدم كان يشعر بـ {previous_emotion}.\nالآن يشعر بـ {emotion}.\nرسالة المستخدم: {user_message}"
        else:
            prompt = f"المستخدم يشعر بـ {emotion}.\nرسالة المستخدم: {user_message}"

        # Call OpenAI API with timeout
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=80,
            timeout=5,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ]
        )
        
        bot_reply = response.choices[0].message.content.strip()
        return jsonify({"reply": bot_reply})

    except Exception as e:
        print(f"❌ Error in OpenAI chat: {e}")
        return jsonify({"reply": "خذ لحظة هدوء قصيرة، والتنفس ببطء قد يساعد."})

# ------------------------------------------------
# 🚀 Run Server
# ------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="127.0.0.1", port=port, debug=False)