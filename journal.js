/* ============================================================
   JOURNAL.JS - نسخة كاملة (Save + AI analysis + Status Modal + Show All + Clear Today)
   ✅ FIXED: Show All now loads entries WITHOUT Firestore orderBy(documentId)
            and sorts locally by doc.id (YYYY-MM-DD) to avoid query errors.
============================================================ */

/* ---------- 1) Status Modal بدل alert ---------- */
function showJournalStatus(message, type = "info") {
  const modal = document.getElementById("journalStatusModal");
  const msgEl = document.getElementById("journalStatusMessage");
  const titleEl = document.getElementById("journalStatusTitle");
  const iconEl = document.getElementById("journalStatusIcon");
  const closeBtn = document.getElementById("closeJournalStatusModal");

  if (!modal || !msgEl || !titleEl || !iconEl || !closeBtn) {
    console.log(message);
    return;
  }

  msgEl.textContent = message;

  if (type === "success") {
    titleEl.textContent = "تم بنجاح";
    iconEl.textContent = "🎉";
  } else if (type === "error") {
    titleEl.textContent = "تنبيه";
    iconEl.textContent = "⚠️";
  } else {
    titleEl.textContent = "معلومة";
    iconEl.textContent = "ℹ️";
  }

  modal.hidden = false;

  closeBtn.onclick = () => (modal.hidden = true);
  modal.addEventListener(
    "click",
    (e) => {
      if (e.target === modal) modal.hidden = true;
    },
    { once: true },
  );
}

/* ---------- Helpers ---------- */
function wordCount(t = "") {
  if (!t) return 0;
  const m = t.trim().match(/\S+/g);
  return m ? m.length : 0;
}

function isoToday() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ---------- عناصر الصفحة ---------- */
const note = document.getElementById("note");
const saveBtn = document.getElementById("save");
const clearTodayBtn = document.getElementById("clearToday");
const ratingText = document.getElementById("ratingText");
const todayEl = document.getElementById("journal-today");

let selectedRating = 0;

/* ---------- 2) تحليل المشاعر من السيرفر المحلي ---------- */
/* السيرفر يرجّع الآن mood جاهز مثل: "حزين 😔" أو "سعيد ✨" */
async function runLocalAnalysis(text) {
  try {
    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`AI server error ${response.status}: ${raw}`);
    }

    const data = await response.json();

    // ✅ السيرفر الجديد  const data = await response.json();

    // ✅ يدعم القديم والجديد ويمنع undefined
    const finalMood = data.finalMood || data.mood || data.label || "غير محدد";

    const confidence =
      typeof data.confidence === "number"
        ? data.confidence
        : typeof data.score === "number"
          ? data.score
          : 0;

    const probabilities = data.probabilities || data.probs || {};

    return { finalMood, confidence, probabilities };
  } catch (error) {
    console.error("AI Server Error:", error);
    return {
      finalMood: "⚠️ فشل في الاتصال بالسيرفر",
      confidence: 0,
      probabilities: {},
    };
  }
}

/* ---------- 3) نظام التقييم بالنجوم ---------- */
function initRating() {
  const ratingEl = document.getElementById("rating");
  if (!ratingEl) return;

  const stars = Array.from(ratingEl.querySelectorAll("button[data-v]"));

  function paint(n) {
    selectedRating = n;
    stars.forEach((btn) => {
      const v = Number(btn.dataset.v || "0");
      btn.classList.toggle("active", v <= n);
    });
    if (ratingText) ratingText.textContent = `قيّم يومك: ${n}/5`;
  }

  ratingEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-v]");
    if (btn) paint(Number(btn.dataset.v || "0"));
  });

  paint(0);
}

/* ---------- 4) حفظ مذكرة اليوم في Firestore ---------- */
async function saveTodayEntry() {
  const text = (note?.value || "").trim();
  if (!text) {
    showJournalStatus("يرجى كتابة نص أولاً", "error");
    return;
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    showJournalStatus("يرجى تسجيل الدخول أولاً", "error");
    return;
  }

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = "جاري التحليل والحفظ...";

    const analysis = await runLocalAnalysis(text);
    const moodResult = analysis.finalMood;
    const today = isoToday();

    await firebase
      .firestore()
      .collection("users")
      .doc(user.uid)
      .collection("entries")
      .doc(today) // ملاحظة: مذكرة واحدة لكل يوم
      .set(
        {
          text,
          rating: selectedRating,
          words: wordCount(text),
          finalMood: moodResult, // مثال: "حزين 😔"

          // ✅ ADDED (بدون تغيير أي شيء ثاني)
          confidence: analysis.confidence,
          probs: analysis.probabilities,

          savedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }, // ✅ ADDED
      );

    showJournalStatus(
      `تم الحفظ والتحليل بنجاح! نتيجتك: ${moodResult}`,
      "success",
    );
    note.value = "";
    selectedRating = 0;
    initRating();
  } catch (err) {
    console.error("Save Error:", err);
    showJournalStatus("حدثت مشكلة أثناء الحفظ.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "حفظ المذكرة";
  }
}

