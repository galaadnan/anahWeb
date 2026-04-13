console.log("✅ analyze.js dual-mode loaded (journal + emoji)");

let chartInstance = null;
let currentAnalysisMode = "journal";

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

const EVIDENCE_LIBRARY = [
  {
    id: "BREATH_4_6",
    forMoods: ["قلق", "غاضب", "حزين", "متعب", "لا بأس", "غير محدد"],
    title: "تنفّس بطيء (4/6)",
    steps: ["خذ شهيق 4 ثوانٍ", "ازفر 6 ثوانٍ", "كرر لمدة دقيقتين"],
    refsShort: ["تنفس بطيء (HRV)"],
    refsFull: ["Russo et al., 2017 — slow breathing/HRV regulation"]
  },
  {
    id: "GROUND_54321",
    forMoods: ["قلق", "غاضب", "غير محدد"],
    title: "تهدئة بالحواس (5-4-3-2-1)",
    steps: ["5 أشياء تراها", "4 تلمسها", "3 تسمعها", "2 تشمها", "1 تتذوقها"],
    refsShort: ["Grounding (5-4-3-2-1)"],
    refsFull: ["Clinical coping technique widely used for anxiety grounding"]
  },
  {
    id: "WRITE_3MIN",
    forMoods: ["حزين", "قلق", "غير محدد", "لا بأس"],
    title: "كتابة تعبيرية 3 دقائق",
    steps: ["اكتب 3 دقائق بلا توقف", "لا تهتم بالصياغة", "اختم: (ما أحتاجه الآن هو...)"],
    refsShort: ["كتابة تعبيرية"],
    refsFull: ["Pennebaker tradition; Niles et al., 2013 — expressive writing review"]
  },
  {
    id: "BA_ONE_STEP",
    forMoods: ["حزين", "متعب", "لا بأس"],
    title: "خطوة واحدة (تنشيط سلوكي)",
    steps: ["اختر نشاط 5–10 دقائق", "ابدأ بدون مثالية", "لاحظ شعورك بعده"],
    refsShort: ["تنشيط سلوكي"],
    refsFull: ["Cuijpers et al., 2007 — Behavioral Activation meta-analysis"]
  },
  {
    id: "MOVE_3MIN",
    forMoods: ["حزين", "غاضب", "قلق", "متعب", "لا بأس"],
    title: "تحريك الجسم 3 دقائق",
    steps: ["قف وتمدد 30 ثانية", "امشِ 2 دقيقة", "اشرب ماء في النهاية"],
    refsShort: ["نشاط خفيف"],
    refsFull: ["Light activity can support mood regulation"]
  },
  {
    id: "SLEEP_LIGHT",
    forMoods: ["متعب", "قلق"],
    title: "تهيئة نوم لطيفة",
    steps: ["خفّف الإضاءة 30 دقيقة", "أوقف الإشعارات", "تنفّس ببطء دقيقتين"],
    refsShort: ["Sleep hygiene"],
    refsFull: ["CBT-I / sleep hygiene principles"]
  }
];

const WOW_TEMPLATES = {
  intro: [
    "خلّينا ناخذها بهدوء 🤍",
    "خطوة صغيرة اليوم تكفي ✨",
    "مو لازم تكونين كاملة… بس متقدّمة 🌿",
    "خلّينا نرتّبها مع بعض بدون ضغط."
  ],
  insight: [
    (d) => `اليوم يبدو أنك أقرب إلى: ${d.todayMood}.`,
    (d) => `في ${d.daysLabel}، الأكثر ظهورًا كان: ${d.periodDominant}${d.secondMood ? ` ثم ${d.secondMood}` : ""}.`,
    (d) => d.volatility >= 60
      ? "فيه تذبذب ملحوظ بين الأيام—خلّينا نركز على تهدئة وتنظيم بسيط."
      : "النمط يبدو مستقر نسبيًا—خلّينا نعزز اللي يساعدك."
  ],
  focus: [
    "خلّينا نختار تدخلين بسيطين: واحد سريع الآن وواحد لليوم.",
    "الهدف مو تغيير كل شيء… بس تخفيف الشعور 10%."
  ],
  outro: [
    "إذا ما ناسبك شيء… اختاري أبسط خطوة فقط.",
    "جرّبي واحدة الآن، والباقي لاحقًا.",
    "اللطف مع نفسك جزء من العلاج."
  ]
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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
  if (m === "قلق") return "#ff9f43";
  if (m === "متعب") return "#feca57";
  if (m === "لا بأس") return "#a29bfe";
  return "#ccabd8";
}

function isoDate(d) {
  return d.toISOString().split("T")[0];
}

