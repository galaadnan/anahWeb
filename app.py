import os
import re
import gdown
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import onnxruntime as ort
from transformers import AutoTokenizer

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# ------------------------------------------------
# ⚙️ Full Precision ONNX Engine (621MB)
# ------------------------------------------------
# ❗ تأكدي إن هذا هو المعرف الصحيح لملف model.onnx اللي بالصورة
FILE_ID = "1pbw1krVbn46yPQ8vphbeCqf_mSnsSred" 
MODEL_DIR = "."
MODEL_PATH = os.path.join(MODEL_DIR, "model.onnx")

onnx_session = None
tokenizer = None
LABELS = ["هادئ", "سعيد", "حزين", "غاضب", "متوتر", "تعبان"]

def setup_ai():
    global onnx_session, tokenizer
    if not os.path.exists(MODEL_PATH):
        print("⏳ جاري تحميل الموديل (621MB) من درايف... قد يستغرق عدة دقائق")
        url = f'https://drive.google.com/uc?id={FILE_ID}'
        try:
            gdown.download(url, MODEL_PATH, quiet=False)
            print("✅ تم التحميل بنجاح!")
        except Exception as e:
            print(f"❌ فشل التحميل: {e}")
            raise e

    print("🧠 جاري تشغيل المحرك بكامل الدقة...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        
        sess_options = ort.SessionOptions()
        # تشغيل الموديل باستخدام الـ CPU
        onnx_session = ort.InferenceSession(MODEL_PATH, sess_options, providers=['CPUExecutionProvider'])
        print("🚀 نظام أناه جاهز ومستعد 100%!")
    except Exception as e:
        print(f"❌ خطأ في التشغيل: {e}")
        raise e

setup_ai()

def query_model(text_list):
    results = []
    try:
        input_names = [inp.name for inp in onnx_session.get_inputs()]
        for text in text_list:
            inputs = tokenizer(text, return_tensors="np", padding=True, truncation=True, max_length=128)
            ort_inputs = {k: v.astype(np.int64) for k, v in inputs.items() if k in input_names}
            
            ort_outs = onnx_session.run(None, ort_inputs)
            scores = ort_outs[0][0]
            
            # حساب الاحتمالات يدوياً
            exp_scores = np.exp(scores - np.max(scores))
            probs = exp_scores / exp_scores.sum()
            best_idx = int(np.argmax(probs))
            
            results.append({
                "label": LABELS[best_idx],
                "score": float(probs[best_idx])
            })
        return results
    except Exception as e:
        print(f"❌ Analysis Error: {e}")
        return None
# ------------------------------------------------
# 🧠 Chatbot Memory & Prompt
# ------------------------------------------------
last_emotion_memory = {}

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

@app.route("/predict", methods=["POST"])
def predict():
    if onnx_session is None:
        return jsonify({"error": "المحرك لا يزال قيد التحميل، حاول بعد قليل"}), 503

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
        last_emotion_memory["last"] = emotion

        prompt = f"المستخدم يشعر بـ {emotion}. رسالته: {user_message}"
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=80,
            timeout=20,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}]
        )
        return jsonify({"reply": response.choices[0].message.content.strip()})
    except Exception as e:
        print(f"❌ Chat Error: {e}")
        return jsonify({"reply": "أنا هنا لأسمعك، خذ نفساً عميقاً."})

if __name__ == "__main__":
    # ريندر يستخدم بورت 10000 عادة
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
