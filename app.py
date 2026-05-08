import re
import os
import numpy as np
import gdown
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import onnxruntime as ort
from transformers import AutoTokenizer

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ------------------------------------------------
# ⚙️ ONNX Engine & Google Drive Integration
# ------------------------------------------------
# 1. المعرف الخاص بالموديل (نسخة FP16 المصلحة)
FILE_ID = "1iJc2TEwLiGhapd_e-E-6Pr9wGSqVnpn2"

# 2. تحديد المسار المطلق للموديل
current_dir = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(current_dir, "model.onnx")

# متغيرات عالمية
onnx_session = None
tokenizer = None
LABELS = ["هادئ", "سعيد", "حزين", "غاضب", "متوتر", "تعبان"]

# 3. دالة التحميل
def download_model_from_drive():
    if not os.path.exists(MODEL_PATH):
        print("⏳ Downloading Fixed FP16 Anah Model...")
        url = f'https://drive.google.com/uc?id={FILE_ID}'
        try:
            gdown.download(url, MODEL_PATH, quiet=False)
            print("✅ Download Complete!")
        except Exception as e:
            print(f"❌ Download Failed: {e}")
            raise e

def load_ai_engine():
    global onnx_session, tokenizer
    download_model_from_drive()
    print("⏳ Loading Anah ONNX Engine (CPU Optimized)...")
    try:
        # تحميل التوكنايزر
        
        tokenizer = AutoTokenizer.from_pretrained(current_dir)
        
        # إعدادات الجلسة لتحسين الذاكرة ومنع أخطاء التوافق
        sess_options = ort.SessionOptions()
        sess_options.enable_mem_pattern = False
        sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        
        # إجبار العمل على CPU فقط لتفادي أخطاء الـ GPU في ريندر
        onnx_session = ort.InferenceSession(
            MODEL_PATH, 
            sess_options, 
            providers=['CPUExecutionProvider']
        )
        onnx_session.disable_fallback()
        print("✅ Fixed FP16 Model & MARBERT Tokenizer Loaded Successfully!")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        raise e

# تحميل المحرك مرة وحدة عند تشغيل السيرفر
load_ai_engine()

# 🧪 دالة الاستعلام وتحليل النصوص
def query_local_model(text_list):
    if onnx_session is None or tokenizer is None:
        print("⚠️ Model is not loaded yet.")
        return None
        
    results = []
    try:
        input_names = [inp.name for inp in onnx_session.get_inputs()]
        
        for text in text_list:
            # تحويل النص لمدخلات بايثون
            inputs = tokenizer(text, return_tensors="np",padding=True, max_length=64, truncation=True)
            
            # 🔥 الحل الجذري للـ TypeError:
            # إجبار كل المدخلات (input_ids, attention_mask, token_type_ids) تكون int64
            ort_inputs = {k: v.astype(np.int64) for k, v in inputs.items() if k in input_names}
            
            # تشغيل التوقع
            ort_outs = onnx_session.run(None, ort_inputs)
            
            # سحب النتائج (Scores)
            scores = ort_outs[0][0]
            
            # Softmax يدوي لضمان الدقة مع الـ FP16
            exp_scores = np.exp(scores - np.max(scores))
            probs = exp_scores / exp_scores.sum()
            best_idx = np.argmax(probs)
            
            results.append({
                "label": LABELS[best_idx], 
                "score": float(probs[best_idx])
            })
        return results
    except Exception as e:
        print(f"❌ Prediction Error: {e}")
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