function computeVolatility(historyList) {
  const sorted = historyList.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length <= 1) return 0;

  let changes = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].dominant !== sorted[i - 1].dominant) changes++;
  }

  return Math.round((changes / (sorted.length - 1)) * 100);
}

function topTwoMoods(entryCounts) {
  const arr = Object.entries(entryCounts).sort((a, b) => b[1] - a[1]);
  return {
    first: arr[0]?.[0] || "غير محدد",
    second: arr[1]?.[0] || null
  };
}

function pickEvidenceForMood(mood, ctx) {
  const m = normalizeMood(mood);
  let pool = EVIDENCE_LIBRARY.filter(x => x.forMoods.includes(m));

  if (ctx.volatility >= 60) {
    const calmingPriority = new Set(["BREATH_4_6", "GROUND_54321", "SLEEP_LIGHT"]);
    pool = pool.slice().sort(
      (a, b) =>
        (calmingPriority.has(b.id) ? 1 : 0) - (calmingPriority.has(a.id) ? 1 : 0)
    );
  }

  const picked = [];
  for (const item of pool) {
    if (!picked.find(p => p.id === item.id)) picked.push(item);
    if (picked.length >= 2) break;
  }

  if (!picked.length) picked.push(EVIDENCE_LIBRARY[0]);
  if (picked.length === 1) picked.push(picked[0]);

  return picked;
}

function buildWowQuote(ctx) {
  const intro = pickRandom(WOW_TEMPLATES.intro);
  const insight = pickRandom(WOW_TEMPLATES.insight)(ctx);
  const focus = pickRandom(WOW_TEMPLATES.focus);
  const outro = pickRandom(WOW_TEMPLATES.outro);
  return `${intro} ${insight} ${focus} ${outro}`;
}

function setAnalysisTexts(mode) {
  const lead = document.getElementById("analysisLead");
  const chartTitle = document.getElementById("chartTitle");
  const chartSubtext = document.getElementById("chartSubtext");
  const topMoodsTitle = document.getElementById("topMoodsTitle");
  const historyTitle = document.getElementById("historyTitle");

  if (mode === "emoji") {
    if (lead) lead.textContent = "يتم تحليل مشاعرك بناءً على الإيموجي الذي اخترته يوميًا.";
    if (chartTitle) chartTitle.textContent = "تذبذب الإيموجي";
    if (chartSubtext) chartSubtext.textContent = "يعرض هذا الرسم عدد مرات اختيار كل شعور من الإيموجي خلال الفترة المختارة.";
    if (topMoodsTitle) topMoodsTitle.textContent = "أعلى إيموجي ظهورًا";
    if (historyTitle) historyTitle.textContent = "سجل الإيموجي";
  } else {
    if (lead) lead.textContent = "يتم تحليل مشاعرك بناءً على مذكراتك اليومية.";
    if (chartTitle) chartTitle.textContent = "تذبذب المزاج";
    if (chartSubtext) chartSubtext.textContent = "يعرض هذا الرسم عدد مرات ظهور كل شعور في مذكراتك خلال الفترة المختارة.";
    if (topMoodsTitle) topMoodsTitle.textContent = "أعلى مشاعر ظهورًا";
    if (historyTitle) historyTitle.textContent = "سجل المشاعر";
  }
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

  const start = performance.now();
  function step(now) {
    const p = Math.min(1, (now - start) / duration);
    const val = Math.round(to * p);
    el.textContent = `${val}%`;
    if (p < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function showRecommendations(todayMood, periodMood, daysLabel, ctx = null) {
  const today = normalizeMood(todayMood || "غير محدد");
  const period = normalizeMood(periodMood || "غير محدد");

  const qEl = document.getElementById("recQuote");
  const quickEl = document.getElementById("recQuick");
  const dailyEl = document.getElementById("recDaily");
  const weekEl = document.getElementById("recWeekNote");

  if (!qEl || !quickEl || !dailyEl) return;

  const safeCtx = ctx || {
    daysLabel: daysLabel || "الفترة",
    todayMood: today,
    periodDominant: period,
    secondMood: null,
    volatility: 0
  };

  qEl.textContent = `“${buildWowQuote(safeCtx)}”`;

  const picked = pickEvidenceForMood(today, safeCtx);
  const first = picked[0];
  const second = picked[1];

  quickEl.innerHTML = first.steps.map(s => `<li>${s}</li>`).join("");
  dailyEl.innerHTML = second.steps.map(s => `<li>${s}</li>`).join("");

  if (weekEl) {
    const v = safeCtx.volatility >= 60 ? "مرتفع" : (safeCtx.volatility >= 30 ? "متوسط" : "منخفض");
    const shortRefs = [...new Set([...(first.refsShort || []), ...(second.refsShort || [])])].join(" · ");
    const fullRefs = [...new Set([...(first.refsFull || []), ...(second.refsFull || [])])].join(" · ");

    weekEl.innerHTML = `
      <span style="display:inline-flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span class="rec-chip">نمط ${safeCtx.daysLabel}: ${period}</span>
        ${safeCtx.secondMood ? `<span class="rec-chip">ثم: ${safeCtx.secondMood}</span>` : ""}
        <span class="rec-chip">تذبذب: ${v}</span>
        <span class="rec-chip">${shortRefs}</span>
        <button type="button" id="whyRecBtn" class="rec-why-btn">لماذا هذه التوصية؟</button>
      </span>
      <div id="whyRecBox" class="rec-why-box" hidden>
        <div class="rec-why-title">اعتمدنا على (تقنيات/مراجع):</div>
        <div class="rec-why-body">${fullRefs}</div>
      </div>
    `;

    const whyBtn = document.getElementById("whyRecBtn");
    const whyBox = document.getElementById("whyRecBox");
    if (whyBtn && whyBox) {
      whyBtn.onclick = () => {
        whyBox.hidden = !whyBox.hidden;
      };
    }
  }
}

async function loadJournalData(days) {
  const entryCounts = {};
  const historyList = [];
  let totalWords = 0;

  const user = firebase.auth().currentUser;
  if (!user) return { entryCounts, historyList, totalWords };

  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - days + 1);

  const startISO = isoDate(start);
  const endISO = isoDate(now);

  const snap = await firebase.firestore()
    .collection("users").doc(user.uid)
    .collection("entries")
    .where(firebase.firestore.FieldPath.documentId(), ">=", startISO)
    .where(firebase.firestore.FieldPath.documentId(), "<=", endISO)
    .get();

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const mood = normalizeMood(data.finalMood || "غير محدد");
    const date = doc.id;
    const words = Number(data.words || 0);

    totalWords += words;
    entryCounts[mood] = (entryCounts[mood] || 0) + 1;
    historyList.push({ date, dominant: mood });
  });

  return { entryCounts, historyList, totalWords };
}

