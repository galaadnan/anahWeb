# ------------------------------------------------
# 🤗 Hugging Face Inference API Integration
# ------------------------------------------------
# الرابط الصحيح (8 حبات d)
API_URL = "https://api-inference.huggingface.co/models/raghadddddddd/anahEmotions"

# سحب التوكن من إعدادات ريندر
HF_TOKEN = os.environ.get("HF_TOKEN")

# إعداد الهوية (المفتاح) لاستخدامه في الطلبات
headers = {"Authorization": f"Bearer {HF_TOKEN}"}

def query_model_api(text_list):
    """إرسال طلب لـ Hugging Face API باستخدام التوكن الموثق"""
    results = []
    try:
        # التأكد من وجود التوكن قبل البدء
        if not HF_TOKEN:
            print("❌ Error: HF_TOKEN is missing in Environment Variables!")
            return None

        for text in text_list:
            # إرسال طلب POST مع الـ headers (المفتاح) والـ options (الانتظار)
            response = requests.post(
                API_URL, 
                headers=headers, # تم إضافة المفتاح هنا لضمان عمل الـ API
                json={"inputs": text, "options": {"wait_for_model": True}}
            )
            
            # التأكد من نجاح الطلب
            if response.status_code != 200:
                print(f"⚠️ API Error: {response.status_code} - {response.text}")
                return None
                
            output = response.json()
            
            # معالجة استجابة Hugging Face
            if isinstance(output, list) and len(output) > 0:
                # الحصول على التوقعات (Handles both list of lists and single list)
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

@app.route("/predict", methods=["POST"])
def predict():
    # التحليل المباشر عبر الـ API
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text: return jsonify({"error": "No text"}), 400

    sentences = split_arabic_sentences(text) or [text]
    results = query_model_api(sentences)
    
    if not results:
        return jsonify({"error": "الموديل قيد التحميل أو هناك مشكلة في الاتصال"}), 503

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
        # تحليل الشعور عبر الـ API لتحديد نبرة الرد
        res = query_model_api([user_message])
        emotion = res[0]["label"] if res else "غير محدد"

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
    # ريندر يستخدم بورت 10000 عادة
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
