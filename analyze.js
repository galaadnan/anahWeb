console.log("✅ analyze.js v6 loaded (percentage by days + WOW recommendations + why button)");

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
   Legacy Personalized Recommendations (kept)
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

/* ============================================================
   ✅ WOW Recommendations (evidence-backed + dynamic + clean UI)
============================================================ */

const EVIDENCE_LIBRARY = [
  {
    id: "BREATH_4_6",
    forMoods: ["قلق","غاضب","حزين","متعب","لا بأس","غير محدد"],
    title: "تنفّس بطيء (4/6)",
    steps: ["خذ شهيق 4 ثوانٍ", "ازفر 6 ثوانٍ", "كرر لمدة دقيقتين"],
    refsShort: ["تنفس بطيء (HRV)"],
    refsFull: ["Russo et al., 2017 — slow breathing/HRV regulation"]
  },
  {
    id: "GROUND_54321",
    forMoods: ["قلق","غاضب","غير محدد"],
    title: "تهدئة بالحواس (5-4-3-2-1)",
    steps: ["5 أشياء تراها", "4 تلمسها", "3 تسمعها", "2 تشمها", "1 تتذوقها"],
    refsShort: ["Grounding (5-4-3-2-1)"],
    refsFull: ["Clinical coping technique widely used for anxiety grounding"]
  },
  {
    id: "WRITE_3MIN",
    forMoods: ["حزين","قلق","غير محدد","لا بأس"],
    title: "كتابة تعبيرية 3 دقائق",
    steps: ["اكتب 3 دقائق بلا توقف", "لا تهتم بالصياغة", "اختم: (ما أحتاجه الآن هو...)"],
    refsShort: ["كتابة تعبيرية"],
    refsFull: ["Pennebaker tradition; Niles et al., 2013 — expressive writing review"]
  },
  {
    id: "BA_ONE_STEP",
    forMoods: ["حزين","متعب","لا بأس"],
    title: "خطوة واحدة (تنشيط سلوكي)",
    steps: ["اختر نشاط 5–10 دقائق", "ابدأ بدون مثالية", "لاحظ شعورك بعده"],
    refsShort: ["تنشيط سلوكي"],
    refsFull: ["Cuijpers et al., 2007 — Behavioral Activation meta-analysis"]
  },
  {
    id: "MOVE_3MIN",
    forMoods: ["حزين","غاضب","قلق","متعب","لا بأس"],
    title: "تحريك الجسم 3 دقائق",
    steps: ["قف وتمدد 30 ثانية", "امشِ 2 دقيقة", "اشرب ماء في النهاية"],
    refsShort: ["نشاط خفيف"],
    refsFull: ["Light activity can support mood regulation (general behavioral guidance)"]
  },
  {
    id: "SLEEP_LIGHT",
    forMoods: ["متعب","قلق"],
    title: "تهيئة نوم لطيفة",
    steps: ["خفّف الإضاءة 30 دقيقة", "أوقف الإشعارات", "تنفّس ببطء دقيقتين"],
    refsShort: ["Sleep hygiene"],
    refsFull: ["CBT-I / sleep hygiene principles (clinical guidance)"]
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
  return m.trim().split(/\s+/)[0]; // يشيل الإيموجي
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
  return { first: arr[0]?.[0] || "غير محدد", second: arr[1]?.[0] || null };
}

function pickEvidenceForMood(mood, ctx) {
  const m = normalizeMood(mood);
  let pool = EVIDENCE_LIBRARY.filter(x => x.forMoods.includes(m));

  // لو التذبذب عالي: أعطِ أولوية للتهدئة/النوم/grounding
  if (ctx.volatility >= 60) {
    const calmingPriority = new Set(["BREATH_4_6", "GROUND_54321", "SLEEP_LIGHT"]);
    pool = pool.slice().sort((a, b) => (calmingPriority.has(b.id) ? 1 : 0) - (calmingPriority.has(a.id) ? 1 : 0));
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

/* =========================
   Chart empty state
========================= */
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

/* ============================================================
   ✅ Recommendations renderer (clean look + why button)
============================================================ */
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

  // نص WOW
  qEl.textContent = `“${buildWowQuote(safeCtx)}”`;

  const picked = pickEvidenceForMood(today, safeCtx);
  const first = picked[0];
  const second = picked[1];

  // قوائم خطوات
  quickEl.innerHTML = first.steps.map(s => `<li>${s}</li>`).join("");
  dailyEl.innerHTML = second.steps.map(s => `<li>${s}</li>`).join("");

  // مراجع مختصرة + زر (Why)
  if (weekEl) {
    const v = safeCtx.volatility >= 60 ? "مرتفع" : (safeCtx.volatility >= 30 ? "متوسط" : "منخفض");
    const shortRefs = [...new Set([...(first.refsShort || []), ...(second.refsShort || [])])].join(" · ");
    const fullRefs = [...new Set([...(first.refsFull || []), ...(second.refsFull || [])])].join(" · ");

    // نستخدم innerHTML عشان نخليها Chips + زر
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
      whyBtn.onclick = () => (whyBox.hidden = !whyBox.hidden);
    }
  }
}

/* =========================
   Firestore loader
========================= */
async function loadAnalyzedData(days) {
  const entryCounts = {};   // ✅ عدد الأيام لكل شعور
  const historyList = [];   // ✅ سجل الأيام
  let totalWords = 0;

  const user = firebase.auth().currentUser;
  if (!user) return { entryCounts, historyList, totalWords };

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

    entryCounts[mood] = (entryCounts[mood] || 0) + 1;
    historyList.push({ date, dominant: mood });
  });

  return { entryCounts, historyList, totalWords };
}