async function loadEmojiData(days) {
  const entryCounts = {};
  const historyList = [];
  let totalWords = 0;

  const user = firebase.auth().currentUser;
  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - days + 1);

  const startISO = isoDate(start);
  const endISO = isoDate(now);

  if (user) {
    const snap = await firebase.firestore()
      .collection("users").doc(user.uid)
      .collection("emoji_moods")
      .where(firebase.firestore.FieldPath.documentId(), ">=", startISO)
      .where(firebase.firestore.FieldPath.documentId(), "<=", endISO)
      .get();

    snap.forEach((doc) => {
      const data = doc.data() || {};
      const mood = normalizeMood(data.mood || "غير محدد");
      const date = doc.id;

      entryCounts[mood] = (entryCounts[mood] || 0) + 1;
      historyList.push({ date, dominant: mood });
    });

    return { entryCounts, historyList, totalWords };
  }

  let localHistory = [];
  try {
    localHistory = JSON.parse(localStorage.getItem("anah_emoji_history") || "[]");
  } catch {
    localHistory = [];
  }

  localHistory
    .filter(item => item.date >= startISO && item.date <= endISO)
    .forEach((item) => {
      const mood = normalizeMood(item.mood || "غير محدد");
      entryCounts[mood] = (entryCounts[mood] || 0) + 1;
      historyList.push({ date: item.date, dominant: mood });
    });

  return { entryCounts, historyList, totalWords };
}

async function loadAnalyzedData(days, mode) {
  if (mode === "emoji") return loadEmojiData(days);
  return loadJournalData(days);
}

function ensureChart(canvas) {
  if (!canvas || typeof Chart === "undefined") return null;

  if (!chartInstance) {
    chartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: [],
        datasets: [{
          label: "النسبة المئوية",
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
            ticks: {
              font: { size: 12 }
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (v) => v + "%"
            }
          }
        }
      }
    });
  }

  return chartInstance;
}

