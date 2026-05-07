import re
import os
import numpy as np
import gdown
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import onnxruntime as ort
from transformers import AutoTokenizer

# إعداد السيرفر
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# إعداد OpenAI
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# ------------------------------------------------
# ⚙️ ONNX Engine & Google Drive Integration
# ------------------------------------------------
# استبدلي هذا المعرف بالمعرف الجديد الخاص بملف (621MB) من جوجل درايف
FILE_ID = "1FBS7ZkBoSABvmeKDpNL92o1VWsSTaYpY"
MODEL_PATH = "model.onnx"

def download_model():
    if not os.path.exists(MODEL_PATH):
        print("⏳ Downloading Anah Full Model (621MB) from Google Drive...")
        url = f'https://drive.google.com/uc?id={FILE_ID}'
        try:
            gdown.download(url, MODEL_PATH, quiet=False)
            print("✅ Download Complete!")
        except Exception as e:
            print(f"❌ Download Failed: {e}")

download_model()

# تحميل التوكنايزر والموديل
print("⏳ Loading Anah ONNX Engine...")
try:
    # سيقرأ التوكنايزر من الملفات المحلية (vocab.txt, الخ)
    tokenizer = AutoTokenizer.from_pretrained(".")
    onnx_session = ort.InferenceSession(MODEL_PATH)
    # القائمة المعتمدة في موديلك الجديد
    LABELS = ["هادئ", "سعيد", "حزين", "غاضب", "متوتر", "تعبان"]
    print("✅ Local ONNX Model Loaded Successfully!")
except Exception as e:
    print(f"❌ Error loading model: {e}")

def query_local_model(text_list):
    results = []
    try:
        for text in text_list:
            inputs = tokenizer(text, return_tensors="np", padding=True, truncation=True)
            ort_inputs = {k: v for k, v in inputs.items()}
            ort_outs = onnx_session.run(None, ort_inputs)
            scores = ort_outs[0][0]
            # تحويل النتائج لنسب (Softmax)
            exp_scores = np.exp(scores - np.max(scores))
            probs = exp_scores / exp_scores.sum()
            best_idx = np.argmax(probs)
            results.append({"label": LABELS[best_idx], "score": float(probs[best_idx])})
        return results
    except Exception as e:
        print(f"❌ Prediction Error: {e}")
        return None

# ------------------------------------------------
# 🧠 Chatbot Memory & Prompt (نسختك كما هي)
# ------------------------------------------------
last_emotion_memory = {}

SYSTEM_PROMPT = """
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
    app.run(host="0.0.0.0", port=port, debug=False)