function ensureChart(canvas) {
  if (!canvas || typeof Chart === "undefined") return null;

  if (!chartInstance) {
    chartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: [],
        datasets: [{
          label: "النسبة المئوية للأيام",
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
          x: { ticks: { font: { size: 12 } } },
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

/* =========================
   Main render
========================= */
async function renderDashboard(days) {
  const { entryCounts, historyList } = await loadAnalyzedData(days);
  const totalEntries = historyList.length;

  const orderedLabels = MOOD_ORDER.filter(m => (entryCounts[m] || 0) > 0);
  const labels = orderedLabels.length ? orderedLabels : [];

  const values = labels.map(m =>
    totalEntries ? Math.round(((entryCounts[m] || 0) / totalEntries) * 100) : 0
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
      chart.update();
    }
  }

  // ---- Top Moods
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

  // ---- Recommendations
  let periodDominant = "غير محدد";
  const periodSorted = Object.entries(entryCounts).sort((a, b) => b[1] - a[1]);
  if (periodSorted.length) periodDominant = periodSorted[0][0];

  let todayMood = "غير محدد";
  if (historyList.length) {
    const latest = historyList.slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
    todayMood = latest?.dominant || "غير محدد";
  }

  const daysLabel =
    days === 7 ? "الأسبوع" :
    (days === 30 ? "آخر 30 يوم" :
    (days === 90 ? "آخر 90 يوم" : "الفترة"));

  const vol = computeVolatility(historyList);
  const top2 = topTwoMoods(entryCounts);

  showRecommendations(todayMood, periodDominant, daysLabel, {
    daysLabel,
    todayMood: normalizeMood(todayMood),
    periodDominant: normalizeMood(periodDominant),
    secondMood: top2.second ? normalizeMood(top2.second) : null,
    volatility: vol
  });

  // ---- List (latest first)
  const listEl = document.getElementById("moodList");
  if (listEl) {
    listEl.innerHTML = "";

    historyList
      .slice()
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

/* =========================
   Init
========================= */
document.addEventListener("DOMContentLoaded", () => {
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