/* ============================================================
   ANALYZE.JS - النسخة الموحدة النهائية لمشروع (أناه)
   ✅ القرار التقني: دمج بيانات اليوميات والإيموجي في لوحة تحكم واحدة وشاملة.
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

/* ---------- مكتبة التوصيات (EVIDENCE_LIBRARY) ---------- */
const EVIDENCE_LIBRARY = [
  { id: "BREATH_4_6", forMoods: ["قلق", "غاضب", "حزين", "متعب", "لا بأس", "غير محدد"], title: "تنفّس بطيء (4/6)", steps: ["خذ شهيق 4 ثوانٍ", "ازفر 6 ثوانٍ", "كرر لمدة دقيقتين"], refsShort: ["تنفس بطيء (HRV)"], refsFull: ["Russo et al., 2017"] },
  { id: "GROUND_54321", forMoods: ["قلق", "غاضب", "غير محدد"], title: "تهدئة بالحواس (5-4-3-2-1)", steps: ["5 أشياء تراها", "4 تلمسها", "3 تسمعها", "2 تشمها", "1 تتذوقها"], refsShort: ["Grounding"], refsFull: ["Clinical coping technique"] },
  { id: "WRITE_3MIN", forMoods: ["حزين", "قلق", "غير محدد", "لا بأس"], title: "كتابة تعبيرية 3 دقائق", steps: ["اكتب 3 دقائق بلا توقف", "لا تهتم بالصياغة", "اختم: (ما أحتاجه الآن هو...)"], refsShort: ["كتابة تعبيرية"], refsFull: ["Pennebaker tradition"] },
  { id: "BA_ONE_STEP", forMoods: ["حزين", "متعب", "لا بأس"], title: "خطوة واحدة (تنشيط سلوكي)", steps: ["اختر نشاط 5–10 دقائق", "لاحظ شعورك بعده"], refsShort: ["تنشيط سلوكي"], refsFull: ["Cuijpers et al., 2007"] }
];

/* ---------- قوالب الرسائل الإيجابية ---------- */
const WOW_TEMPLATES = {
  intro: ["خلّينا ناخذها بهدوء 🤍", "خطوة صغيرة اليوم تكفي ✨", "اهدأ… كل شيء يمر."],
  insight: [
    (d) => `اليوم يبدو أنك أقرب إلى: ${d.todayMood}.`,
    (d) => `في ${d.daysLabel}، الأكثر ظهورًا كان: ${d.periodDominant}${d.secondMood ? ` ثم ${d.secondMood}` : ""}.`,
    (d) => d.volatility >= 60 ? "فيه تذبذب ملحوظ—خلّينا نركز على التهدئة." : "النمط يبدو مستقرًا نسبيًا."
  ],
  focus: ["خلّينا نختار تدخلين بسيطين لليوم."],
  outro: ["اللطف مع نفسك جزء من العلاج.", "جرّبي واحدة الآن."]
};

/* ---------- دوال المساعدة للتحليل ---------- */
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function normalizeMood(raw) {
  let m = String(raw || "غير محدد").trim().split(/\s+/)[0];
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
  const historyMap = new Map(); // نستخدم Map لمنع تكرار التاريخ (مبدأ المصدر الواحد)
  const user = firebase.auth().currentUser;
  if (!user) return { entryCounts, historyList: [] };

  const startISO = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid);

  // جلب المصدرين معاً (اليوميات والإيموجي)
  const [emojiSnap, journalSnap] = await Promise.all([
    userRef.collection("emoji_moods").where(firebase.firestore.FieldPath.documentId(), ">=", startISO).get(),
    userRef.collection("entries").where(firebase.firestore.FieldPath.documentId(), ">=", startISO).get()
  ]);

  // إضافة بيانات الإيموجي للـ Map
  emojiSnap.forEach(doc => {
    const mood = normalizeMood(doc.data().mood);
    historyMap.set(doc.id, { date: doc.id, dominant: mood, type: 'إيموجي ✨' });
  });

  // إضافة بيانات اليوميات (والتي ستغطي الإيموجي لنفس اليوم إذا وُجدت بفضل الـ Map)
  journalSnap.forEach(doc => {
    const mood = normalizeMood(doc.data().finalMood);
    historyMap.set(doc.id, { date: doc.id, dominant: mood, type: 'يومية 📝' });
  });

  // تحويل الـ Map إلى قائمة مرتبة زمنياً
  const historyList = Array.from(historyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  
  // حساب تكرار كل شعور
  historyList.forEach(item => {
    entryCounts[item.dominant] = (entryCounts[item.dominant] || 0) + 1;
  });

  return { entryCounts, historyList };
}

