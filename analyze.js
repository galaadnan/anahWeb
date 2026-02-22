console.log("✅ analyze.js v4 loaded (premium)");

let chartInstance = null;

// ثابت ترتيب المشاعر (عشان الرسم ما يتغير ترتيب أعمدته كل مرة)
const MOOD_ORDER = ["سعيد", "لا بأس", "حزين", "قلق", "غاضب", "متعب", "غير محدد"];

const MOOD_IMAGES = {
  "سعيد": "images/Habby.png",
  "لا بأس": "images/Ok.png",
  "غاضب": "images/Angry.png",
  "حزين": "images/Sad.png",
  "قلق": "images/worried.png",
  "متعب": "images/Tired.png",
  "غير محدد":
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><text x='50%' y='50%' font-size='40' text-anchor='middle' dominant-baseline='middle'>❔</text></svg>"
};
/* =========================
   Personalized Recommendations
========================= */
const RECOMMENDATIONS = {
  "حزين": {
    quote: "لا بأس لو لم تكن على ما يرام اليوم.",
    quick: [
      "اكتب ما تشعر به دون تفكير لمدة 3 دقائق.",
      "تنفّس ببطء 4-4-6 لمدة دقيقتين.",
      "تحرّك قليلًا أو غيّر مكانك."
    ],
    daily: [
      "تواصل مع شخص تثق به.",
      "دلّل نفسك بشيء بسيط تحبه."
    ]
  },

  "قلق": {
    quote: "اهدأ… أنت تبذل ما بوسعك.",
    quick: [
      "تمرّن 5-4-3-2-1 للتركيز.",
      "اكتب ما يقلقك ثم خطه.",
      "أغلق الإشعارات 15 دقيقة."
    ],
    daily: [
      "قسّم مهامك إلى خطوة واحدة فقط.",
      "نم مبكرًا أو خفّف المنبهات."
    ]
  },

  "غاضب": {
    quote: "التوقف لحظة قد يمنع ندمًا طويلًا.",
    quick: [
      "اشرب ماء وخذ نفسًا عميقًا.",
      "اكتب سبب غضبك ثم اترك الورقة.",
      "حرّك جسمك لتفريغ التوتر."
    ],
    daily: [
      "ضع حدودك بهدوء.",
      "غيّر الجو من حولك."
    ]
  },

  "سعيد": {
    quote: "استمتع بهذه اللحظة، فهي لك.",
    quick: [
      "دوّن سبب شعورك بالسعادة.",
      "شارك شعورك مع شخص تحبه."
    ],
    daily: [
      "كرّر ما أسعدك اليوم.",
      "خطّط لشيء جميل غدًا."
    ]
  },

  "متعب": {
    quote: "الراحة ليست كسلًا، بل حاجة.",
    quick: [
      "اشرب ماء أو تناول وجبة خفيفة.",
      "خذ قيلولة قصيرة.",
      "خفّف أهداف اليوم."
    ],
    daily: [
      "نم مبكرًا.",
      "جهّز مهام الغد ببساطة."
    ]
  },

  "لا بأس": {
    quote: "ثباتك اليوم إنجاز بحد ذاته.",
    quick: [
      "تنفّس ببطء دقيقة واحدة.",
      "اكتب شي واحد إيجابي صار اليوم.",
      "اشرب ماء وخذ استراحة قصيرة."
    ],
    daily: [
      "حافظ على روتين بسيط.",
      "سوِ شيء تحبه حتى لو صغير."
    ]
  },

  "غير محدد": {
    quote: "ابدأ بخطوة صغيرة… وستوضح الصورة.",
    quick: [
      "اكتب جملة واحدة عن يومك."
    ],
    daily: [
      "اكتب يومية جديدة ثم أعد التحليل."
    ]
  }
};

function cleanMood(m) {
  if (!m || typeof m !== "string") return "غير محدد";
  return m.trim().split(/\s+/)[0];
}

function normalizeMood(raw) {
  let m = cleanMood(raw);
  if (m === "متوتر") m = "قلق";
  if (m === "تعبان") m = "متعب";
  if (m === "هادئ") m = "لا بأس";
  return MOOD_IMAGES[m] ? m : "غير محدد";
}

