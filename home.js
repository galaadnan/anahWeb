/* ============================================================
   HOME.JS – النسخة الصحيحة الكاملة لمشروع (أناه)
   ✅ Greeting
   ✅ Date
   ✅ Quotes from dataset + Firebase mood
   ✅ Mood emoji stays selected after refresh
   ✅ Saves mood locally + Firebase
   ✅ Chatbot (Updated to Render)
   ✅ Future message system
   ✅ IMPORTANT: Task system is handled by chicklist.js
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  setGreeting();
  initTodayUI();
  initFooterYear();
  initChatbot();
  initMoodButtons();
  initFutureMessages();

  // Firebase-dependent features
  if (hasFirebaseAuth()) {
    firebase.auth().onAuthStateChanged(async (user) => {
      await initQuotes();

      if (user) {
        await restoreEmojiMoodFromFirebase(user);
      }
    });
  } else {
    initQuotes();
  }
});

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

function isoToday() {
  return new Date().toISOString().split("T")[0];
}

function $(id) {
  return document.getElementById(id);
}

function hasFirebaseAuth() {
  return typeof firebase !== "undefined" && typeof firebase.auth === "function";
}

function hasFirestore() {
  return (
    typeof firebase !== "undefined" &&
    typeof firebase.firestore === "function"
  );
}

function safeParseJSON(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------
   0) Date / Header UI
------------------------------------------------------------ */

