# app.py - Render API that loads the Hugging Face model directly
import os
import re
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from transformers import pipeline
from openai import OpenAI

app = Flask(name, static_folder=".", static_url_path="")
CORS(app)

# OpenAI is only for /chat. If OPENAI_API_KEY is missing, /predict still works.
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# IMPORTANT:
# Copy this exactly from your Hugging Face model URL:
# https://huggingface.co/raghadddddddd/anahEmotions
MODEL_ID = "raghadddddddd/anahEmotions"

# If model is private, add HF_TOKEN in Render Environment Variables.
HF_TOKEN = os.environ.get("HF_TOKEN")

LABEL_MAP = {
    "LABEL_0": "هادئ 🌿",
    "LABEL_1": "سعيد ✨",
    "LABEL_2": "حزين 😔",
    "LABEL_3": "غاضب 💢",
    "LABEL_4": "متوتر 😟",
    "LABEL_5": "تعبان 😴",
}

YSTEM_PROMPT = """
أنت أناه، مساعد دعم عاطفي عربي متزن وداعم.

التعليمات:
- استخدم لغة عربية فصحى بسيطة وطبيعية.
- لا تجعل جميع الردود بنفس الطول.
- إذا كانت رسالة المستخدم قصيرة، اجعل الرد مختصراً.
- إذا عبّر المستخدم بتفاصيل أو مشاعر أعمق، يمكن أن يكون الرد أطول قليلاً.
- ابدأ بتفهم واضح ولمسة تعاطف هادئة.
- اقترح خطوة عملية بسيطة عندما يكون ذلك مناسباً.
- لا تنهِ كل رد بسؤال.
- استخدم السؤال فقط إذا كان سيساعد بشكل طبيعي على فهم المستخدم أو دعمه.
- أحياناً يكفي رد داعم دون أي سؤال.
- تجنب التكرار والردود النمطية.
- لا تبالغ في التعاطف أو الدرامية.
- لا تقدم تشخيصات أو نصائح طبية.
- اجعل الرد يبدو إنسانياً وهادئاً ومتزنًا.
"""

# 🧩 Helper Functions
def split_arabic_sentences(text: str):
    sentences = re.split(r'[.؟!،\n]+', text)
    return [s.strip() for s in sentences if len(s.strip()) > 3]

# 🌐 Website Routes
@app.route("/")
def index():
    return send_from_directory(".", "home.html")

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text: return jsonify({"error": "No text"}), 400

    sentences = split_arabic_sentences(text) or [text]
    results = query_local_model(sentences)
    if not results: return jsonify({"error": "AI Engine Error"}), 500

    mood_counts = {}
    mood_scores = {}
    sentence_details = []

    for i, res in enumerate(results):
        mood = res["label"]
        score = res["score"]
        mood_counts[mood] = mood_counts.get(mood, 0) + 1
        mood_scores[mood] = mood_scores.get(mood, 0.0) + score
        sentence_details.append({"sentence": sentences[i], "mood": mood, "score": score})

    sorted_moods = sorted(mood_counts.keys(), key=lambda k: (mood_counts[k], mood_scores[k]), reverse=True)
    return jsonify({
        "finalMood": sorted_moods[0],
        "secondaryMood": sorted_moods[1] if len(sorted_moods) > 1 else None,
        "moodCounts": mood_counts,
        "sentencesDetails": sentence_details
    })

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or data.get("text") or "").strip()
    if len(user_message) < 3: return jsonify({"reply": "اكتب جملة أوضح قليلاً."})

    try:
        res = query_local_model([user_message])
        emotion = res[0]["label"] if res else "غير محدد"
        
        prev_emo = last_emotion_memory.get("last")
        last_emotion_memory["last"] = emotion

        prompt = f"المستخدم يشعر بـ {emotion}. رسالته: {user_message}"
        if prev_emo and prev_emo != emotion:
            prompt = f"المستخدم انتقل من {prev_emo} إلى {emotion}. رسالته: {user_message}"

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=80,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}]
        )
        return jsonify({"reply": response.choices[0].message.content.strip()})
    except:
        return jsonify({"reply": "أنا هنا لأسمعك، خذ نفساً عميقاً."})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=False).get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
