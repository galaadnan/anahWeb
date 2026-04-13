from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from transformers import pipeline
import os
from openai import OpenAI  # 👈 أضفنا مكتبة الشات بوت هنا

# أضفنا static_url_path عشان يقرأ الصور والـ CSS بدون مشاكل
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# 👈 إعداد عميل الذكاء الاصطناعي (OpenAI)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# ✅ Load model from Hugging Face
MODEL_ID = "raghadddddddd/anahEmotions"

try:
    pipe = pipeline(
        "text-classification",
        model=MODEL_ID,
        truncation=True
    )
    print("✅ Loaded model from Hugging Face:", MODEL_ID)

    try:
        print("id2label:", pipe.model.config.id2label)
    except Exception:
        pass

except Exception as e:
    print(f"❌ Error loading model: {e}")
    pipe = None

@app.route("/")
def index():
    # 👈 غيرناها لـ home.html عشان تفتح صفحتك الأساسية
    return send_from_directory(".", "home.html")

@app.route("/predict", methods=["POST"])
def predict():
    if pipe is None:
        return jsonify({"error": "Model not loaded"}), 500

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    result = pipe(text)[0]  # {'label': '...', 'score': ...}

    label = result.get("label") or "غير محدد"
    score = float(result.get("score", 0.0))

    return jsonify({
        "mood": label,
        "score": score
    })

# 👇 هذا هو المسار الجديد الخاص بالشات بوت 👇
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    # المتغير ممكن يكون message أو text حسب كيف كتبتوه بالواجهة
    user_message = data.get("message") or data.get("text") or ""

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    try:
        # إرسال الرسالة لـ OpenAI
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "أنتِ 'أناه' مساعدة ذكية للصحة النفسية. ردي بتعاطف، وبأسلوب داعم، وباللغة العربية."},
                {"role": "user", "content": user_message}
            ]
        )
        
        bot_reply = response.choices[0].message.content
        
        # إرجاع الرد للواجهة
        return jsonify({"reply": bot_reply})

    except Exception as e:
        print(f"❌ Error in OpenAI chat: {e}")
        return jsonify({"error": "Failed to connect to AI"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="127.0.0.1", port=port, debug=False)