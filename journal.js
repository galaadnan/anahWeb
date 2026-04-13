/* ============================================================
   JOURNAL.JS - نسخة كاملة (Save + AI analysis + Status Modal + Show All + Clear Today + Rich Text Editor)
============================================================ */

/* ---------- 1) Status Modal بدل alert ---------- */
function showJournalStatus(message, type = "info") {
  const modal = document.getElementById("journalStatusModal");
  const msgEl = document.getElementById("journalStatusMessage");
  const titleEl = document.getElementById("journalStatusTitle");
  const iconEl = document.getElementById("journalStatusIcon");
  const closeBtn = document.getElementById("closeJournalStatusModal");

  if (!modal || !msgEl || !titleEl || !iconEl || !closeBtn) return;

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
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  }, { once: true });
}

/* ---------- Helpers ---------- */
function wordCount(t = "") {
  if (!t) return 0;
  const m = t.trim().match(/\S+/g);
  return m ? m.length : 0;
}

function isoToday() {
  return new Date().toISOString().split("T")[0]; 
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ---------- 🧠 ذاكرة محرر النصوص (لحفظ مكان المؤشر) ---------- */
let savedRange = null;

function saveSelection() {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    savedRange = selection.getRangeAt(0);
  }
}

function restoreSelection() {
  const noteEl = document.getElementById("note");
  noteEl.focus();
  if (savedRange) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }
}

window.formatDoc = function(cmd, value = null) {
  restoreSelection(); // نرجع المؤشر مكانه
  document.execCommand(cmd, false, value);
  saveSelection(); // نحفظ المكان الجديد
};

window.insertEmoji = function(emoji) {
  restoreSelection(); // نرجع المؤشر مكانه
  document.execCommand('insertHTML', false, emoji);
  const palette = document.getElementById("emojiPalette");
  if (palette) palette.hidden = true;
  saveSelection(); // نحفظ المكان الجديد
};

/* ---------- عناصر الصفحة ---------- */
const saveBtn = document.getElementById("save");
const clearTodayBtn = document.getElementById("clearToday");
const ratingText = document.getElementById("ratingText");
const todayEl = document.getElementById("journal-today");

let selectedRating = 0;

