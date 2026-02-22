/* ============================================================
   HOME.JS v2 – Stable (Greeting, Quotes, Mood, Tasks, Chatbot)
   ✅ Fixes:
   - No broken/missing mood section
   - Tasks work end-to-end (add/toggle/delete + counts + progress ring)
   - localStorage persistence + optional Firestore sync
   - Better chatbot + safety check
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  setGreeting();
  initQuotes();
  initMoodButtons();
  //initTaskSystem();
  initChatbot();
  initTodayUI();
});

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */
function isoToday() {
  return new Date().toISOString().split("T")[0];
}
function safeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function $(id) {
  return document.getElementById(id);
}

/* ------------------------------------------------------------
   0) Date / Header small UI
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

  const quotes = [
    "لا يجب أن يكون يومك مثاليًا حتى يكون مفيدًا.",
    "كل خطوة صغيرة تجاه نفسك هي إنجاز يُحسب لك.",
    "لا بأس لو لم تكن على ما يرام اليوم.",
    "التقدم الهادئ لا يزال تقدمًا.",
    "اهدأ… كل شيء يمر."
  ];

  let last = null;
  const pick = () => {
    let q = quotes[Math.floor(Math.random() * quotes.length)];
    if (q === last) q = quotes[Math.floor(Math.random() * quotes.length)];
    last = q;
    return q;
  };

  text.textContent = `"${pick()}"`;
  btn.addEventListener("click", () => (text.textContent = `"${pick()}"`));
}

/* ------------------------------------------------------------
   3) Mood Buttons – save + UI hint
------------------------------------------------------------ */
function initMoodButtons() {
  const buttons = document.querySelectorAll(".mood-buttons .mood");
  if (!buttons.length) return;

  // Create a small hint if not existing
  let hint = document.querySelector(".mood-save-hint");
  if (!hint) {
    hint = document.createElement("p");
    hint.className = "mood-save-hint";
    hint.style.cssText = "margin:10px 0 0;color:#666;font-size:.95rem;";
    const card = document.querySelector(".mood-card");
    if (card) card.appendChild(hint);
  }

  function setHint(moodName) {
    hint.textContent = `سجلنا شعورك الآن كـ: ${moodName} 💛 يمكنك تغييره في أي وقت.`;
  }

  // Restore
  const saved = localStorage.getItem("anah_current_mood");
  if (saved) setHint(saved);

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const moodName = btn.dataset.mood || "غير محدد";
      localStorage.setItem("anah_current_mood", moodName);

      // simple bounce
      btn.classList.add("pulse");
      setTimeout(() => btn.classList.remove("pulse"), 220);

      setHint(moodName);
    });
  });
}