/* ---------- 2) رسم لوحة التحكم (Render Dashboard) ---------- */
async function renderDashboard(days) {
  const { entryCounts, historyList } = await loadUnifiedData(days);
  const totalEntries = historyList.length;

  // تحديث النصوص العلوية
  const analysisRangeEl = document.getElementById("analysisRange");
  if (analysisRangeEl) analysisRangeEl.textContent = (days === 7 ? "الأسبوع" : (days === 30 ? "آخر 30 يوم" : "آخر 90 يوم"));

  // تحديث الرسم البياني
  const labels = MOOD_ORDER.filter(m => (entryCounts[m] || 0) > 0);
  const values = labels.map(m => Math.round(((entryCounts[m] || 0) / totalEntries) * 100));
  updateChartUI(labels, values);

  // إظهار التوصيات بناءً على أحدث شعور موحد
  const latestItem = historyList.slice().pop();
  const todayMood = latestItem?.dominant || "غير محدد";
  const periodDominant = Object.entries(entryCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || "غير محدد";
  showRecommendations(todayMood, periodDominant, analysisRangeEl?.textContent || "الفترة", {
    daysLabel: analysisRangeEl?.textContent || "الفترة",
    todayMood, periodDominant, volatility: computeVolatility(historyList)
  });

  // تحديث سجل المشاعر مع إظهار المصدر
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
    `).join("") || '<p class="an-subtext">لا توجد بيانات لهذه الفترة.</p>';
  }

  // تحديث أعلى مشاعر ظهوراً
  const topEl = document.getElementById("topMoods");
  if (topEl) {
    topEl.innerHTML = Object.entries(entryCounts).sort((a,b) => b[1]-a[1]).slice(0,3).map(([m, c]) => `
      <div class="an-metric">
        <div class="an-metric-label"><img src="${MOOD_IMAGES[m]}" style="width:24px"> ${m}</div>
        <span class="an-metric-value">${Math.round((c/totalEntries)*100)}%</span>
      </div>
    `).join("") || '<p class="an-subtext">لا توجد بيانات كافية.</p>';
  }
}

/* ---------- 3) دوال واجهة المستخدم والرسوم البيانية ---------- */
function updateChartUI(labels, values) {
  const canvas = document.getElementById("moodChart");
  if (!canvas || typeof Chart === "undefined") return;
  if (!chartInstance) {
    chartInstance = new Chart(canvas, {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 10 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
    });
  }
  chartInstance.data.labels = labels;
  chartInstance.data.datasets[0].data = values;
  chartInstance.data.datasets[0].backgroundColor = labels.map(moodColor);
  chartInstance.update();
}

function computeVolatility(historyList) {
  if (historyList.length <= 1) return 0;
  let changes = 0;
  for (let i = 1; i < historyList.length; i++) if (historyList[i].dominant !== historyList[i-1].dominant) changes++;
  return Math.round((changes / (historyList.length - 1)) * 100);
}

/* ---------- تهيئة الصفحة عند التحميل ---------- */
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

// الدوال المتبقية (showRecommendations, buildWowQuote) تظل كما هي في كودك الأصلي...