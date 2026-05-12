import os # Import the operating system module for environment variables and file paths
import re # Import regular expressions for text pattern matching and splitting
import gdown # Import gdown to download large files directly from Google Drive
import torch # Import PyTorch library for deep learning model execution
import zipfile # Import zipfile to handle compressed model files if needed
import base64 # Import base64 for encoding and decoding binary data into strings
import shutil # Import shutil for high-level file operations like copying or removing
from flask import Flask, request, jsonify, send_from_directory # Import Flask components for the web server
from flask_cors import CORS # Import CORS to allow cross-origin requests from the frontend
from openai import OpenAI # Import the OpenAI client for interacting with GPT models
from transformers import AutoTokenizer, AutoModelForSequenceClassification # Import HuggingFace tools for NLP
from cryptography.hazmat.primitives.ciphers.aead import AESGCM # Import AES-GCM for authenticated encryption

# Initialize the Flask application instance
app = Flask(__name__, static_folder='.', static_url_path='')
# Enable Cross-Origin Resource Sharing for all app routes
CORS(app)

# Initialize the OpenAI client using an API key stored in environment variables
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# ------------------------------------------------
# 🔒 Journal Encryption Settings (AES-256-GCM)
# ------------------------------------------------
# Retrieve the master encryption key from environment variables or use a default fallback
SECRET_KEY_B64 = os.environ.get("JOURNAL_AES_KEY", "x8V2kL9pR4mN7qW1zB3yH6cF0jD5tG8sA2vE4uX7oI0=")

# Define a function to encrypt plain text journal entries
def encrypt_journal(plain_text: str) -> str:
    if not plain_text: return "" # Return empty string if no text is provided
    key = base64.b64decode(SECRET_KEY_B64) # Decode the Base64 key into raw bytes
    aesgcm = AESGCM(key) # Create an AES-GCM cipher instance with the key
    nonce = os.urandom(12) # Generate a unique 12-byte initialization vector (nonce)
    # Encrypt the text and ensure it is encoded as UTF-8
    ciphertext = aesgcm.encrypt(nonce, plain_text.encode('utf-8'), None)
    # Return the combined nonce and ciphertext as a Base64 string
    return base64.b64encode(nonce + ciphertext).decode('utf-8')

# Define a function to decrypt encrypted journal entries
def decrypt_journal(encrypted_text_b64: str) -> str:
    if not encrypted_text_b64: return "" # Return empty string if input is null
    try:
        key = base64.b64decode(SECRET_KEY_B64) # Decode the Base64 key
        aesgcm = AESGCM(key) # Initialize the AES-GCM cipher
        encrypted_data = base64.b64decode(encrypted_text_b64) # Decode the Base64 ciphertext
        nonce = encrypted_data[:12] # Extract the first 12 bytes as the nonce
        ciphertext = encrypted_data[12:] # Extract the remaining bytes as the actual ciphertext
        # Decrypt and decode the resulting bytes back into a UTF-8 string
        return aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
    except Exception as e:
        print(f"❌ خطأ في فك التشفير: {e}") # Print error to console if decryption fails
        return "⚠️ [محتوى مشفر لا يمكن قراءته]" # Return a fallback message for unreadable content

# ------------------------------------------------
# ⚙️ Safetensors Engine (ZIP) & Google Drive Integration
# ------------------------------------------------
# Set the unique Google Drive ID for the trained model weights
FILE_ID = "1chP2XPiS9QkfLRZUrOVN1Md4xD4890cu" 
# Get the absolute path of the directory where the script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Define the local path where the model zip should be stored
ZIP_PATH = os.path.join(BASE_DIR, "model.zip")

# Initialize global variables for the AI model and its tokenizer
tokenizer = None
model = None
# Define the ordered list of emotion labels used by the model
LABELS = ["هادئ", "سعيد", "حزين", "غاضب", "متوتر", "تعبان"]

# Define the filename and full path for the Safetensors weight file
WEIGHTS_FILENAME = "model.safetensors" 
WEIGHTS_PATH = os.path.join(BASE_DIR, WEIGHTS_FILENAME)