/* ---------- 5) مسح مذكرة اليوم ---------- */
async function clearTodayEntry() {
  const user = firebase.auth().currentUser;
  if (!user) {
    showJournalStatus("يرجى تسجيل الدخول أولاً", "error");
    return;
  }

  try {
    const today = isoToday();
    await firebase
      .firestore()
      .collection("users")
      .doc(user.uid)
      .collection("entries")
      .doc(today)
      .delete();

    showJournalStatus("تم مسح مذكرة اليوم.", "success");
    if (note) note.value = "";
    selectedRating = 0;
    initRating();
  } catch (err) {
    console.error("Delete Error:", err);
    showJournalStatus("تعذر مسح مذكرة اليوم.", "error");
  }
}

/* ---------- 6) عرض كل المذكرات داخل المودال (#viewModal) ---------- */
async function openAllEntriesModal() {
  const user = firebase.auth().currentUser;
  if (!user) {
    showJournalStatus("يرجى تسجيل الدخول أولاً", "error");
    return;
  }

  const viewModal = document.getElementById("viewModal");
  const viewContent = document.getElementById("viewContent");
  const closeModal = document.getElementById("closeModal");

  if (!viewModal || !viewContent || !closeModal) {
    showJournalStatus("نافذة العرض غير موجودة في الصفحة.", "error");
    return;
  }

  viewContent.innerHTML = `
    <div style="padding:14px">
      <p style="margin:0;color:#666">جاري تحميل المذكرات...</p>
    </div>
  `;
  viewModal.hidden = false;

  closeModal.onclick = () => (viewModal.hidden = true);
  viewModal.onclick = (e) => {
    if (e.target === viewModal) viewModal.hidden = true;
  };

  try {
    // ✅ FIX: no orderBy(documentId) to avoid Firestore errors
    const snap = await firebase
      .firestore()
      .collection("users")
      .doc(user.uid)
      .collection("entries")
      .get();

    if (snap.empty) {
      viewContent.innerHTML = `
        <div style="padding:14px">
          <p style="margin:0">لا توجد مذكرات محفوظة بعد.</p>
        </div>
      `;
      return;
    }

    // ✅ Sort locally by doc.id (YYYY-MM-DD)
    const docs = [];
    snap.forEach((d) => docs.push(d));
    docs.sort((a, b) => b.id.localeCompare(a.id));

    let html = `<div style="padding:12px">`;

    docs.forEach((doc) => {
      const d = doc.data() || {};
      const date = doc.id;
      const mood = d.finalMood || "غير محدد";
      const rating = typeof d.rating === "number" ? d.rating : 0;
      const words = typeof d.words === "number" ? d.words : 0;
      const text = escapeHtml(d.text || "");

      html += `
        <div style="border:1px solid #eee;border-radius:14px;padding:12px;margin:10px 0;background:#fff">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <strong>${date}</strong>
            <span>${escapeHtml(mood)}</span>
          </div>
          <div style="margin-top:6px;color:#777;font-size:0.9rem">
            ⭐ ${rating}/5 · 📝 ${words} كلمة
          </div>
          <p style="margin-top:10px;white-space:pre-wrap;line-height:1.7">${text || "—"}</p>
        </div>
      `;
    });

    html += `</div>`;
    viewContent.innerHTML = html;
  } catch (err) {
    console.error("Load entries error:", err);
    viewContent.innerHTML = `
      <div style="padding:14px">
        <p style="margin:0;color:#b00020">حدث خطأ أثناء تحميل المذكرات.</p>
      </div>
    `;
  }
}

/* ============================================================
   ✅ 7) Achievements (زر عرض الإنجازات + حساب الستريك + عرض البطاقات)
   - لا يحذف أي شيء من كودك، فقط إضافة كاملة
============================================================ */

function parseISODate(id) {
  // id = "YYYY-MM-DD"
  const [y, m, d] = String(id).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / ms);
}

async function loadAllEntriesDocs(uid) {
  const snap = await firebase
    .firestore()
    .collection("users")
    .doc(uid)
    .collection("entries")
    .get();

  const docs = [];
  snap.forEach((d) => docs.push(d));
  // sort ASC by date (needed for streak calc)
  docs.sort((a, b) => a.id.localeCompare(b.id));
  return docs;
}

function computeStreaks(dateIdsAsc) {
  // dateIdsAsc: ascending
  if (!dateIdsAsc.length) return { current: 0, best: 0 };

  // Best streak
  let best = 1;
  let run = 1;
  for (let i = 1; i < dateIdsAsc.length; i++) {
    const prev = parseISODate(dateIdsAsc[i - 1]);
    const cur = parseISODate(dateIdsAsc[i]);
    const diff = daysBetween(prev, cur);
    if (diff === 1) run++;
    else run = 1;
    if (run > best) best = run;
  }

  // Current streak: count back from last saved day, break when gap
  let current = 1;
  for (let i = dateIdsAsc.length - 1; i > 0; i--) {
    const prev = parseISODate(dateIdsAsc[i - 1]);
    const cur = parseISODate(dateIdsAsc[i]);
    if (daysBetween(prev, cur) === 1) current++;
    else break;
  }

  return { current, best };
}

