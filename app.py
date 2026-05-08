# Updated: May 8, 2026 - Final Stable Version for Render API
import os
import re
import requests
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
from transformers import pipeline
 
# إعداد السيرفر
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)
 
# إعداد OpenAI (تأكدي أن المفتاح موجود في إعدادات رندر باسم OPENAI_API_KEY)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
 
# ------------------------------------------------
# 🤗 Hugging Face Model Loaded Inside Render
# ------------------------------------------------
# انسخي الاسم بالضبط من رابط الموديل في Hugging Face
MODEL_ID = "raghadddddddd/anahEmotions"
 
# إذا الموديل Private لازم تحطين HF_TOKEN في Render Environment
HF_TOKEN = os.environ.get("HF_TOKEN")
 
LABEL_MAP = {
    "LABEL_0": "هادئ 🌿",
    "LABEL_1": "سعيد ✨",
    "LABEL_2": "حزين 😔",
    "LABEL_3": "غاضب 💢",
    "LABEL_4": "متوتر 😟",
    "LABEL_5": "تعبان 😴"
}
 
classifier = None
 
try:
    print("⏳ جاري تحميل موديل أناه داخل Render...")
    classifier = pipeline(
        "text-classification",
        model=MODEL_ID,
        tokenizer=MODEL_ID,
        token=HF_TOKEN,
        truncation=True
    )
    print("✅ تم تحميل الموديل بنجاح:", MODEL_ID)
 
    try:
        print("id2label:", classifier.model.config.id2label)
    except Exception:
        pass
 
except Exception as e:
    print("❌ خطأ في تحميل الموديل:", str(e))
    classifier = None
 
 
def normalize_label(label):
    return LABEL_MAP.get(label, label or "غير محدد")
 
 
def query_model_api(text_list):
    """
    تحليل النصوص باستخدام الموديل المحمّل داخل Render.
    لم نعد نستخدم Hugging Face Inference API لأنه سبب خطأ:
    Cannot POST /models/...
    """
    if classifier is None:
        print("❌ Model is not loaded")
        return None
 
    results = []
 
    try:
        for text in text_list:
            output = classifier(text, truncation=True, max_length=512)[0]
 
            raw_label = output.get("label", "غير محدد")
            score = float(output.get("score", 0.0))
 
            results.append({
                "label": normalize_label(raw_label),
                "rawLabel": raw_label,
                "score": score
            })
 
        return results if results else None
 
    except Exception as e:
        print(f"❌ Prediction Error: {e}")
        return None
 
 
# ------------------------------------------------
# 🧠 Chatbot Memory & Prompt
# ------------------------------------------------
SYSTEM_PROMPT = """
أنت أناه، مساعد دعم عاطفي عربي متزن وداعم.
استخدم لغة عربية فصحى بسيطة، كن متعاطفاً وغير مبالغ، ولا تقدم نصائح طبية.
"""
 
 
def split_arabic_sentences(text: str):
    sentences = re.split(r'[.؟!،\n]+', text)
    return [s.strip() for s in sentences if len(s.strip()) > 3]
 
 
# 🌐 Website Routes
@app.route("/")
def index():
    return jsonify({
        "status": "Anah API is running",
        "model": MODEL_ID,
        "model_loaded": classifier is not None,
        "endpoints": ["/predict", "/chat"]
    })
 
 
@app.route("/home.html")
def home_page():
    return send_from_directory(".", "home.html")
 
 
@app.route("/journal.html")
def journal_page():
    return send_from_directory(".", "journal.html")
 
 
@app.route("/analyze.html")
def analyze_page():
    return send_from_directory(".", "analyze.html")
 
 
@app.route("/SignOrLogin.html")
def auth_page():
    return send_from_directory(".", "SignOrLogin.html")
 
 
@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)
 
 
@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
 
    if not text:
        return jsonify({"error": "No text"}), 400
 
    if classifier is None:
        return jsonify({
            "error": "الموديل لم يتم تحميله",
            "hint": "راجعي Render logs: MODEL_ID أو HF_TOKEN أو ملفات الموديل أو الذاكرة"
        }), 500
 
    sentences = split_arabic_sentences(text) or [text]
    results = query_model_api(sentences)
 
    if not results:
        return jsonify({
            "error": "الموديل قيد التحميل أو هناك مشكلة في التحليل"
        }), 503
 
    mood_counts = {}
    mood_scores = {}
    sentence_details = []
 
    for i, res in enumerate(results):
        mood = res["label"]
        raw_label = res.get("rawLabel", mood)
        score = res["score"]
 
        mood_counts[mood] = mood_counts.get(mood, 0) + 1
        mood_scores[mood] = mood_scores.get(mood, 0.0) + score
 
        sentence_details.append({
            "sentence": sentences[i],
            "mood": mood,
            "rawLabel": raw_label,
            "score": score
        })
 
    sorted_moods = sorted(
        mood_counts.keys(),
        key=lambda k: (mood_counts[k], mood_scores[k]),
        reverse=True
    )
 
    final_mood = sorted_moods[0] if sorted_moods else "غير محدد"
    secondary_mood = sorted_moods[1] if len(sorted_moods) > 1 else None
 
    confidence = 0
    if final_mood in mood_scores and final_mood in mood_counts:
        confidence = mood_scores[final_mood] / max(mood_counts[final_mood], 1)
 
    return jsonify({
        "finalMood": final_mood,
        "mood": final_mood,
        "secondaryMood": secondary_mood,
        "moodCounts": mood_counts,
        "sentencesDetails": sentence_details,
        "confidence": round(float(confidence), 4)
    })
 
 
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or data.get("text") or "").strip()
 
    if len(user_message) < 3:
        return jsonify({"reply": "اكتب جملة أوضح قليلاً."})
 
    try:
        # تحليل الشعور لتحديد نبرة الرد
        res = query_model_api([user_message])
        emotion = res[0]["label"] if res else "غير محدد"
 
        # لو OpenAI key غير موجود، لا نكسر الشات
        if client is None:
            return jsonify({
                "emotion": emotion,
                "reply": "أنا هنا لأسمعك، خذ نفساً عميقاً واكتب لي ما تشعر به."
            })
 
        prompt = f"المستخدم يشعر بـ {emotion}. رسالته: {user_message}"
 
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=80,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ]
        )
 
        return jsonify({
            "emotion": emotion,
            "reply": response.choices[0].message.content.strip()
        })
 
    except Exception as e:
        print("❌ Chat Error:", str(e))
        return jsonify({"reply": "أنا هنا لأسمعك، خذ نفساً عميقاً."})
 
 
if __name__ == "__main__":
    # ريندر يستخدم PORT من البيئة
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
