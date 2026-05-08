import os
import re # تم إضافة الاستيراد المفقود
import requests
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI

# إعداد السيرفر
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# إعداد OpenAI
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# ------------------------------------------------
# 🤗 Hugging Face Inference API Integration
# ------------------------------------------------
API_URL = "https://api-inference.huggingface.co/models/raghadddddddd/anahEmotions"
HF_TOKEN = os.environ.get("HF_TOKEN")
headers = {"Authorization": f"Bearer {HF_TOKEN}"}

def query_model_api(text_list):
    """إرسال طلب لـ Hugging Face API باستخدام التوكن الموثق"""
    results = []
    try:
        if not HF_TOKEN:
            print("❌ Error: HF_TOKEN is missing in Environment Variables!")
            return None

        for text in text_list:
            payload = {
                "inputs": text,
                "options": {"wait_for_model": True, "use_cache": False}
            }
            
            response = requests.post(API_URL, headers=headers, json=payload)
            
            if response.status_code == 503:
                print("⏳ Model is loading... Please wait.")
                return "loading"
            
            if response.status_code != 200:
                print(f"⚠️ API Error: {response.status_code} - {response.text}")
                return None
                
            output = response.json()
            
            if isinstance(output, list) and len(output) > 0:
                predictions = output[0] if isinstance(output[0], list) else output
                top_prediction = max(predictions, key=lambda x: x['score'])
                results.append({
                    "label": top_prediction['label'],
                    "score": float(top_prediction['score'])
                })
        return results if results else None
    except Exception as e:
        print(f"❌ Exception during API call: {e}")
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
    return send_from_directory(".", "home.html")

# إضافة مسار لكل ملفات الـ HTML عشان تشتغل الروابط
@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text: return jsonify({"error": "No text"}), 400

    sentences = split_arabic_sentences(text) or [text]
    results = query_model_api(sentences)
    
    if results == "loading":
        return jsonify({"error": "الموديل قيد التحميل، جرب ثانية بعد ثوانٍ"}), 503

    if not results:
        return jsonify({"error": "هناك مشكلة في الاتصال بالموديل"}), 500

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
        res = query_model_api([user_message])
        emotion = "غير محدد"
        if isinstance(res, list) and len(res) > 0:
            emotion = res[0]["label"]

        prompt = f"المستخدم يشعر بـ {emotion}. رسالته: {user_message}"
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=80,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}]
        )
        return jsonify({"reply": response.choices[0].message.content.strip()})
    except:
        return jsonify({"reply": "أنا هنا لأسمعك، خذ نفساً عميقاً."})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
