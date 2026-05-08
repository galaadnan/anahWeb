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

SYSTEM_PROMPT = """
أنت أناه، مساعد دعم عاطفي عربي متزن وداعم.
استخدم لغة عربية فصحى بسيطة، كن متعاطفاً وغير مبالغ، ولا تقدم نصائح طبية.
"""

classifier = None

try:
    print("⏳ Loading Hugging Face model inside Render:", MODEL_ID)

    classifier = pipeline(
        "text-classification",
        model=MODEL_ID,
        tokenizer=MODEL_ID,
        token=HF_TOKEN,
        truncation=True,
    )

    print("✅ Model loaded successfully:", MODEL_ID)

    try:
        print("id2label:", classifier.model.config.id2label)
    except Exception:
        pass

except Exception as e:
    print("❌ Model loading failed:", str(e))
    classifier = None


def split_arabic_sentences(text: str):
    sentences = re.split(r"[.؟!،\n]+", text)
    return [s.strip() for s in sentences if len(s.strip()) > 3]


def normalize_label(raw_label: str):
    return LABEL_MAP.get(raw_label, raw_label or "غير محدد")


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


@app.route("/predict", methods=["POST"])
def predict():
    if classifier is None:
        return jsonify({
            "error": "Model not loaded",
            "hint": "Check MODEL_ID, HF_TOKEN, Hugging Face model files, and Render memory."
        }), 500

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    sentences = split_arabic_sentences(text) or [text]

    mood_counts = {}
    mood_scores = {}
    sentence_details = []

    try:
        for sentence in sentences:
            result = classifier(sentence, truncation=True, max_length=512)[0]

            raw_label = result.get("label", "غير محدد")
            score = float(result.get("score", 0))
            mood = normalize_label(raw_label)

            mood_counts[mood] = mood_counts.get(mood, 0) + 1
            mood_scores[mood] = mood_scores.get(mood, 0.0) + score

            sentence_details.append({
                "sentence": sentence,
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

        return jsonify({
            "finalMood": final_mood,
            "mood": final_mood,
            "secondaryMood": secondary_mood,
            "moodCounts": mood_counts,
            "sentencesDetails": sentence_details,
            "confidence": round(mood_scores.get(final_mood, 0.0) / max(mood_counts.get(final_mood, 1), 1), 4)
        })
except Exception as e:
        print("❌ Prediction error:", str(e))
        return jsonify({
            "error": "Prediction failed",
            "details": str(e)
        }), 500


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or data.get("text") or "").strip()

    if len(user_message) < 3:
        return jsonify({"reply": "اكتب جملة أوضح قليلاً."})

    try:
        emotion = "غير محدد"

        if classifier is not None:
            result = classifier(user_message, truncation=True, max_length=512)[0]
            emotion = normalize_label(result.get("label", "غير محدد"))

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
        print("❌ Chat error:", str(e))
        return jsonify({
            "reply": "أنا هنا لأسمعك، خذ نفساً عميقاً."
        })


if name == "main":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