# Define the setup function to prepare and load the AI model
def setup_ai():
    global tokenizer, model # Reference the global AI variables
    
    # Check if the model weights file exists locally
    if not os.path.exists(WEIGHTS_PATH):
        print(f"⏳ ملف الأوزان ({WEIGHTS_FILENAME}) غير موجود، جاري تحميله من Google Drive...")
        url = f'https://drive.google.com/uc?id={FILE_ID}' # Construct the Google Drive download URL
        try:
            gdown.download(url, WEIGHTS_PATH, quiet=False) # Download the weights using gdown
            print("✅ تم تحميل ملف الأوزان بنجاح!")
        except Exception as e:
            print(f"❌ فشل تحميل ملف الأوزان: {e}")
            raise e # Stop execution if the essential weights cannot be loaded

    print("🧠 جاري تحميل الأوزان في الذاكرة (نسخة 1 مايو)...")
    try:
        # Load the tokenizer from the local directory
        tokenizer = AutoTokenizer.from_pretrained(BASE_DIR)
        # Load the sequence classification model from the local directory
        model = AutoModelForSequenceClassification.from_pretrained(BASE_DIR)
        model.eval() # Set the model to evaluation mode for inference
        print("🚀 أبشرك.. نظام أناه جاهز وشغال 100%!")
    except Exception as e:
        print(f"❌ خطأ في تشغيل المحرك: {e}")
        # List files for debugging purposes if the loading process fails
        print(f"📁 الملفات اللي قدر السيرفر يشوفها: {os.listdir(BASE_DIR)}")
        raise e
# Call the setup function immediately upon script execution
setup_ai()

# ------------------------------------------------
#  Rule-Based Layer (Enhanced Emotion Dictionary)
# ------------------------------------------------
# Define a dictionary for keyword-based overrides to handle dialect and explicit terms
EXPLICIT_RULES = {
    "غاضب": "غاضب", "معصب": "غاضب", "متنرفز": "غاضب", 
    "منقهر": "غاضب", "مفور": "غاضب", "منفعل": "غاضب", "قهر": "غاضب", "غضب": "غاضب",
    "سعيد": "سعيد", "فرحان": "سعيد", "مبسوط": "سعيد", 
    "مستانس": "سعيد", "طاير": "سعيد", "مبهوج": "سعيد", "فرح": "سعيد", "رضا": "سعيد",
    "حزين": "حزين", "زعلان": "حزين", "متضايق": "حزين", 
    "مكتئب": "حزين", "مهموم": "حزين", "مقهور": "حزين", "حزن": "حزين", "ضيق": "حزين", "إحباط": "حزين",
    "تعبان": "تعبان", "مرهق": "تعبان", "هلكان": "تعبان", 
    "مهدود": "تعبان", "طافي": "تعبان", "دايخ": "تعبان", "مكسر": "تعبان", "تعب": "تعبان", "ارهاق": "تعبان",
    "متوتر": "متوتر", "قلقان": "متوتر", "مرتبك": "متوتر", 
    "خايف": "متوتر", "مخبوص": "متوتر", "مشغول": "متوتر", "توتر": "متوتر", "قلق": "متوتر",
    "هادئ": "هادئ", "رايق": "هادئ", "مروق": "هادئ", 
    "مرتاح": "هادئ", "مسترخي": "هادئ", "مفضي": "هادئ", "هدوء": "هادئ", "سكينة": "هادئ"
}

# Define a function to analyze a list of strings and predict emotions
def query_model(text_list):
    results = [] # Initialize a list to hold the results for each text segment
    try:
        for text in text_list:
            clean_text = text.strip() # Remove leading/trailing whitespace
            matched_label = None # Flag for keyword matches
            
            # Check for keyword matches in the rule-based dictionary
            for key, label in EXPLICIT_RULES.items():
                if key in clean_text:
                    matched_label = label # Set label if keyword found
                    break
            
            # If a keyword is found, return a 100% score for that label
            if matched_label:
                results.append({"label": matched_label, "score": 1.0})
                continue 

            # If no keyword found, use the deep learning model
            inputs = tokenizer(clean_text, return_tensors="pt", padding=True, truncation=True, max_length=128)
            with torch.no_grad(): # Disable gradient calculation for faster inference
                outputs = model(**inputs) # Get model logits
            
            # Apply Softmax to convert raw logits into probability scores
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            # Find the index of the highest probability
            best_idx = torch.argmax(probs).item()
            
            # Append the label and its confidence score to results
            results.append({
                "label": LABELS[best_idx],
                "score": float(probs[0][best_idx])
            })
        return results
    except Exception as e:
        print(f"❌ Analysis Error: {e}")
        return None

# ------------------------------------------------
# Chatbot Memory & Prompt
# ------------------------------------------------
# Dictionary to store the previous emotion to maintain context in conversation
last_emotion_memory = {}