function initTodayUI() {
  const el = $("homeToday");

  if (el) {
    el.textContent = new Date().toLocaleDateString("ar-SA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }
}

function initFooterYear() {
  const yearEl = $("year");

  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

/* ------------------------------------------------------------
   1) Greeting
------------------------------------------------------------ */

function setGreeting() {
  const el = $("greeting");
  if (!el) return;

  const h = new Date().getHours();

  if (h >= 6 && h < 12) {
    el.textContent = "صباح الخير";
  } else if (h >= 12 && h < 18) {
    el.textContent = "مساء الهدوء";
  } else {
    el.textContent = "مساء الخير";
  }
}

/* ------------------------------------------------------------
   2) Quotes System
------------------------------------------------------------ */

let quotes = [];
let quotesLoaded = false;

function normalizeMood(raw) {
  if (!raw) return "هادئ";

  const mood = String(raw).toLowerCase().trim();

  if (
    mood.includes("happy") ||
    mood.includes("سعيد") ||
    mood.includes("فرح")
  ) {
    return "سعيد";
  }

  if (
    mood.includes("sad") ||
    mood.includes("حزين") ||
    mood.includes("حزن")
  ) {
    return "حزين";
  }

  if (
    mood.includes("angry") ||
    mood.includes("غاضب") ||
    mood.includes("غضب")
  ) {
    return "غاضب";
  }

  if (
    mood.includes("anx") ||
    mood.includes("قلق") ||
    mood.includes("توتر") ||
    mood.includes("worried")
  ) {
    return "متوتر";
  }

  if (
    mood.includes("tired") ||
    mood.includes("متعب") ||
    mood.includes("تعب")
  ) {
    return "متعب";
  }

  if (
    mood.includes("هادئ") ||
    mood.includes("calm") ||
    mood.includes("لا بأس")
  ) {
    return "هادئ";
  }

  return "هادئ";
}

async function loadQuotes() {
  if (quotesLoaded) return;

  try {
    const res = await fetch("anah_quotes_dataset.json");

    if (!res.ok) {
      throw new Error("Could not load anah_quotes_dataset.json");
    }

    const data = await res.json();

    quotes = Array.isArray(data)
      ? data
          .filter((q) => q && q.quote)
          .map((q) => ({
            quote: q.quote,
            mood: normalizeMood(q.mood)
          }))
      : [];

    quotesLoaded = true;
  } catch (error) {
    console.error("Error loading quotes:", error);
    quotesLoaded = true;
    quotes = [];
  }
}

function pickMoodQuote(mood) {
  const normalized = normalizeMood(mood);

  if (!quotes.length) {
    return "لا بأس أن تأخذي وقتك، خطوة صغيرة تكفي الآن 🤍";
  }

  const filtered = quotes.filter((q) => q.mood === normalized);
  const source = filtered.length ? filtered : quotes;

  return source[Math.floor(Math.random() * source.length)]?.quote || "🤍";
}

async function getLatestMoodFromFirebase() {
  const localMood = localStorage.getItem("anah_current_mood") || "هادئ";

  if (!hasFirebaseAuth() || !hasFirestore()) {
    return normalizeMood(localMood);
  }

  const user = firebase.auth().currentUser;

  if (!user) {
    return normalizeMood(localMood);
  }

  try {
    const db = firebase.firestore();
    const today = isoToday();

    // 1️⃣ الأولوية لليومية
    const journalDoc = await db
      .collection("users")
      .doc(user.uid)
      .collection("entries")
      .doc(today)
      .get();

    if (journalDoc.exists) {
      return normalizeMood(journalDoc.data()?.finalMood);
    }

    // 2️⃣ بعدها الإيموجي
    const emojiDoc = await db
      .collection("users")
      .doc(user.uid)
      .collection("emoji_moods")
      .doc(today)
      .get();

    if (emojiDoc.exists) {
      return normalizeMood(emojiDoc.data()?.mood);
    }

    // 3️⃣ fallback أخير
    return normalizeMood(localMood);

  } catch (error) {
    console.error("Could not get latest mood:", error);
    return normalizeMood(localMood);
  }
}

async function initQuotes() {
  const textEl = $("quoteText");
  const btn = $("newQuoteBtn");

  if (!textEl || !btn) return;

  await loadQuotes();

  const mood = await getLatestMoodFromFirebase();
  textEl.textContent = `"${pickMoodQuote(mood)}"`;

  btn.onclick = async () => {
    await loadQuotes();

    const latestMood = await getLatestMoodFromFirebase();
    textEl.textContent = `"${pickMoodQuote(latestMood)}"`;
  };
}

/* ------------------------------------------------------------
   3) Mood Buttons + Emoji Persistence
------------------------------------------------------------ */

function getMoodButtons() {
  return document.querySelectorAll(".mood-buttons .mood");
}

function ensureMoodHint() {
  let hint = document.querySelector(".mood-save-hint");

  if (!hint) {
    hint = document.createElement("p");
    hint.className = "mood-save-hint";
    hint.style.cssText =
      "margin:10px 0 0;color:#666;font-size:.95rem;text-align:center;";

    const card = document.querySelector(".mood-card-top");
    if (card) card.appendChild(hint);
  }

  return hint;
}

function clearActiveMoodUI() {
  const buttons = getMoodButtons();

  buttons.forEach((btn) => {
    btn.classList.remove("is-active");
    btn.classList.remove("active");
    btn.setAttribute("aria-pressed", "false");
  });
}

function setActiveMoodUI(moodName, saveLocal = true) {
  const buttons = getMoodButtons();
  const hint = ensureMoodHint();
  const normalizedMoodName = moodName || "هادئ";

  clearActiveMoodUI();

  const selectedButton = Array.from(buttons).find(
    (btn) => btn.dataset.mood === normalizedMoodName
  );

  if (selectedButton) {
    selectedButton.classList.add("is-active");
    selectedButton.classList.add("active");
    selectedButton.setAttribute("aria-pressed", "true");
  }

  if (hint) {
    hint.textContent = `سجلنا شعورك الآن كـ: ${normalizedMoodName} 💛 يمكنك تغييره في أي وقت.`;
  }

  if (saveLocal) {
    localStorage.setItem("anah_current_mood", normalizedMoodName);
  }
}

async function showEmojiChoiceModal() {
  return new Promise((resolve) => {
    const modal = $("emojiChoiceModal");
    const confirmBtn = $("confirmEmojiChoiceBtn");
    const cancelBtn = $("cancelEmojiChoiceBtn");

    if (!modal || !confirmBtn || !cancelBtn) {
      resolve(true);
      return;
    }

    modal.hidden = false;

    const cleanup = () => {
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
    };

    const onConfirm = () => {
      modal.hidden = true;
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      modal.hidden = true;
      cleanup();
      resolve(false);
    };

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
  });
}

async function restoreEmojiMoodFromFirebase(user) {
  if (!user || !hasFirestore()) return;

  try {
    const today = isoToday();
    const journalDoc = await firebase
      .firestore()
      .collection("users")
      .doc(user.uid)
      .collection("entries")
      .doc(today)
      .get();

    if (journalDoc.exists) {
      return;
    }

    const doc = await firebase
      .firestore()
      .collection("users")
      .doc(user.uid)
      .collection("emoji_moods")
      .doc(today)
      .get();

    if (doc.exists) {
      const mood = doc.data()?.mood;

      if (mood) {
        setActiveMoodUI(mood, true);
      }
    }
  } catch (error) {
    console.error("Could not restore emoji mood:", error);
  }
}

function initMoodButtons() {
  const buttons = getMoodButtons();
  if (!buttons.length) return;

  ensureMoodHint();

  // Restore immediately from localStorage after refresh
  const savedMood = localStorage.getItem("anah_current_mood");

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;

    const today = isoToday();

    const journalDoc = await firebase
      .firestore()
      .collection("users")
      .doc(user.uid)
      .collection("entries")
      .doc(today)
      .get();

    if (journalDoc.exists) {
      localStorage.removeItem("anah_current_mood");
      return;
    }

    if (savedMood) {
      setActiveMoodUI(savedMood, false);
    }
  });

  buttons.forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");

    btn.addEventListener("click", async () => {
      const moodName = btn.dataset.mood || "غير محدد";
      const user =
        hasFirebaseAuth() && firebase.auth().currentUser
          ? firebase.auth().currentUser
          : null;

      try {
        if (user && hasFirestore()) {
          const db = firebase.firestore();
          const today = isoToday();
          const userRef = db.collection("users").doc(user.uid);

          const journalDoc = await userRef
            .collection("entries")
            .doc(today)
            .get();

          if (journalDoc.exists) {
            const proceed = await showEmojiChoiceModal();

            if (!proceed) {
              return;
            }

            await userRef.collection("entries").doc(today).delete();
          }

          await userRef.collection("emoji_moods").doc(today).set(
            {
              mood: moodName,
              source: "emoji",
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );
        }
      } catch (error) {
        console.error("Could not save emoji mood to Firebase:", error);
      }

      // Save locally even if Firebase fails
      setActiveMoodUI(moodName, true);

      btn.classList.add("pulse");
      setTimeout(() => btn.classList.remove("pulse"), 220);

      await loadQuotes();

      const latestMood = normalizeMood(moodName);
      const quoteText = $("quoteText");

      if (quoteText) {
        quoteText.textContent = `"${pickMoodQuote(latestMood)}"`;
      }
    });
  });
}

