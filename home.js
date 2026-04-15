/* ============================================================
   HOME.JS v2.2 – النسخة النهائية الموحدة لمشروع (أناه)
   ✅ التعديل: استخدام المودال المخصص بدلاً من confirm() التقليدي
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  setGreeting();
  initQuotes();
  initMoodButtons();
  initTaskSystem(); 
  initChatbot();
  initTodayUI();
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

/* ------------------------------------------------------------
   2) Quotes
------------------------------------------------------------ */
function initQuotes() {
  const btn = $("newQuoteBtn");
  const text = $("quoteText");
  if (!btn || !text) return;
  const quotes = ["لا يجب أن يكون يومك مثاليًا حتى يكون مفيدًا.", "كل خطوة صغيرة تجاه نفسك هي إنجاز يُحسب لك.", "لا بأس لو لم تكن على ما يرام اليوم.", "التقدم الهادئ لا يزال تقدمًا.", "اهدأ… كل شيء يمر."];
  const pick = () => quotes[Math.floor(Math.random() * quotes.length)];
  text.textContent = `"${pick()}"`;
  btn.addEventListener("click", () => (text.textContent = `"${pick()}"`));
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

    localStorage.setItem("anah_current_mood", moodName);
    return true;
  }

  const saved = localStorage.getItem("anah_current_mood");
  if (saved) setHint(saved);

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
    });
  });
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