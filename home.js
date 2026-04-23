/* ============================================================
   HOME.JS v2.2 – النسخة النهائية الموحدة لمشروع (أناه)
   ✅ التعديل: استخدام المودال المخصص بدلاً من confirm() التقليدي
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  setGreeting();
firebase.auth().onAuthStateChanged(async user => {
  if (user) {
    await initQuotes();
  }
});
  initMoodButtons();
  initTaskSystem(); 
  initChatbot();
  initTodayUI();

  
  // 👇 كود الرسالة هنا
  const openBtn = document.getElementById("openMessageModal");
  const modal = document.getElementById("messageModal");
  const closeBtn = document.getElementById("closeMessageModal");
  const saveMessageBtn = document.getElementById("saveMessageBtn");

  if (openBtn) {
    openBtn.addEventListener("click", () => {
      modal.hidden = false;
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.hidden = true;
    });
  }

  if (saveMessageBtn) {
    saveMessageBtn.addEventListener("click", () => {
      const text = document.getElementById("futureMessageInput").value;
      const days = parseInt(document.getElementById("messageDelay").value);

      if (!text.trim()) {
        alert("اكتب رسالة أولاً 🤍");
        return;
      }

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const data = {
        message: text,
        showAt: futureDate.toISOString()
      };

      localStorage.setItem("futureMessage", JSON.stringify(data));

      modal.hidden = true;
      document.getElementById("successModal").hidden = false;
    
    });
  }
    document.getElementById("closeSuccessModal").addEventListener("click", () => {
      document.getElementById("successModal").hidden = true;
});

  checkFutureMessage(); // 👈 هنا نقلناها

  const closeFutureBtn = document.getElementById("closeFutureMessageModal");

if (closeFutureBtn) {
  closeFutureBtn.addEventListener("click", () => {
    document.getElementById("futureMessageModal").hidden = true;
  });
}
});


/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

function isoToday() { return new Date().toISOString().split("T")[0]; }
function safeId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function $(id) { return document.getElementById(id); }
function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }


/* ------------------------------------------------------------
   0) Date / Header UI
------------------------------------------------------------ */
function initTodayUI() {
  const el = $("homeToday");
  if (el) el.textContent = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/* ------------------------------------------------------------
   1) Greeting
------------------------------------------------------------ */
function setGreeting() {
  const el = $("greeting");
  if (!el) return;
  const h = new Date().getHours();
  if (h >= 6 && h < 12) el.textContent = "صباح الخير";
  else if (h >= 12 && h < 18) el.textContent = "مساء الهدوء";
  else el.textContent = "مساء الخير";
}
/* =========================
   QUOTES SYSTEM (CLEAN)
========================= */

// 🔹 متغير عام للاقتباسات
let quotes = [];

/* -------------------------
   1) Normalize Mood
------------------------- */
function normalizeMood(raw) {
  if (!raw) return "لا بأس";

  const m = String(raw).trim();

  if (m.includes("سعيد") || m.includes("سعادة") || m.includes("فرح")) return "سعيد";
  if (m.includes("حزين") || m.includes("حزن")) return "حزين";
  if (m.includes("قلق") || m.includes("خوف") || m.includes("توتر")) return "قلق";

  return "لا بأس";
}

/* -------------------------
   2) Map Tags → Mood
------------------------- */
function mapTagToMood(tags) {
  if (!tags) return "لا بأس";

  if (tags.includes("حزن")) return "حزين";
  if (tags.includes("قلق")) return "قلق";

  if (
    tags.includes("سعادة") ||
    tags.includes("سعيد") ||
    tags.includes("فرح") ||
    tags.includes("حب")
  ) return "سعيد";

  return "لا بأس";
}

/* -------------------------
   3) Pick Quote
------------------------- */
function pickMoodQuote(mood) {
  console.log("mood:", mood);
  console.log("quotes count:", quotes.length);

  const filtered = quotes.filter(q => mapTagToMood(q.tags) === mood);

  console.log("filtered:", filtered.length);

  if (!filtered.length) {
    return "لا بأس إن لم تجد ما يناسبك الآن 🤍";
  }

  const random = filtered[Math.floor(Math.random() * filtered.length)];
  return random.quote;
}

/* -------------------------
   4) Get Mood From Analysis
------------------------- */
async function getLatestMoodFromFirebase() {
  const user = firebase.auth().currentUser;
  if (!user) return "لا بأس";

  const db = firebase.firestore();

  try {
    const snap = await db
      .collection("users")
      .doc(user.uid)
      .collection("entries")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) return "لا بأس";

    const data = snap.docs[0].data();

    console.log("entry:", data);

    if (!data.mood) return "لا بأس";

    return normalizeMood(data.mood);

  } catch (e) {
    console.error(e);
    return "لا بأس";
  }
}