function moodColor(m) {
  if (m === "غاضب") return "#ff6b6b";
  if (m === "سعيد") return "#1dd1a1";
  if (m === "حزين") return "#54a0ff";
  if (m === "قلق")  return "#ff9f43";
  if (m === "متعب") return "#feca57";
  if (m === "لا بأس") return "#a29bfe";
  return "#ccabd8";
}

function isoDate(d) {
  return d.toISOString().split("T")[0];
}

function setChartEmptyState(isEmpty, text = "لا توجد بيانات لهذه الفترة.") {
  const wrap = document.querySelector(".an-chart-wrap");
  if (!wrap) return;

  let el = wrap.querySelector("#chartEmptyState");
  if (!el) {
    el = document.createElement("div");
    el.id = "chartEmptyState";
    el.style.cssText =
      "margin-top:10px;padding:10px;border-radius:12px;background:rgba(255,255,255,.6);color:#666;font-size:.95rem;text-align:center;display:none;";
    wrap.appendChild(el);
  }

  el.textContent = text;
  el.style.display = isEmpty ? "block" : "none";
}

function animateCount(el, to, duration = 600) {
  if (!el) return;
  const from = 0;
  const start = performance.now();

  function step(now) {
    const p = Math.min(1, (now - start) / duration);
    const val = Math.round(from + (to - from) * p);
    el.textContent = `${val}%`;
    if (p < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}
function showRecommendations(todayMood, weeklyMood, daysLabel) {
  // عندك normalizeMood جاهز، فنستخدمه بدل MOOD_MAPPING
  const today = normalizeMood(todayMood || "غير محدد");
  const week  = normalizeMood(weeklyMood || "غير محدد");

  const rec = RECOMMENDATIONS[today] || RECOMMENDATIONS["غير محدد"];

  const qEl = document.getElementById("recQuote");
  const quickEl = document.getElementById("recQuick");
  const dailyEl = document.getElementById("recDaily");
  const weekEl = document.getElementById("recWeekNote");

  // إذا الكارد مو موجود في HTML، لا نسوي شيء
  if (!qEl || !quickEl || !dailyEl) return;

  qEl.textContent = `“${rec.quote}”`;
  quickEl.innerHTML = rec.quick.map(item => `<li>${item}</li>`).join("");
  dailyEl.innerHTML = rec.daily.map(item => `<li>${item}</li>`).join("");

  if (weekEl) {
    const label = daysLabel || "الفترة";
    weekEl.textContent = `نمط ${label} الغالب: ${week}`;
  }
}

async function loadAnalyzedData(days) {
  const totalScores = {};
  const historyList = [];
  let totalWords = 0;

  const user = firebase.auth().currentUser;
  if (!user) return { totalScores, historyList, totalWords };

  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - days + 1);

  const startISO = isoDate(start);
  const endISO = isoDate(now);

  console.log("📅 Range:", startISO, "->", endISO);

  const snap = await firebase.firestore()
    .collection("users").doc(user.uid)
    .collection("entries")
    .where(firebase.firestore.FieldPath.documentId(), ">=", startISO)
    .where(firebase.firestore.FieldPath.documentId(), "<=", endISO)
    .get();

  console.log("📦 entries:", snap.size);

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const date = doc.id;

    const mood = normalizeMood(data.finalMood || "غير محدد");
    const words = Number(data.words || 0);
    totalWords += words;

    totalScores[mood] = (totalScores[mood] || 0) + (words || 1);
    historyList.push({ date, dominant: mood });
  });

  return { totalScores, historyList, totalWords };
}

function ensureChart(canvas) {
  if (!canvas || typeof Chart === "undefined") return null;

  // لو أول مرة: أنشئ chart
  if (!chartInstance) {
    chartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: [],
        datasets: [{
          label: "النسبة المئوية للكلمات",
          data: [],
          backgroundColor: [],
          borderRadius: 10,
          hoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,

        animation: { duration: 900, easing: "easeOutQuart" },

        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (t) => (t.parsed.y ?? 0) + "%"
            }
          }
        },
        scales: {
          x: {
            ticks: { font: { size: 12 } }
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: (v) => v + "%" }
          }
        }
      }
    });
  }
  return chartInstance;
}