/* ------------------------------------------------------------
   4) Tasks – full working system
------------------------------------------------------------ */
function initTaskSystem() {
  const form = $("newTaskForm");
  const saveBtn = $("saveTaskBtn");
  const descEl = $("taskDescription");
  const timeEl = $("taskTime");
  const listEl = $("taskList");

  if (!saveBtn || !descEl || !timeEl || !listEl) return;

  // Emoji picker
  const emojiWrap = $("emojiSelector");
  let selectedEmoji = "☀️";
  if (emojiWrap) {
    emojiWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".emoji");
      if (!btn) return;
      emojiWrap.querySelectorAll(".emoji").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      selectedEmoji = btn.textContent.trim() || "☀️";
    });
    // default active
    const first = emojiWrap.querySelector(".emoji");
    if (first) first.classList.add("is-active");
  }

  // Modals
  const emptyModal = $("emptyTaskModal");
  const closeEmpty = $("closeEmptyTaskModal");
  if (closeEmpty && emptyModal) closeEmpty.addEventListener("click", () => (emptyModal.hidden = true));

  const timeModal = $("timeAlertModal");
  const closeTime = $("closeTimeAlertModal");
  if (closeTime && timeModal) closeTime.addEventListener("click", () => (timeModal.hidden = true));

  // Storage key per-day
  const key = `anah_tasks_${isoToday()}`;

  function loadTasks() {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function saveTasks(tasks) {
    localStorage.setItem(key, JSON.stringify(tasks));
  }

  function updateCounters(tasks) {
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;

    const totalEl = $("tasksTotalCount");
    const doneEl = $("tasksDoneCount");
    if (totalEl) totalEl.textContent = String(total);
    if (doneEl) doneEl.textContent = String(done);

    // progress ring
    updateProgressRing(total ? Math.round((done / total) * 100) : 0);
  }

  function updateProgressRing(percent) {
    const text = $("progressText");
    if (text) text.textContent = `${percent}%`;

    const circle = document.querySelector(".progress-ring-fill");
    if (!circle) return;

    const r = circle.getAttribute("r");
    const radius = Number(r || 58);
    const circumference = 2 * Math.PI * radius;

    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (percent / 100) * circumference;
    circle.style.strokeDashoffset = String(offset);
  }

  function render() {
    const tasks = loadTasks();
    listEl.innerHTML = "";

    if (!tasks.length) {
      listEl.innerHTML = `<p style="color:#777;margin:6px 0">لا توجد مهام بعد.</p>`;
      updateCounters(tasks);
      return;
    }

    tasks.forEach((t) => {
      const row = document.createElement("div");
      row.className = "task-item";
      row.style.cssText =
        "display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;border:1px solid #eee;border-radius:14px;background:#fff;margin:8px 0;";

      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <button class="task-check" aria-label="toggle" style="width:36px;height:36px;border-radius:12px;border:1px solid #eee;background:${t.done ? "rgba(29,209,161,.15)" : "#fff"};cursor:pointer">
            ${t.done ? "✅" : "⬜️"}
          </button>
          <div>
            <div style="font-weight:700;display:flex;gap:8px;align-items:center">
              <span>${t.emoji}</span>
              <span style="${t.done ? "text-decoration:line-through;color:#777" : ""}">${escapeHtml(t.text)}</span>
            </div>
            <div style="color:#777;font-size:.9rem;margin-top:2px">⏱ ${t.minutes} دقيقة</div>
          </div>
        </div>
        <button class="task-del" aria-label="delete" style="border:none;background:transparent;color:#b00020;cursor:pointer;font-size:18px">✕</button>
      `;

      row.querySelector(".task-check").addEventListener("click", () => {
        const tasks2 = loadTasks().map(x => x.id === t.id ? { ...x, done: !x.done } : x);
        saveTasks(tasks2);
        render();
        syncTasksToFirestore(tasks2).catch(() => {});
      });

      row.querySelector(".task-del").addEventListener("click", () => {
        const tasks2 = loadTasks().filter(x => x.id !== t.id);
        saveTasks(tasks2);
        render();
        syncTasksToFirestore(tasks2).catch(() => {});
      });

      listEl.appendChild(row);
    });

    updateCounters(tasks);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function syncTasksToFirestore(tasks) {
    // optional: only if firebase loaded + logged in
    if (typeof firebase === "undefined") return;
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Save under users/{uid}/tasks/{YYYY-MM-DD}
    await firebase.firestore()
      .collection("users").doc(user.uid)
      .collection("tasks")
      .doc(isoToday())
      .set({ tasks, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  // Add task
  saveBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const text = descEl.value.trim();
    const minutes = Number(timeEl.value);

    if (!text) {
      if (emptyModal) emptyModal.hidden = false;
      return;
    }

    if (!minutes || minutes < 1) {
      if (timeModal) timeModal.hidden = false;
      return;
    }

    const task = { id: safeId(), text, minutes, emoji: selectedEmoji, done: false, createdAt: Date.now() };
    const tasks = loadTasks();
    tasks.unshift(task);
    saveTasks(tasks);

    descEl.value = "";
    timeEl.value = "";

    render();

    // sync optional
    try { await syncTasksToFirestore(tasks); } catch {}
  });

  // Prevent form submit reload
  if (form) {
    form.addEventListener("submit", (e) => e.preventDefault());
  }

  // initial render
  render();

  // If user logs in later, sync once
  if (typeof firebase !== "undefined") {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        await syncTasksToFirestore(loadTasks());
      } catch {}
    });
  }
}

/* ------------------------------------------------------------
  5) Chatbot – improved + simple safety
------------------------------------------------------------ */
function initChatbot() {
  const chatbotBtn = $("chatbotBtn");
  const chatWindow = $("chatWindow");
  const closeChatBtn = $("closeChat");
  const messagesEl = $("chatMessages");
  const inputEl = $("userMsgInput");
  const sendBtn = $("sendMsgBtn");

  if (!chatbotBtn || !chatWindow || !messagesEl || !inputEl || !sendBtn) return;

  function openChat() {
    chatWindow.classList.add("is-open");
    setTimeout(() => inputEl.focus(), 80);
  }
  function closeChat() {
    chatWindow.classList.remove("is-open");
  }

  chatbotBtn.addEventListener("click", openChat);
  if (closeChatBtn) closeChatBtn.addEventListener("click", closeChat);

  function appendMessage(text, sender = "user") {
    const msg = document.createElement("div");
    msg.classList.add("message");
    msg.classList.add(sender === "bot" ? "bot-msg" : "user-msg");
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  const replies = [
    "أسمعك 🤍.. تبغين تحكي لي أكثر عن اللي صار؟",
    "مفهوم… وش أكثر شيء متعبك اليوم؟",
    "خلّينا نمسكها خطوة خطوة… وش تحتاجين الآن؟",
    "حتى لو اليوم كان ثقيل، وجودك هنا ومحاولتك مهمّة جدًا.",
    "جربي نفس عميق: شهيق ٤ ثواني… زفير ٦ ثواني 🌿"
  ];

  function looksHighRisk(t) {
    const s = t.toLowerCase();
    return (
      s.includes("انتح") ||
      s.includes("اذي نفسي") ||
      s.includes("أؤذي نفسي") ||
      s.includes("ابي اموت") ||
      s.includes("أبي أموت")
    );
  }

  function botReply(userText) {
    if (!userText.trim()) return "اكتبي لي جملة بسيطة عن شعورك 🤍";

    if (looksHighRisk(userText)) {
      return "أنا آسف إنك تمرّين بشيء مؤلم 🤍 إذا كنتِ في خطر الآن أو تفكرين بإيذاء نفسك، تواصلي فورًا مع شخص قريب منك أو رقم الطوارئ في بلدك. إذا تبين، قولي لي في أي دولة أنتِ عشان أعطيك أرقام مساعدة مناسبة.";
    }

    return replies[Math.floor(Math.random() * replies.length)];
  }

  function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    inputEl.value = "";

    setTimeout(() => appendMessage(botReply(text), "bot"), 350);
  }

  sendBtn.addEventListener("click", handleSend);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}