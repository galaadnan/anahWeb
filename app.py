from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from transformers import pipeline
import os

app = Flask(__name__, static_folder='.')
CORS(app)

# ✅ Load model from Hugging Face (NOT from a local folder)
# Change this to your exact HF repo id
MODEL_ID = "raghadddddddd/anahEmotions"

try:
    pipe = pipeline(
        "text-classification",
        model=MODEL_ID,
        truncation=True
    )
    print("✅ Loaded model from Hugging Face:", MODEL_ID)

    # Optional debug: show labels if available
    try:
        print("id2label:", pipe.model.config.id2label)
    except Exception:
        pass

except Exception as e:
    print(f"❌ Error loading model: {e}")
    pipe = None


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/predict", methods=["POST"])
def predict():
    if pipe is None:
        return jsonify({"error": "Model not loaded"}), 500

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    result = pipe(text)[0]  # {'label': '...', 'score': ...}

    # ✅ support different label keys safely
    label = result.get("label") or "غير محدد"
    score = float(result.get("score", 0.0))

    return jsonify({
        "mood": label,
        "score": score
    })


if __name__ == "__main__":
    # ✅ use PORT env var (Mac syntax: PORT=8000 python app.py)
    port = int(os.environ.get("PORT", 8000))
    app.run(host="127.0.0.1", port=port, debug=False)