/* -------------------------
   5) Load Quotes CSV
------------------------- */
async function loadQuotes() {
  const url = "https://raw.githubusercontent.com/BoulahiaAhmed/Arabic-Quotes-Dataset/main/Arabic_Quotes.csv";

  const res = await fetch(url);
  const text = await res.text();

  const lines = text.split("\n").slice(1);

  quotes = lines
    .map(line => {
      const parts = line.split(",");
      return {
        quote: parts[0]?.replace(/"/g, "").trim(),
        tags: parts[1]?.toLowerCase() || ""
      };
    })
    .filter(q => q.quote);
}

/* -------------------------
   6) Init Quotes
------------------------- */
async function initQuotes() {
  const textEl = document.getElementById("quoteText");
  const btn = document.getElementById("newQuoteBtn");

  if (!textEl || !btn) return;

  textEl.textContent = "جاري تحميل الاقتباسات...";

  await loadQuotes();

  const mood = await getLatestMoodFromFirebase();
  textEl.textContent = `"${pickMoodQuote(mood)}"`;

  // زر اقتباس جديد
  btn.onclick = async () => {
    const mood = await getLatestMoodFromFirebase();
    textEl.textContent = `"${pickMoodQuote(mood)}"`;
  };
}


/* ------------------------------------------------------------
   3) Mood Buttons – مع التخيير عبر المودال المخصص (Single Source of Truth)
------------------------------------------------------------ */

// دالة إظهار مودال التخيير لصفحة الإيموجي وارجاع قرار المستخدم
function showEmojiChoiceModal() {
  const modal = $("emojiChoiceModal");
  const confirmBtn = $("confirmEmojiChoiceBtn");
  const cancelBtn = $("cancelEmojiChoiceBtn");

  return new Promise((resolve) => {
    if (!modal) return resolve(true); // إذا لم يوجد المودال، اكمل العملية كحالة احتياطية
    modal.hidden = false;

    confirmBtn.onclick = () => { modal.hidden = true; resolve(true); };
    cancelBtn.onclick = () => { modal.hidden = true; resolve(false); };
  });
}

function initMoodButtons() {
  const buttons = document.querySelectorAll(".mood-buttons .mood");
  if (!buttons.length) return;

  let hint = document.querySelector(".mood-save-hint") || document.createElement("p");
  if (!hint.parentNode) {
    hint.className = "mood-save-hint";
    hint.style.cssText = "margin:10px 0 0;color:#666;font-size:.95rem;";
    document.querySelector(".mood-card")?.appendChild(hint);
  }

  function setHint(moodName) {
    hint.textContent = `سجلنا شعورك الآن كـ: ${moodName} 💛 يمكنك تغييره في أي وقت.`;
  }

  async function performMoodSave(moodName) {
    const today = isoToday();
    const user = firebase.auth().currentUser;
    if (!user) return;

    const db = firebase.firestore();
    const userRef = db.collection("users").doc(user.uid);

    // 🔍 الفحص: هل توجد يومية مسجلة؟
    const journalDoc = await userRef.collection("entries").doc(today).get();

    if (journalDoc.exists) {
      // 🚨 استخدام المودال المخصص بدلاً من confirm() التقليدي
      const userWantsToOverwrite = await showEmojiChoiceModal();
      
      if (!userWantsToOverwrite) {
        console.log("تم إلغاء العملية للحفاظ على اليومية.");
        return false; 
      }

      // حذف اليومية لضمان المصدر الواحد للحقيقة في صفحة التحليل
      await userRef.collection("entries").doc(today).delete();
      console.log("✅ تم حذف اليومية لاعتماد الإيموجي");
    }

    // حفظ الإيموجي في Firebase
    await userRef.collection("emoji_moods").doc(today).set({
      mood: moodName,
      source: "emoji",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return true;
  }


  buttons.forEach((btn) => {
   btn.addEventListener("click", async () => {
  const moodName = btn.dataset.mood || "غير محدد";

  const success = await performMoodSave(moodName);
  if (!success) return;

  buttons.forEach(b => b.classList.remove("is-active"));
  btn.classList.add("is-active");
  btn.classList.add("pulse");
  setTimeout(() => btn.classList.remove("pulse"), 220);

  setHint(moodName);

  const quoteText = document.getElementById("quoteText");
 if (quoteText) {
  if (!quotes.length) {
    await initQuotes(); // حمّلها لو ما كانت جاهزة
  }

  const latestMood = normalizeMood(moodName);
  quoteText.textContent = `"${pickMoodQuote(latestMood)}"`;
}
});
}); // ← تقفل forEach

} 
/* ------------------------------------------------------------
   4) Tasks System
------------------------------------------------------------ */
function initTaskSystem() {
  const saveBtn = $("saveTaskBtn");
  const descEl = $("taskDescription");
  const timeEl = $("taskTime");
  const listEl = $("taskList");
  if (!saveBtn || !descEl || !timeEl || !listEl) return;

  const emojiWrap = $("emojiSelector");
  let selectedEmoji = "☀️";
  if (emojiWrap) {
    emojiWrap.onclick = (e) => {
      const btn = e.target.closest(".emoji");
      if (!btn) return;
      emojiWrap.querySelectorAll(".emoji").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      selectedEmoji = btn.textContent.trim();
    };
  }

  const key = `anah_tasks_${isoToday()}`;
  const loadTasks = () => JSON.parse(localStorage.getItem(key) || "[]");
  const saveTasks = (tasks) => localStorage.setItem(key, JSON.stringify(tasks));

  function render() {
    const tasks = loadTasks();
    listEl.innerHTML = tasks.length ? "" : `<p style="color:#777;margin:6px 0">لا توجد مهام بعد.</p>`;
    tasks.forEach(t => {
      const row = document.createElement("div");
      row.className = "task-item";
      row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid #eee;border-radius:14px;background:#fff;margin:8px 0;";
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <button class="task-check" style="cursor:pointer; border:none; background:none;">${t.done ? "✅" : "⬜️"}</button>
          <div style="${t.done ? "text-decoration:line-through;color:#777" : ""}">
            <strong>${t.emoji} ${escapeHtml(t.text)}</strong>
            <div style="font-size:0.8rem; color:#888;">⏱ ${t.minutes} دقيقة</div>
          </div>
        </div>
        <button class="task-del" style="border:none;background:none;color:#b00020;cursor:pointer;">✕</button>`;
      
      row.querySelector(".task-check").onclick = () => {
        const updated = loadTasks().map(x => x.id === t.id ? { ...x, done: !x.done } : x);
        saveTasks(updated); render();
      };
      row.querySelector(".task-del").onclick = () => {
        const updated = loadTasks().filter(x => x.id !== t.id);
        saveTasks(updated); render();
      };
      listEl.appendChild(row);
    });
  }

  saveBtn.onclick = () => {
    const text = descEl.value.trim(), minutes = Number(timeEl.value);
    if (!text) { $("emptyTaskModal").hidden = false; return; }
    if (!minutes || minutes < 1) { $("timeAlertModal").hidden = false; return; }

    const tasks = loadTasks();
    tasks.unshift({ id: safeId(), text, minutes, emoji: selectedEmoji, done: false });
    saveTasks(tasks);
    descEl.value = ""; timeEl.value = ""; render();
  };
  render();
}

/* ------------------------------------------------------------
   5) Chatbot
------------------------------------------------------------ */
function initChatbot() {
  const chatbotBtn = $("chatbotBtn"), chatWindow = $("chatWindow"), inputEl = $("userMsgInput"), sendBtn = $("sendMsgBtn"), messagesEl = $("chatMessages");
  if (!chatbotBtn || !chatWindow || !sendBtn) return;
  chatbotBtn.onclick = () => chatWindow.classList.toggle("is-open");
  $("closeChat").onclick = () => chatWindow.classList.remove("is-open");
  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    const append = (msg, sender) => {
      const d = document.createElement("div"); d.className = `message ${sender}-msg`; d.textContent = msg;
      messagesEl.appendChild(d); messagesEl.scrollTop = messagesEl.scrollHeight;
    };
    append(text, "user"); inputEl.value = "";
    try {
      const res = await fetch("http://127.0.0.1:8000/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      const data = await res.json();
      append(data.reply || "🤍", "bot");
    } catch { append("عذراً، حدث خطأ في الاتصال 💔", "bot"); }
  }
  sendBtn.onclick = handleSend;
  inputEl.onkeydown = (e) => { if (e.key === "Enter") handleSend(); };
}
function checkFutureMessage() {
  const data = JSON.parse(localStorage.getItem("futureMessage"));

  if (!data) return;

  const now = new Date();
  const showDate = new Date(data.showAt);

  if (now >= showDate) {
    const modal = document.getElementById("futureMessageModal");
    const textEl = document.getElementById("futureMessageText");

    if (modal && textEl) {
      textEl.textContent = data.message;
      modal.hidden = false;
    }

    localStorage.removeItem("futureMessage");
  }
}