/* ------------------------------------------------------------
   4) Chatbot
------------------------------------------------------------ */

function initChatbot() {
  const chatbotBtn = $("chatbotBtn");
  const chatWindow = $("chatWindow");
  const closeChatBtn = $("closeChat");
  const inputEl = $("userMsgInput");
  const sendBtn = $("sendMsgBtn");
  const messagesEl = $("chatMessages");

  if (!chatbotBtn || !chatWindow || !sendBtn || !inputEl || !messagesEl) {
    return;
  }

  chatbotBtn.onclick = () => {
    chatWindow.classList.toggle("is-open");
  };

  if (closeChatBtn) {
    closeChatBtn.onclick = () => {
      chatWindow.classList.remove("is-open");
    };
  }

  function appendMessage(message, sender) {
    const div = document.createElement("div");
    div.className = `message ${sender}-msg`;
    div.textContent = message;

    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function handleSend() {
  const text = inputEl.value.trim();

  if (!text) return;

  appendMessage(text, "user");
  inputEl.value = "";

  try {
    // ✅ نجيب الشعور الحالي من localStorage
    const currentMood =
      localStorage.getItem("anah_current_mood") || "غير محدد";

    // ✅ نرسل الرسالة + الشعور الحالي للباك إند
    const res = await fetch("https://anahweb.onrender.com/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        currentMood: currentMood
      })
    });

    if (!res.ok) {
      throw new Error("Chat request failed");
    }

    const data = await res.json();

    appendMessage(data.reply || "أنا معك 🤍", "bot");

  } catch (error) {
    console.error("Chatbot error:", error);
    appendMessage("عذراً، حدث خطأ في الاتصال 💔", "bot");
  }
}

  sendBtn.onclick = handleSend;

  inputEl.onkeydown = (event) => {
    if (event.key === "Enter") {
      handleSend();
    }
  };
}

/* ------------------------------------------------------------
   5) Future Messages
------------------------------------------------------------ */

function initFutureMessages() {
  const openBtn = $("openMessageModal");
  const modal = $("messageModal");
  const closeBtn = $("closeMessageModal");
  const saveMessageBtn = $("saveMessageBtn");
  const successModal = $("successModal");
  const closeSuccessModal = $("closeSuccessModal");
  const closeFutureMessageModal = $("closeFutureMessageModal");

  if (openBtn && modal) {
    openBtn.onclick = () => {
      modal.hidden = false;
    };
  }

  if (closeBtn && modal) {
    closeBtn.onclick = () => {
      modal.hidden = true;
    };
  }

  if (saveMessageBtn) {
    saveMessageBtn.onclick = () => {
      const input = $("futureMessageInput");
      const delayInput = $("messageDelay");

      if (!input || !delayInput) return;

      const text = input.value.trim();
      const days = parseInt(delayInput.value, 10);

      if (!text) {
        alert("اكتب رسالة أولاً 🤍");
        return;
      }

      const safeDays = Number.isNaN(days) ? 1 : days;

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + safeDays);

      const data = {
        message: text,
        showAt: futureDate.toISOString()
      };

      localStorage.setItem("futureMessage", JSON.stringify(data));

      if (modal) modal.hidden = true;
      if (successModal) successModal.hidden = false;

      input.value = "";
    };
  }

  if (closeSuccessModal && successModal) {
    closeSuccessModal.onclick = () => {
      successModal.hidden = true;
    };
  }

  if (closeFutureMessageModal) {
    closeFutureMessageModal.onclick = () => {
      const futureMessageModal = $("futureMessageModal");

      if (futureMessageModal) {
        futureMessageModal.hidden = true;
      }
    };
  }

  checkFutureMessage();
}

function checkFutureMessage() {
  const data = safeParseJSON(localStorage.getItem("futureMessage"), null);

  if (!data || !data.showAt || !data.message) return;

  const now = new Date();
  const showDate = new Date(data.showAt);

  if (now >= showDate) {
    const modal = $("futureMessageModal");
    const textEl = $("futureMessageText");

    if (modal && textEl) {
      textEl.textContent = data.message;
      modal.hidden = false;
    }

    localStorage.removeItem("futureMessage");
  }
}
