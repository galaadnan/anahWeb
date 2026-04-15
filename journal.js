/* ============================================================
   JOURNAL.JS - النسخة الاحترافية النهائية (أناه)
   ✅ الميزات: محرر نصوص متطور + معالجة تضارب البيانات (تخيير المستخدم)
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
  restoreSelection();
  document.execCommand(cmd, false, value);
  saveSelection();
};

window.insertEmoji = function(emoji) {
  restoreSelection();
  document.execCommand('insertHTML', false, emoji);
  const palette = document.getElementById("emojiPalette");
  if (palette) palette.hidden = true;
  saveSelection();
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
    return { finalMood: "⚠️ فشل الاتصال بالسيرفر", confidence: 0, probabilities: {} };
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

/* ---------- 4) حفظ مذكرة اليوم (مع المودال المطور) ---------- */
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

  const today = isoToday();
  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid);

  try {
    // 🔍 1. فحص هل يوجد إيموجي محفوظ؟
    const emojiDoc = await userRef.collection("emoji_moods").doc(today).get();
    
    if (emojiDoc.exists) {
      // 🚨 2. استخدام المودال المخصص بدلاً من confirm
      const userWantsToOverwrite = await showJournalChoiceModal();
      
      if (!userWantsToOverwrite) {
        showJournalStatus("تم إلغاء الحفظ. قررتِ الاحتفاظ بالإيموجي كمصدر للتحليل اليوم.", "info");
        return; 
      }

      // 3. حذف الإيموجي إذا وافقتِ
      await userRef.collection("emoji_moods").doc(today).delete();
    }

    // 4. عملية التحليل والحفظ
    saveBtn.disabled = true;
    saveBtn.textContent = "جاري التحليل والحفظ...";

    const analysis = await runLocalAnalysis(textContent);
    const moodResult = analysis.finalMood;

    await userRef.collection("entries").doc(today).set({
      text: textContent,
      html: htmlContent, 
      rating: selectedRating,
      words: wordCount(textContent),
      finalMood: moodResult, 
      confidence: analysis.confidence,
      probs: analysis.probabilities,
      savedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    showJournalStatus(`تم الحفظ بنجاح! نتيجتك: ${moodResult}`, "success");
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

/* ---------- 5) مسح النص من المربع ---------- */
function clearTodayEntry() {
  const noteEl = document.getElementById("note");
  if (noteEl) noteEl.innerHTML = "";
  selectedRating = 0;
  initRating();
  showJournalStatus("تم مسح النص من المربع.", "info");
}

/* ---------- 6) عرض كل المذكرات الموحد ---------- */
async function openAllEntriesModal() {
  const user = firebase.auth().currentUser;
  if (!user) return showJournalStatus("يرجى تسجيل الدخول أولاً", "error");

  const viewModal = document.getElementById("viewModal");
  const viewContent = document.getElementById("viewContent");
  if (!viewModal || !viewContent) return;

  viewContent.innerHTML = `<div style="padding:14px"><p style="margin:0;color:#666">جاري تحميل السجل الموحد...</p></div>`;
  viewModal.hidden = false;
  document.getElementById("closeModal").onclick = () => (viewModal.hidden = true);

  try {
    const db = firebase.firestore();
    const userRef = db.collection("users").doc(user.uid);

    // جلب المصدرين معاً للعرض
    const [emojiSnap, journalSnap] = await Promise.all([
      userRef.collection("emoji_moods").get(),
      userRef.collection("entries").get()
    ]);

    const historyMap = new Map();
    emojiSnap.forEach(d => historyMap.set(d.id, { mood: d.data().mood, type: 'إيموجي ✨', date: d.id }));
    journalSnap.forEach(d => historyMap.set(d.id, { 
      mood: d.data().finalMood, 
      html: d.data().html, 
      text: d.data().text, 
      rating: d.data().rating, 
      words: d.data().words, 
      type: 'يومية 📝', 
      date: d.id 
    }));

    const sortedList = Array.from(historyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    viewContent.innerHTML = `<div style="padding:12px">` + sortedList.map(item => `
      <div style="border:1px solid #eee;border-radius:14px;padding:12px;margin:10px 0;background:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>${item.date}</strong>
          <span>${escapeHtml(item.mood || "—")}</span>
        </div>
        <div style="color:#999;font-size:0.75rem;margin-top:2px">المصدر: ${item.type}</div>
        ${item.type === 'يومية 📝' ? `<div style="margin-top:6px;color:#777;font-size:0.85rem">⭐ ${item.rating || 0}/5 · 📝 ${item.words || 0} كلمة</div>` : ''}
        <div style="margin-top:10px;white-space:pre-wrap;line-height:1.7;overflow-wrap:anywhere;">${item.html || escapeHtml(item.text || "—")}</div>
      </div>
    `).join("") + `</div>`;

  } catch (err) {
    viewContent.innerHTML = `<div style="padding:14px;color:red">حدث خطأ أثناء تحميل البيانات.</div>`;
  }
}

/* ============================================================
   ✅ 7) Achievements (الإنجازات الموحدة)
============================================================ */
function parseISODate(id) {
  const [y, m, d] = String(id).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / ms);
}

async function initAchievementsUI() {
  const btn = document.getElementById("showAchv");
  const box = document.getElementById("achievements");
  const list = document.getElementById("achvList");
  if (!btn || !box || !list) return;

  btn.addEventListener("click", async () => {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    box.hidden = !box.hidden;
    if (box.hidden) return;

    list.innerHTML = `<div style="padding:8px;color:#666">تحديث الإنجازات...</div>`;
    try {
      const db = firebase.firestore();
      const userRef = db.collection("users").doc(user.uid);

      const [eSnap, jSnap] = await Promise.all([userRef.collection("emoji_moods").get(), userRef.collection("entries").get()]);
      
      // دمج التواريخ لحساب السلسلة (Streaks)
      const allDates = [...new Set([...eSnap.docs.map(d => d.id), ...jSnap.docs.map(d => d.id)])].sort();
      
      let best = 0, current = 0;
      if (allDates.length > 0) {
        let run = 1; best = 1;
        for (let i = 1; i < allDates.length; i++) {
          if (daysBetween(parseISODate(allDates[i-1]), parseISODate(allDates[i])) === 1) run++;
          else run = 1;
          if (run > best) best = run;
        }
        current = (daysBetween(parseISODate(allDates[allDates.length-1]), new Date()) <= 1) ? run : 0;
      }

      document.getElementById("curStreak").textContent = current;
      document.getElementById("bestStreak").textContent = best;

      const totalWords = jSnap.docs.reduce((sum, d) => sum + (Number(d.data()?.words) || 0), 0);
      const hasFiveStar = jSnap.docs.some(d => Number(d.data()?.rating) === 5);

      const achvs = [
        { title: "أول تدوينة", desc: "سجلت أول شعور لك.", unlocked: allDates.length >= 1, icon: "✍️" },
        { title: "سلسلة ٣ أيام", desc: "تابعت مشاعرك لـ ٣ أيام.", unlocked: best >= 3, icon: "🔥" },
        { title: "٣٠٠ كلمة", desc: "كتبت أكثر من ٣٠٠ كلمة.", unlocked: totalWords >= 300, icon: "📝" },
        { title: "يوم ٥ نجوم", desc: "قيّمت يومك بـ ٥ نجوم.", unlocked: hasFiveStar, icon: "⭐" }
      ];

      list.innerHTML = achvs.map(a => `
        <div class="achv-card ${a.unlocked ? "is-unlocked" : ""}">
          <div class="achv-content"><div class="achv-icon">${a.icon}</div><div class="achv-text"><strong>${a.title}</strong><small>${a.desc}</small></div></div>
          <div class="achv-badge">${a.unlocked ? "مفتوح" : "مغلق"}</div>
        </div>
      `).join("");
    } catch (e) { console.error(e); }
  });
}

/* ---------- 8) تهيئة الصفحة ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (todayEl) todayEl.textContent = isoToday();
  initRating();
  saveBtn?.addEventListener("click", saveTodayEntry);
  clearTodayBtn?.addEventListener("click", clearTodayEntry);
  document.getElementById("showAll")?.addEventListener("click", openAllEntriesModal);
  initAchievementsUI();

  const noteEl = document.getElementById("note");
  if(noteEl) ["keyup", "mouseup", "focusout"].forEach(ev => noteEl.addEventListener(ev, saveSelection));

  document.addEventListener("click", (e) => {
    const pal = document.getElementById("emojiPalette"), btn = document.getElementById("emojiBtn");
    if (pal && !pal.hidden && !pal.contains(e.target) && btn && !btn.contains(e.target)) pal.hidden = true;
  });

  document.getElementById("emojiBtn")?.addEventListener("click", () => {
    const p = document.getElementById("emojiPalette"); if(p) p.hidden = !p.hidden;
  });

  document.getElementById("imageUpload")?.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        restoreSelection();
        document.execCommand('insertImage', false, event.target.result);
        saveSelection();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  });
});
// دالة لإظهار مودال التخيير وارجاع قرار المستخدم (Promise)
function showJournalChoiceModal() {
  const modal = document.getElementById("journalChoiceModal");
  const confirmBtn = document.getElementById("confirmChoiceBtn");
  const cancelBtn = document.getElementById("cancelChoiceBtn");

  return new Promise((resolve) => {
    modal.hidden = false;

    confirmBtn.onclick = () => {
      modal.hidden = true;
      resolve(true); // وافق على استبدال الإيموجي
    };

    cancelBtn.onclick = () => {
      modal.hidden = true;
      resolve(false); // رفض وقرر الاحتفاظ بالإيموجي
    };
  });
}