import os
import re
import gdown
import torch
import zipfile
import base64
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# ------------------------------------------------
# 🔒 إعدادات تشفير اليوميات (AES-256-GCM)
# ------------------------------------------------
SECRET_KEY_B64 = os.environ.get("JOURNAL_AES_KEY", "x8V2kL9pR4mN7qW1zB3yH6cF0jD5tG8sA2vE4uX7oI0=")

def encrypt_journal(plain_text: str) -> str:
    if not plain_text: return ""
    key = base64.b64decode(SECRET_KEY_B64)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plain_text.encode('utf-8'), None)
    return base64.b64encode(nonce + ciphertext).decode('utf-8')

def decrypt_journal(encrypted_text_b64: str) -> str:
    if not encrypted_text_b64: return ""
    try:
        key = base64.b64decode(SECRET_KEY_B64)
        aesgcm = AESGCM(key)
        encrypted_data = base64.b64decode(encrypted_text_b64)
        nonce = encrypted_data[:12]
        ciphertext = encrypted_data[12:]
        return aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
    except Exception as e:
        print(f"❌ خطأ في فك التشفير: {e}")
        return "⚠️ [محتوى مشفر لا يمكن قراءته]"

# ------------------------------------------------
# ⚙️ Safetensors Engine (ZIP) & Google Drive Integration
# ------------------------------------------------
FILE_ID = "1FXO4qF1YdQd2oqgBPkP3x-wYWJp5O9pC" # الـ ID الجديد لملف ZIP
MODEL_DIR = "."
ZIP_PATH = os.path.join(MODEL_DIR, "model.zip")

tokenizer = None
model = None
LABELS = ["هادئ", "سعيد", "حزين", "غاضب", "متوتر", "تعبان"]

def setup_ai():
    global tokenizer, model
    
    # 1. التحقق من وجود الملفات، إذا لم تكن موجودة نحمل ملف الـ ZIP
    if not os.path.exists(os.path.join(MODEL_DIR, "config.json")):
        print("⏳ جاري تحميل الحزمة الكاملة (ZIP) من Google Drive...")
        url = f'https://drive.google.com/uc?id={FILE_ID}'
        try:
            gdown.download(url, ZIP_PATH, quiet=False)
            
            # 2. فك الضغط
            print("📦 جاري فك ضغط الملفات...")
            with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
                zip_ref.extractall(MODEL_DIR)
            
            print("✅ تم فك الضغط وتجهيز البيئة!")
        except Exception as e:
            print(f"❌ فشل التحميل أو فك الضغط: {e}")
            raise e

    print("🧠 جاري تشغيل نسخة (1 مايو) من الذاكرة...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
        model.eval()
        print("🚀 نظام أناه جاهز الآن بالتطابق الكامل مع جهازك!")
    except Exception as e:
        print(f"❌ خطأ في تحميل المحرك: {e}")
        raise e

setup_ai()

# ------------------------------------------------
# 🛡️ Rule-Based Layer (القاموس المطور)
# ------------------------------------------------
EXPLICIT_RULES = {
    # 😡 الغضب
    "غاضب": "غاضب", "معصب": "غاضب", "متنرفز": "غاضب", 
    "منقهر": "غاضب", "مفور": "غاضب", "منفعل": "غاضب", "قهر": "غاضب", "غضب": "غاضب",
    
    # 😊 السعادة
    "سعيد": "سعيد", "فرحان": "سعيد", "مبسوط": "سعيد", 
    "مستانس": "سعيد", "طاير": "سعيد", "مبهوج": "سعيد", "فرح": "سعيد", "رضا": "سعيد",
    
    # 😢 الحزن
    "حزين": "حزين", "زعلان": "حزين", "متضايق": "حزين", 
    "مكتئب": "حزين", "مهموم": "حزين", "مقهور": "حزين", "حزن": "حزين", "ضيق": "حزين", "إحباط": "حزين",
    
    # 🥱 التعب
    "تعبان": "تعبان", "مرهق": "تعبان", "هلكان": "تعبان", 
    "مهدود": "تعبان", "طافي": "تعبان", "دايخ": "تعبان", "مكسر": "تعبان", "تعب": "تعبان", "ارهاق": "تعبان",
    
    # 😰 التوتر
    "متوتر": "متوتر", "قلقان": "متوتر", "مرتبك": "متوتر", 
    "خايف": "متوتر", "مخبوص": "متوتر", "مشغول": "متوتر", "توتر": "متوتر", "قلق": "متوتر",
    
    # 😌 الهدوء
    "هادئ": "هادئ", "رايق": "هادئ", "مروق": "هادئ", 
    "مرتاح": "هادئ", "مسترخي": "هادئ", "مفضي": "هادئ", "هدوء": "هادئ", "سكينة": "هادئ"
}

def query_model(text_list):
    results = []
    try:
        for text in text_list:
            clean_text = text.strip()
            
            matched_label = None
            
            # فحص الـ Rule-Based على الجملة كاملة بدون شرط الطول
            for key, label in EXPLICIT_RULES.items():
                if key in clean_text:
                    matched_label = label
                    break
            
            if matched_label:
                results.append({
                    "label": matched_label,
                    "score": 1.0 
                })
                continue 

            inputs = tokenizer(clean_text, return_tensors="pt", padding=True, truncation=True, max_length=128)
            with torch.no_grad():
                outputs = model(**inputs)
            
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            best_idx = torch.argmax(probs).item()
            
            results.append({
                "label": LABELS[best_idx],
                "score": float(probs[0][best_idx])
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

def split_arabic_sentences(text: str):
    sentences = re.split(r'[.؟!،\n]+', text)
    return [s.strip() for s in sentences if len(s.strip()) > 3]

# ------------------------------------------------
# 🌐 Website Routes
# ------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(".", "home.html")

@app.route("/save_journal", methods=["POST"])
def save_journal():
    data = request.get_json(silent=True) or {}
    plain_text = (data.get("content") or "").strip()
    
    if not plain_text:
        return jsonify({"error": "لا يوجد نص للحفظ"}), 400

    encrypted_text = encrypt_journal(plain_text)
    # قم بحفظ encrypted_text في قاعدة البيانات هنا
    return jsonify({"status": "success", "message": "تم حفظ يومياتك بأمان وتشفيرها!"})

@app.route("/get_journals", methods=["GET"])
def get_journals():
    # اسحب اليوميات المشفرة من قاعدة البيانات هنا
    encrypted_from_db = [] 
    
    decrypted_journals = []
    for journal in encrypted_from_db:
        original_text = decrypt_journal(journal["encrypted_content"])
        decrypted_journals.append({
            "date": journal["date"],
            "content": original_text
        })
        
    return jsonify({"journals": decrypted_journals})

@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "المحرك لا يزال قيد التحميل، حاول بعد قليل"}), 503

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text: return jsonify({"error": "No text"}), 400

    sentences = split_arabic_sentences(text) or [text]
    results = query_model(sentences)
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
        res = query_model([user_message])
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
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
