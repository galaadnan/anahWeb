# ------------------------------------------------
# ⚙️ ONNX Engine & Google Drive Integration
# ------------------------------------------------
# 1. المعرف الخاص بالموديل الجديد (نسخة FP16 المصلحة)
FILE_ID = "1iJc2TEwLiGhapd_e-E-6Pr9wGSqVnpn2"

# 2. تحديد المسار واسم الملف المصلح
current_dir = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(current_dir, "model_fp16_fixed.onnx")

# متغيرات عالمية للمحرك والتوكنايزر
onnx_session = None
tokenizer = None
# تأكدي أن الترتيب يطابق مخرجات الموديل في كولاب
LABELS = ["هادئ", "سعيد", "حزين", "غاضب", "متوتر", "تعبان"]

# 3. دالة التحميل من جوجل درايف
def download_model_from_drive():
    """تحميل الموديل المصلح من جوجل درايف إذا لم يكن موجوداً"""
    if not os.path.exists(MODEL_PATH):
        print("⏳ Downloading Fixed FP16 Anah Model from Google Drive...")
        url = f'https://drive.google.com/uc?id={FILE_ID}'
        try:
            gdown.download(url, MODEL_PATH, quiet=False)
            print("✅ Download Complete!")
        except Exception as e:
            print(f"❌ Download Failed: {e}")

def load_ai_engine():
    global onnx_session, tokenizer
    download_model_from_drive()
    print("⏳ Loading Anah ONNX Engine...")
    try:
        # تحميل القاموس (Tokenizer)
        tokenizer = AutoTokenizer.from_pretrained("UBC-NLP/MARBERT")
        
        sess_options = ort.SessionOptions()
        sess_options.enable_mem_pattern = False
        sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        
        # تحميل الموديل المصلح
        onnx_session = ort.InferenceSession(MODEL_PATH, sess_options)
        print("✅ Fixed FP16 Model & MARBERT Tokenizer Loaded Successfully!")
    except Exception as e:
        print(f"❌ Error loading model: {e}")

# متغير لضمان تشغيل التحميل مرة واحدة فقط
is_loading_started = False

@app.before_request
def trigger_loading_in_worker():
    global is_loading_started
    if not is_loading_started:
        is_loading_started = True
        threading.Thread(target=load_ai_engine).start()

# دالة الاستعلام وتحليل النصوص
def query_local_model(text_list):
    # التأكد أن الموديل والتوكنايزر جاهزين
    if onnx_session is None or tokenizer is None:
        print("⚠️ Model is not loaded yet. Waiting for engine...")
        return None
        
    results = []
    try:
        input_names = [inp.name for inp in onnx_session.get_inputs()]
        
        for text in text_list:
            # تحويل النص باستخدام قاموس MARBERT
            inputs = tokenizer(text, return_tensors="np", padding='max_length', max_length=128, truncation=True)
            
            # إجبار أنواع البيانات على int64 لتوافق مداخل BERT
            ort_inputs = {k: v.astype(np.int64) for k, v in inputs.items() if k in input_names}
            
            # تشغيل التوقع
            ort_outs = onnx_session.run(None, ort_inputs)
            scores = ort_outs[0][0]
            
            # حساب الاحتمالات (Softmax)
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
    # التحقق من جاهزية المحرك قبل المعالجة
    if onnx_session is None:
        return jsonify({"error": "المحرك لا يزال قيد التحميل في الخلفية، يرجى المحاولة بعد قليل"}), 503

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
