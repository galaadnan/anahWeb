from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from transformers import pipeline
import os

app = Flask(__name__, static_folder='.')
CORS(app)

# ✅ استخدمي الموديل المتدرّب المحلي (fine-tuned checkpoint)
MODEL_DIR = "ai model/UBC-NLP_MARBERTv2/checkpoint-1821"

# تحميل الموديل
try:
    # pipeline يقرأ config + tokenizer + weights من المجلد
    pipe = pipeline("text-classification", model=MODEL_DIR)
    print("✅ Loaded fine-tuned model from local checkpoint:", MODEL_DIR)
    # للتأكد من الـ labels
    try:
        print("id2label:", pipe.model.config.id2label)
    except Exception:
        pass
except Exception as e:
    print(f"❌ Error loading model: {e}")
    pipe = None

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if pipe is None:
        return jsonify({"error": "Model not loaded"}), 500

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    result = pipe(text)[0]   # مثال: {'label': 'LABEL_2', 'score': 0.93}
    return jsonify({
        "mood": result.get("label"),
        "score": float(result.get("score", 0.0))
    })

if __name__ == "__main__":
    # ✅ نخليه 8000 عشان يطابق journal.js
    port = int(os.environ.get("PORT", 8000))
    app.run(host="127.0.0.1", port=port, debug=False)