/* ---------- 2) تحليل المشاعر من السيرفر المحلي ---------- */
async function runLocalAnalysis(text) {
  try {
    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) throw new Error(`AI server error`);

    const data = await response.json();
    const finalMood = data.finalMood || data.mood || data.label || "غير محدد";
    const confidence = data.confidence ?? data.score ?? 0;
    const probabilities = data.probabilities || data.probs || {};

    return { finalMood, confidence, probabilities };
  } catch (error) {
    console.error("AI Server Error:", error);
    return { finalMood: "⚠️ فشل في الاتصال بالسيرفر", confidence: 0, probabilities: {} };
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

/* ---------- 4) حفظ مذكرة اليوم ---------- */
async function saveTodayEntry() {
  const noteEl = document.getElementById("note");
  const textContent = (noteEl.innerText || "").trim(); 
  const htmlContent = (noteEl.innerHTML || "").trim(); 

  if (!textContent && !htmlContent) {
    showJournalStatus("يرجى كتابة نص أو إضافة صورة أولاً", "error");
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

    const analysis = await runLocalAnalysis(textContent);
    const moodResult = analysis.finalMood;
    const today = isoToday();

    await firebase.firestore().collection("users").doc(user.uid).collection("entries").doc(today).set({
      text: textContent,
      html: htmlContent, 
      rating: selectedRating,
      words: wordCount(textContent),
      finalMood: moodResult, 
      confidence: analysis.confidence,
      probs: analysis.probabilities,
      savedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    showJournalStatus(`تم الحفظ والتحليل بنجاح! نتيجتك: ${moodResult}`, "success");
    noteEl.innerHTML = ""; 
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

/* ---------- 5) Clear Editor Content (Local Reset Only) ---------- */
function clearTodayEntry() {
  const noteEl = document.getElementById("note");
  
  if (noteEl) {
    noteEl.innerHTML = ""; // This clears all text, colors, and images from the editor
  }

  // Reset the star rating to zero
  selectedRating = 0;
  if (typeof initRating === "function") {
    initRating();
  }

  showJournalStatus("تم مسح النص من المربع.", "info");
}

/* ---------- 6) عرض كل المذكرات ---------- */
async function openAllEntriesModal() {
  const user = firebase.auth().currentUser;
  if (!user) {
    showJournalStatus("يرجى تسجيل الدخول أولاً", "error");
    return;
  }

  const viewModal = document.getElementById("viewModal");
  const viewContent = document.getElementById("viewContent");
  if (!viewModal || !viewContent) return;

  viewContent.innerHTML = `<div style="padding:14px"><p style="margin:0;color:#666">جاري تحميل المذكرات...</p></div>`;
  viewModal.hidden = false;
  document.getElementById("closeModal").onclick = () => (viewModal.hidden = true);
  viewModal.onclick = (e) => { if (e.target === viewModal) viewModal.hidden = true; };

  try {
    const snap = await firebase.firestore().collection("users").doc(user.uid).collection("entries").get();
    if (snap.empty) {
      viewContent.innerHTML = `<div style="padding:14px"><p style="margin:0">لا توجد مذكرات محفوظة بعد.</p></div>`;
      return;
    }

    const docs = [];
    snap.forEach((d) => docs.push(d));
    docs.sort((a, b) => b.id.localeCompare(a.id));

    let html = `<div style="padding:12px">`;
    docs.forEach((doc) => {
      const d = doc.data() || {};
      const contentHTML = d.html ? d.html : escapeHtml(d.text || "");
      html += `
        <div style="border:1px solid #eee;border-radius:14px;padding:12px;margin:10px 0;background:#fff">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <strong>${doc.id}</strong><span>${escapeHtml(d.finalMood || "غير محدد")}</span>
          </div>
          <div style="margin-top:6px;color:#777;font-size:0.9rem">⭐ ${d.rating || 0}/5 · 📝 ${d.words || 0} كلمة</div>
          <div style="margin-top:10px;white-space:pre-wrap;line-height:1.7;overflow-wrap:anywhere;">${contentHTML || "—"}</div>
        </div>
      `;
    });
    viewContent.innerHTML = html + `</div>`;
  } catch (err) {
    viewContent.innerHTML = `<div style="padding:14px"><p style="margin:0;color:#b00020">حدث خطأ أثناء تحميل المذكرات.</p></div>`;
  }
}

/* ============================================================
   ✅ 7) Achievements (زر عرض الإنجازات)
============================================================ */
function parseISODate(id) {
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
  const snap = await firebase.firestore().collection("users").doc(uid).collection("entries").get();
  const docs = [];
  snap.forEach((d) => docs.push(d));
  docs.sort((a, b) => a.id.localeCompare(b.id));
  return docs;
}

function computeStreaks(dateIdsAsc) {
  if (!dateIdsAsc.length) return { current: 0, best: 0 };
  let best = 1, run = 1;
  for (let i = 1; i < dateIdsAsc.length; i++) {
    const diff = daysBetween(parseISODate(dateIdsAsc[i - 1]), parseISODate(dateIdsAsc[i]));
    if (diff === 1) run++; else run = 1;
    if (run > best) best = run;
  }
  let current = 1;
  for (let i = dateIdsAsc.length - 1; i > 0; i--) {
    const diff = daysBetween(parseISODate(dateIdsAsc[i - 1]), parseISODate(dateIdsAsc[i]));
    if (diff === 1) current++; else break;
  }
  return { current, best };
}

function renderAchievements(listEl, stats) {
  if (!listEl) return;
  const achvs = [
    { title: "أول تدوينة", desc: "اكتب أول مذكرة لك.", unlocked: stats.totalEntries >= 1, badge: stats.totalEntries >= 1 ? "مفتوح" : "مغلق", icon: "✍️" },
    { title: "سلسلة ٣ أيام", desc: "اكتب 3 أيام متتالية.", unlocked: stats.bestStreak >= 3, badge: stats.bestStreak >= 3 ? "مفتوح" : `${Math.min(stats.bestStreak, 3)}/3`, icon: "🔥" },
    { title: "سلسلة أسبوع", desc: "اكتب 7 أيام متتالية.", unlocked: stats.bestStreak >= 7, badge: stats.bestStreak >= 7 ? "مفتوح" : `${Math.min(stats.bestStreak, 7)}/7`, icon: "🏆" },
    { title: "300 كلمة", desc: "اكتب 300 كلمة إجمالاً.", unlocked: stats.totalWords >= 300, badge: stats.totalWords >= 300 ? "مفتوح" : `${Math.min(stats.totalWords, 300)}/300`, icon: "📝" },
    { title: "يوم 5 نجوم", desc: "قيّم يومك 5/5 مرة واحدة.", unlocked: stats.hasFiveStar, badge: stats.hasFiveStar ? "مفتوح" : "مغلق", icon: "⭐" },
  ];
  listEl.innerHTML = achvs.map((a) => `
    <div class="achv-card ${a.unlocked ? "is-unlocked" : ""}">
      <div class="achv-content"><div class="achv-icon">${a.icon}</div><div class="achv-text"><strong>${a.title}</strong><small>${a.desc}</small></div></div>
      <div class="achv-badge">${a.badge}</div>
    </div>
  `).join("");
}

async function initAchievementsUI() {
  const btn = document.getElementById("showAchv");
  const box = document.getElementById("achievements");
  const list = document.getElementById("achvList");
  if (!btn || !box || !list) return;

  btn.addEventListener("click", async () => {
    const user = firebase.auth().currentUser;
    if (!user) { showJournalStatus("يرجى تسجيل الدخول أولاً", "error"); return; }
    
    box.hidden = !box.hidden;
    if (box.hidden) return;

    list.innerHTML = `<div style="padding:8px;color:#666">جاري تحميل الإنجازات...</div>`;
    try {
      const docs = await loadAllEntriesDocs(user.uid);
      const stats = {
        totalEntries: docs.length,
        totalWords: docs.reduce((sum, d) => sum + (Number(d.data()?.words) || 0), 0),
        hasFiveStar: docs.some((d) => Number(d.data()?.rating) === 5),
        ...computeStreaks(docs.map(d => d.id))
      };
      
      const curStreakEl = document.getElementById("curStreak");
      if (curStreakEl) curStreakEl.textContent = String(stats.current);
      const bestStreakEl = document.getElementById("bestStreak");
      if (bestStreakEl) bestStreakEl.textContent = String(stats.best);

      renderAchievements(list, stats);
    } catch (e) {
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
  document.getElementById("showAll")?.addEventListener("click", openAllEntriesModal);
  initAchievementsUI();

  // 1. مراقبة حركة المؤشر عشان نحفظ مكانه
  const noteEl = document.getElementById("note");
  if(noteEl) {
    noteEl.addEventListener("keyup", saveSelection);
    noteEl.addEventListener("mouseup", saveSelection);
    noteEl.addEventListener("focusout", saveSelection);
  }

  // 2. إغلاق قائمة الإيموجي إذا ضغطتي برا
  document.addEventListener("click", function(e) {
    const pal = document.getElementById("emojiPalette");
    const btn = document.getElementById("emojiBtn");
    if (pal && !pal.hidden && !pal.contains(e.target) && btn && !btn.contains(e.target)) {
      pal.hidden = true;
    }
  });

  // 3. تفعيل زر الإيموجي
  document.getElementById("emojiBtn")?.addEventListener("click", () => {
    const pal = document.getElementById("emojiPalette");
    if(pal) pal.hidden = !pal.hidden;
  });

  // 4. رفع وإدراج الصور (مع حفظ مكان المؤشر)
  document.getElementById("imageUpload")?.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        restoreSelection(); // نرجع المؤشر مكانه الصح
        document.execCommand('insertImage', false, event.target.result);
        saveSelection(); // نحفظ المكان الجديد بعد الصورة
      };
      reader.readAsDataURL(file);
      e.target.value = ''; // يخليك تقدرين ترفعين نفس الصورة مرة ثانية لو حذفتيها
    }
  });
});