async function renderDashboard(days, mode = currentAnalysisMode) {
  currentAnalysisMode = mode;
  setAnalysisTexts(mode);

  const { entryCounts, historyList } = await loadAnalyzedData(days, mode);
  const totalEntries = historyList.length;

  const orderedLabels = MOOD_ORDER.filter(m => (entryCounts[m] || 0) > 0);
  const labels = orderedLabels.length ? orderedLabels : [];
  const values = labels.map(m =>
    totalEntries ? Math.round(((entryCounts[m] || 0) / totalEntries) * 100) : 0
  );
  const colors = labels.map(moodColor);

  const canvas = document.getElementById("moodChart");
  const chart = ensureChart(canvas);

  if (!labels.length) {
    setChartEmptyState(
      true,
      mode === "emoji"
        ? "لا توجد بيانات إيموجي لهذه الفترة. اختاري شعورك من الصفحة الرئيسية أولًا 🤍"
        : "لا توجد بيانات لهذه الفترة. جرّبي ٣٠ يوم أو اكتبي مذكرات أكثر 🤍"
    );

    if (chart) {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      chart.data.datasets[0].backgroundColor = [];
      chart.update();
    }
  } else {
    setChartEmptyState(false);
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].backgroundColor = colors;
      chart.update();
    }
  }

  const topEl = document.getElementById("topMoods");
  if (topEl) {
    topEl.innerHTML = "";

    const sorted = Object.entries(entryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (!sorted.length) {
      topEl.innerHTML = `<p class="an-subtext">لا توجد بيانات.</p>`;
    } else {
      sorted.forEach(([m, count]) => {
        const pct = totalEntries ? Math.round((count / totalEntries) * 100) : 0;

        const row = document.createElement("div");
        row.className = "an-metric";
        row.innerHTML = `
          <div class="an-metric-label" style="display:flex;align-items:center;gap:10px">
            <img src="${MOOD_IMAGES[m] || MOOD_IMAGES["غير محدد"]}" style="width:30px" alt="${m}">
            <span>${m}</span>
          </div>
          <span class="an-metric-value">0%</span>
        `;

        topEl.appendChild(row);
        animateCount(row.querySelector(".an-metric-value"), pct, 650);
      });
    }
  }

  let periodDominant = "غير محدد";
  const periodSorted = Object.entries(entryCounts).sort((a, b) => b[1] - a[1]);
  if (periodSorted.length) periodDominant = periodSorted[0][0];

  let todayMood = "غير محدد";
  if (historyList.length) {
    const latest = historyList
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .pop();
    todayMood = latest?.dominant || "غير محدد";
  }

  const daysLabel =
    days === 7 ? "الأسبوع" :
    days === 30 ? "آخر 30 يوم" :
    days === 90 ? "آخر 90 يوم" :
    "الفترة";

  const vol = computeVolatility(historyList);
  const top2 = topTwoMoods(entryCounts);

  showRecommendations(todayMood, periodDominant, daysLabel, {
    daysLabel,
    todayMood: normalizeMood(todayMood),
    periodDominant: normalizeMood(periodDominant),
    secondMood: top2.second ? normalizeMood(top2.second) : null,
    volatility: vol
  });

  const listEl = document.getElementById("moodList");
  if (listEl) {
    listEl.innerHTML = "";

    historyList
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .reverse()
      .forEach((item) => {
        listEl.innerHTML += `
          <div class="an-mood-row">
            <div style="display:flex;align-items:center;gap:10px">
              <img src="${MOOD_IMAGES[item.dominant] || MOOD_IMAGES["غير محدد"]}" style="width:36px" alt="${item.dominant}">
              <strong>${item.dominant}</strong>
            </div>
            <span class="an-tag">${item.date}</span>
          </div>
        `;
      });

    if (!historyList.length) {
      listEl.innerHTML = `<p class="an-subtext" style="padding:10px">فارغ.</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const defaultDays = 90;

  const chipDefault = document.querySelector(`.an-chip[data-range="${defaultDays}"]`);
  if (chipDefault) {
    document.querySelectorAll(".an-chip[data-range]").forEach(b => b.classList.remove("is-active"));
    chipDefault.classList.add("is-active");

    const lbl = document.getElementById("analysisRange");
    if (lbl) lbl.textContent = chipDefault.textContent;
  }

  document.querySelectorAll(".an-chip[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".an-chip[data-range]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const days = parseInt(btn.dataset.range, 10) || defaultDays;
      renderDashboard(days, currentAnalysisMode);

      const lbl = document.getElementById("analysisRange");
      if (lbl) lbl.textContent = btn.textContent;

      const card = document.querySelector(".an-card--primary2");
      if (card) {
        card.classList.add("pulse");
        setTimeout(() => card.classList.remove("pulse"), 250);
      }
    });
  });

  document.querySelectorAll(".an-chip[data-analysis]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".an-chip[data-analysis]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const daysBtn = document.querySelector(".an-chip[data-range].is-active");
      const days = parseInt(daysBtn?.dataset.range, 10) || defaultDays;
      const mode = btn.dataset.analysis || "journal";

      renderDashboard(days, mode);
    });
  });

  firebase.auth().onAuthStateChanged(() => {
    renderDashboard(defaultDays, currentAnalysisMode);
  });
});