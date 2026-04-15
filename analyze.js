/* ============================================================
   ANALYZE.JS - النسخة الموحدة النهائية والمصححة لمشروع (أناه)
   ✅ الحل: دمج ذكي، حماية من أخطاء الحساب، وسجلات مراقبة للبيانات.
============================================================ */

console.log("✅ analyze.js Unified Mode Loaded (Journal + Emoji Integration)");

let chartInstance = null;
const MOOD_ORDER = ["سعيد", "لا بأس", "حزين", "قلق", "غاضب", "متعب", "غير محدد"];

const MOOD_IMAGES = {
  "سعيد": "images/Habby.png",
  "لا بأس": "images/Ok.png",
  "غاضب": "images/Angry.png",
  "حزين": "images/Sad.png",
  "قلق": "images/worried.png",
  "متعب": "images/Tired.png",
  "غير محدد": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><text x='50%' y='50%' font-size='40' text-anchor='middle' dominant-baseline='middle'>❔</text></svg>"
};

/* ---------- دوال المساعدة للتحليل ---------- */
function normalizeMood(raw) {
  if (!raw) return "غير محدد";
  let m = String(raw).trim().split(/\s+/)[0]; // نأخذ أول كلمة (مثل "سعيد")
  if (m === "متوتر") m = "قلق";
  if (m === "تعبان") m = "متعب";
  if (m === "هادئ") m = "لا بأس";
  return MOOD_IMAGES[m] ? m : "غير محدد";
}

function moodColor(m) {
  const colors = {"غاضب": "#ff6b6b", "سعيد": "#1dd1a1", "حزين": "#54a0ff", "قلق": "#ff9f43", "متعب": "#feca57", "لا بأس": "#a29bfe"};
  return colors[m] || "#ccabd8";
}

/* ---------- 1) دالة جلب البيانات المدمجة (Unified Loader) ---------- */
async function loadUnifiedData(days) {
  const entryCounts = {};
  const historyMap = new Map();
  const user = firebase.auth().currentUser;
  if (!user) return { entryCounts, historyList: [] };

  const startISO = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid);

  try {
    const [emojiSnap, journalSnap] = await Promise.all([
      userRef.collection("emoji_moods").where(firebase.firestore.FieldPath.documentId(), ">=", startISO).get(),
      userRef.collection("entries").where(firebase.firestore.FieldPath.documentId(), ">=", startISO).get()
    ]);

    // سجل لمساعدتك في Debugging
    console.log(`📊 البيانات المكتشفة: ${emojiSnap.size} إيموجي، ${journalSnap.size} يوميات.`);

    emojiSnap.forEach(doc => {
      const moodRaw = doc.data().mood || doc.data().selectedMood; 
      const mood = normalizeMood(moodRaw);
      historyMap.set(doc.id, { date: doc.id, dominant: mood, type: 'إيموجي ✨' });
    });

    journalSnap.forEach(doc => {
      const mood = normalizeMood(doc.data().finalMood);
      historyMap.set(doc.id, { date: doc.id, dominant: mood, type: 'يومية 📝' });
    });

    const historyList = Array.from(historyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    historyList.forEach(item => { entryCounts[item.dominant] = (entryCounts[item.dominant] || 0) + 1; });

    return { entryCounts, historyList };
  } catch (error) {
    console.error("❌ فشل جلب البيانات:", error);
    return { entryCounts: {}, historyList: [] };
  }
}

/* ---------- 2) رسم لوحة التحكم (Render Dashboard) ---------- */
async function renderDashboard(days) {
  const { entryCounts, historyList } = await loadUnifiedData(days);
  const totalEntries = historyList.length;

  if (totalEntries === 0) {
    console.warn("⚠️ لا توجد بيانات لعرضها.");
    // تنظيف الواجهة إذا كانت فارغة
    document.getElementById("moodList").innerHTML = '<p class="an-subtext">لا توجد بيانات مسجلة لهذه الفترة.</p>';
    return;
  }

  // تحديث الرسم البياني
  const labels = MOOD_ORDER.filter(m => (entryCounts[m] || 0) > 0);
  const values = labels.map(m => Math.round((entryCounts[m] / totalEntries) * 100));
  updateChartUI(labels, values);

  // تحديث سجل المشاعر
  const listEl = document.getElementById("moodList");
  if (listEl) {
    listEl.innerHTML = historyList.slice().reverse().map(item => `
      <div class="an-mood-row">
        <div style="display:flex;align-items:center;gap:10px">
          <img src="${MOOD_IMAGES[item.dominant]}" style="width:36px" alt="${item.dominant}">
          <div>
            <strong>${item.dominant}</strong>
            <small style="display:block;color:#999;font-size:0.7rem">المصدر: ${item.type}</small>
          </div>
        </div>
        <span class="an-tag">${item.date}</span>
      </div>
    `).join("");
  }

  // تحديث أعلى مشاعر ظهوراً
  const topEl = document.getElementById("topMoods");
  if (topEl) {
    topEl.innerHTML = Object.entries(entryCounts).sort((a,b) => b[1]-a[1]).slice(0,3).map(([m, c]) => `
      <div class="an-metric">
        <div class="an-metric-label"><img src="${MOOD_IMAGES[m]}" style="width:24px"> ${m}</div>
        <span class="an-metric-value">${Math.round((c/totalEntries)*100)}%</span>
      </div>
    `).join("");
  }
}

function updateChartUI(labels, values) {
  const canvas = document.getElementById("moodChart");
  if (!canvas || typeof Chart === "undefined") return;
  if (chartInstance) chartInstance.destroy(); // تنظيف الرسم القديم لمنع التداخل

  chartInstance = new Chart(canvas, {
    type: "bar",
    data: { labels: labels, datasets: [{ data: values, backgroundColor: labels.map(moodColor), borderRadius: 10 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  firebase.auth().onAuthStateChanged(user => { if (user) renderDashboard(90); });
  document.querySelectorAll(".an-chip[data-range]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".an-chip[data-range]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderDashboard(parseInt(btn.dataset.range, 10));
    });
  });
});