# Define the persona and behavior guidelines for the GPT-based assistant
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
- لا تبالغ في التعاطف أو الدرامية.
- لا تقدم تشخيصات أو نصائح طبية.
- اجعل الرد يبدو إنسانياً وهادئاً ومتزنًا.
"""

# Define a function to split Arabic text into sentences based on punctuation
def split_arabic_sentences(text: str):
    sentences = re.split(r'[.؟!،\n]+', text) # Split by dots, question marks, commas, etc.
    return [s.strip() for s in sentences if len(s.strip()) > 3] # Return sentences longer than 3 chars

# ------------------------------------------------
#  Website Routes
# ------------------------------------------------
# Root route to serve the homepage
@app.route("/")
def index():
    return send_from_directory(".", "home.html")

# Endpoint to handle journal saving with encryption
@app.route("/save_journal", methods=["POST"])
def save_journal():
    data = request.get_json(silent=True) or {} # Get JSON data from request
    plain_text = (data.get("content") or "").strip() # Extract the content
    if not plain_text: return jsonify({"error": "No text"}), 400 # Error if empty
    encrypted_text = encrypt_journal(plain_text) # Encrypt text (demo logic)
    return jsonify({"status": "success", "message": "تم حفظ يومياتك بأمان وتشفيرها!"})

# Endpoint to simulate retrieving and decrypting journals
@app.route("/get_journals", methods=["GET"])
def get_journals():
    encrypted_from_db = [] # Placeholder for database query
    decrypted_journals = [] # List for decrypted results
    for journal in encrypted_from_db:
        original_text = decrypt_journal(journal["encrypted_content"]) # Decrypt each entry
        decrypted_journals.append({
            "date": journal["date"],
            "content": original_text
        })
    return jsonify({"journals": decrypted_journals})

# Core endpoint for emotion prediction
@app.route("/predict", methods=["POST"])
def predict():
    if model is None: # Return error if the AI model isn't ready
        return jsonify({"error": "المحرك لا يزال قيد التحميل، حاول بعد قليل"}), 503
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text: return jsonify({"error": "No text"}), 400
    sentences = split_arabic_sentences(text) or [text] # Split text into sentences
    results = query_model(sentences) # Run sentiment analysis
    if not results: return jsonify({"error": "AI Engine Error"}), 500
    mood_counts = {} # Counter for emotion frequencies
    mood_scores = {} # Summer for emotion probabilities
    sentence_details = [] # Detailed analysis per sentence
    for i, res in enumerate(results):
        mood = res["label"]
        score = res["score"]
        mood_counts[mood] = mood_counts.get(mood, 0) + 1
        mood_scores[mood] = mood_scores.get(mood, 0.0) + score
        sentence_details.append({"sentence": sentences[i], "mood": mood, "score": score})
    # Sort emotions by frequency and then by average score
    sorted_moods = sorted(mood_counts.keys(), key=lambda k: (mood_counts[k], mood_scores[k]), reverse=True)
    # Return primary mood, secondary mood, and full breakdown
    return jsonify({
        "finalMood": sorted_moods[0],
        "secondaryMood": sorted_moods[1] if len(sorted_moods) > 1 else None,
        "moodCounts": mood_counts,
        "sentencesDetails": sentence_details
    })

# Endpoint for the conversational chatbot
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or data.get("text") or "").strip()
    current_mood = (data.get("currentMood") or "غير محدد").strip()
    if len(user_message) < 2: return jsonify({"reply": "أنا هنا معك 🤍"}) # Handle very short messages
    try:
        casual_messages = ["هاي", "هلا", "السلام عليكم", "مرحبا", "كيفك", "تمام"]
        detected_emotion = current_mood # Fallback to user's selected mood
        should_analyze = len(user_message.split()) >= 4 # Only run AI analysis on longer messages
        if should_analyze:
            res = query_model([user_message])
            if res: detected_emotion = res[0]["label"]
        if user_message.strip().lower() in casual_messages:
            detected_emotion = current_mood # Prioritize selected mood for greetings
        last_emotion_memory["last"] = detected_emotion # Save to memory
        # Build the prompt for GPT-4o-mini including the emotional context
        prompt = f"المستخدم حالته: {current_mood}\nالشعور المستنتج: {detected_emotion}\nالرسالة: {user_message}"
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=80,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ]
        )
        # Return the generated response and the emotion context used
        return jsonify({
            "reply": response.choices[0].message.content.strip(),
            "emotion_used": detected_emotion
        })
    except Exception as e:
        return jsonify({"reply": "أنا هنا لأسمعك 🤍"})

# Main execution block to start the server
if __name__ == "__main__":
    # Get port from environment variables (useful for Render deployment) or use 10000
    port = int(os.environ.get("PORT", 10000))
    # Run the Flask app on host 0.0.0.0 to make it accessible externally
    app.run(host="0.0.0.0", port=port, debug=False)