function renderAchievements(listEl, stats) {
  if (!listEl) return;

  const achvs = [
    {
      key: "first",
      title: "أول تدوينة",
      desc: "اكتب أول مذكرة لك.",
      unlocked: stats.totalEntries >= 1,
      badge: stats.totalEntries >= 1 ? "مفتوح" : "مغلق",
      icon: "✍️",
    },
    {
      key: "streak3",
      title: "سلسلة ٣ أيام",
      desc: "اكتب 3 أيام متتالية.",
      unlocked: stats.bestStreak >= 3,
      badge: stats.bestStreak >= 3 ? "مفتوح" : `${Math.min(stats.bestStreak, 3)}/3`,
      icon: "🔥",
    },
    {
      key: "streak7",
      title: "سلسلة أسبوع",
      desc: "اكتب 7 أيام متتالية.",
      unlocked: stats.bestStreak >= 7,
      badge: stats.bestStreak >= 7 ? "مفتوح" : `${Math.min(stats.bestStreak, 7)}/7`,
      icon: "🏆",
    },
    {
      key: "words300",
      title: "300 كلمة",
      desc: "اكتب 300 كلمة إجمالاً.",
      unlocked: stats.totalWords >= 300,
      badge: stats.totalWords >= 300 ? "مفتوح" : `${Math.min(stats.totalWords, 300)}/300`,
      icon: "📝",
    },
    {
      key: "fiveStar",
      title: "يوم 5 نجوم",
      desc: "قيّم يومك 5/5 مرة واحدة.",
      unlocked: stats.hasFiveStar,
      badge: stats.hasFiveStar ? "مفتوح" : "مغلق",
      icon: "⭐",
    },
  ];

  listEl.innerHTML = achvs
    .map((a) => {
      const unlockedClass = a.unlocked ? "is-unlocked" : "";
      return `
        <div class="achv-card ${unlockedClass}">
          <div class="achv-content">
            <div class="achv-icon">${a.icon}</div>
            <div class="achv-text">
              <strong>${a.title}</strong>
              <small>${a.desc}</small>
            </div>
          </div>
          <div class="achv-badge">${a.badge}</div>
        </div>
      `;
    })
    .join("");
}

async function initAchievementsUI() {
  const btn = document.getElementById("showAchv");
  const box = document.getElementById("achievements");
  const list = document.getElementById("achvList");

  if (!btn || !box || !list) return;

  btn.addEventListener("click", async () => {
    const user = firebase.auth().currentUser;
    if (!user) {
      showJournalStatus("يرجى تسجيل الدخول أولاً", "error");
      return;
    }

    // Toggle open/close
    const willOpen = box.hidden === true;
    box.hidden = !willOpen;
    if (!willOpen) return;

    // Loading state
    list.innerHTML = `<div style="padding:8px;color:#666">جاري تحميل الإنجازات...</div>`;

    try {
      const docs = await loadAllEntriesDocs(user.uid);
      const dateIds = docs.map((d) => d.id);

      const totalEntries = docs.length;
      const totalWords = docs.reduce(
        (sum, d) => sum + (Number(d.data()?.words) || 0),
        0,
      );
      const hasFiveStar = docs.some((d) => Number(d.data()?.rating) === 5);

      const streaks = computeStreaks(dateIds);

      // تحديث كرت "سلسلة الكتابة" الموجود عندك (اختياري لكن مفيد)
      const curStreakEl = document.getElementById("curStreak");
      const bestStreakEl = document.getElementById("bestStreak");
      if (curStreakEl) curStreakEl.textContent = String(streaks.current);
      if (bestStreakEl) bestStreakEl.textContent = String(streaks.best);

      renderAchievements(list, {
        totalEntries,
        totalWords,
        hasFiveStar,
        currentStreak: streaks.current,
        bestStreak: streaks.best,
      });
    } catch (e) {
      console.error("Achievements error:", e);
      list.innerHTML = `<div style="padding:8px;color:#b00020">تعذر تحميل الإنجازات.</div>`;
    }
  });
}

/* ---------- 8) تهيئة الصفحة وربط الأزرار ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (todayEl) todayEl.textContent = isoToday();

  initRating();

  saveBtn?.addEventListener("click", saveTodayEntry);
  clearTodayBtn?.addEventListener("click", clearTodayEntry);

  // زر "عرض كل المذكرات"
  document
    .getElementById("showAll")
    ?.addEventListener("click", openAllEntriesModal);

  // ✅ زر "عرض الإنجازات"
  initAchievementsUI();
});