async function renderDashboard(days) {
  const { totalScores, historyList, totalWords } = await loadAnalyzedData(days);

  // ---- Prepare chart data with stable order
  const orderedLabels = MOOD_ORDER.filter(m => totalScores[m] != null && totalScores[m] > 0);
  const labels = orderedLabels.length ? orderedLabels : [];

  const values = labels.map(m =>
    totalWords ? Math.round((totalScores[m] / totalWords) * 100) : 0
  );
  const colors = labels.map(moodColor);

  // ---- Chart
  const canvas = document.getElementById("moodChart");
  const chart = ensureChart(canvas);

  if (!labels.length) {
    setChartEmptyState(true, "لا توجد بيانات لهذه الفترة. جرّبي ٣٠ يوم أو اكتبي مذكرات أكثر 🤍");
    if (chart) {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      chart.update();
    }
  } else {
    setChartEmptyState(false);

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].backgroundColor = colors;

      // ✅ تحديث ناعم بدل destroy
      chart.update();
    }
  }

  // ---- Top Moods
  const topEl = document.getElementById("topMoods");
  if (topEl) {
    topEl.innerHTML = "";

    const sorted = Object.entries(totalScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const total = Object.values(totalScores).reduce((a, b) => a + b, 0);

    if (!sorted.length) {
      topEl.innerHTML = `<p class="an-subtext">لا توجد بيانات.</p>`;
    } else {
      sorted.forEach(([m, s]) => {
        const pct = total ? Math.round((s / total) * 100) : 0;

        // عنصر فيه رقم متحرك
        const row = document.createElement("div");
        row.className = "an-metric";
        row.innerHTML = `
          <div class="an-metric-label" style="display:flex;align-items:center;gap:10px">
            <img src="${MOOD_IMAGES[m] || MOOD_IMAGES["غير محدد"]}" style="width:30px">
            <span>${m}</span>
          </div>
          <span class="an-metric-value" data-pct="1">0%</span>
        `;
        topEl.appendChild(row);

        const valEl = row.querySelector("[data-pct='1']");
        animateCount(valEl, pct, 650);
      });
    }
  }
  // ---- Recommendations (today + period dominant)
  let weeklyDominant = "غير محدد";
  const weekSorted = Object.entries(totalScores).sort((a, b) => b[1] - a[1]);
  if (weekSorted.length) weeklyDominant = weekSorted[0][0];

  let todayMood = "غير محدد";
  if (historyList.length) {
    // historyList عندك فيه { date, dominant }
    const latest = historyList.slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
    todayMood = latest?.dominant || "غير محدد";
  }

  const daysLabel =
    days === 7 ? "الأسبوع" :
    (days === 30 ? "آخر 30 يوم" :
    (days === 90 ? "آخر 90 يوم" : "الفترة"));

  showRecommendations(todayMood, weeklyDominant, daysLabel);
  // ---- List (latest first)
  const listEl = document.getElementById("moodList");
  if (listEl) {
    listEl.innerHTML = "";

    historyList
      .sort((a, b) => a.date.localeCompare(b.date))
      .reverse()
      .forEach(item => {
        listEl.innerHTML += `
          <div class="an-mood-row">
            <div style="display:flex;align-items:center;gap:10px">
              <img src="${MOOD_IMAGES[item.dominant] || MOOD_IMAGES["غير محدد"]}" style="width:36px">
              <strong>${item.dominant}</strong>
            </div>
            <span class="an-tag">${item.date}</span>
          </div>`;
      });

    if (!historyList.length) {
      listEl.innerHTML = `<p class="an-subtext" style="padding:10px">فارغ.</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Buttons
  document.querySelectorAll(".an-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".an-chip").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const days = parseInt(btn.dataset.range, 10) || 7;
      renderDashboard(days);

      const lbl = document.getElementById("analysisRange");
      if (lbl) lbl.textContent = btn.textContent;

      const card = document.querySelector(".an-card--primary2");
      if (card) {
        card.classList.add("pulse");
        setTimeout(() => card.classList.remove("pulse"), 250);
      }
    });
  });

  firebase.auth().onAuthStateChanged(() => renderDashboard(7));
});