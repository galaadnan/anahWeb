console.log("✅ analyze.js v8 loaded (range persistence fixed + Smart External Recs)");

let chartInstance = null;
let anahSmartDB = {}; // متغير جديد لحفظ التوصيات الذكية من الملف

// ثابت ترتيب المشاعر (عشان الرسم ما يتغير ترتيب أعمدته كل مرة)
const MOOD_ORDER = ["سعيد", "هادئ", "حزين", "متوتر", "غاضب", "متعب", "غير محدد"];

const MOOD_IMAGES = {
  "سعيد": "images/Habby.png",
  "هادئ": "images/Ok.png",
  "غاضب": "images/Angry.png",
  "حزين": "images/Sad.png",
  "متوتر": "images/worried.png",
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
  "متوتر": {
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
  "هادئ": {
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
    forMoods: ["متوتر", "غاضب", "حزين", "متعب", "هادئ", "غير محدد"],
    title: "تنفّس بطيء (4/6)",
    steps: ["خذ شهيق 4 ثوانٍ", "ازفر 6 ثوانٍ", "كرر لمدة دقيقتين"],
    refsShort: ["تنفس بطيء (HRV)"],
    refsFull: ["Russo et al., 2017 — slow breathing/HRV regulation"]
  },
  {
    id: "GROUND_54321",
    forMoods: ["متوتر", "غاضب", "غير محدد"],
    title: "تهدئة بالحواس (5-4-3-2-1)",
    steps: ["5 أشياء تراها", "4 تلمسها", "3 تسمعها", "2 تشمها", "1 تتذوقها"],
    refsShort: ["Grounding (5-4-3-2-1)"],
    refsFull: ["Clinical coping technique widely used for anxiety grounding"]
  },
  {
    id: "WRITE_3MIN",
    forMoods: ["حزين", "متوتر", "غير محدد", "هادئ"],
    title: "كتابة تعبيرية 3 دقائق",
    steps: ["اكتب 3 دقائق بلا توقف", "لا تهتم بالصياغة", "اختم: (ما أحتاجه الآن هو...)"],
    refsShort: ["كتابة تعبيرية"],
    refsFull: ["Pennebaker tradition; Niles et al., 2013 — expressive writing review"]
  },
  {
    id: "BA_ONE_STEP",
    forMoods: ["حزين", "متعب", "هادئ"],
    title: "خطوة واحدة (تنشيط سلوكي)",
    steps: ["اختر نشاط 5–10 دقائق", "ابدأ بدون مثالية", "لاحظ شعورك بعده"],
    refsShort: ["تنشيط سلوكي"],
    refsFull: ["Cuijpers et al., 2007 — Behavioral Activation meta-analysis"]
  },
  {
    id: "MOVE_3MIN",
    forMoods: ["حزين", "غاضب", "متوتر", "متعب", "هادئ"],
    title: "تحريك الجسم 3 دقائق",
    steps: ["قف وتمدد 30 ثانية", "امشِ 2 دقيقة", "اشرب ماء في النهاية"],
    refsShort: ["نشاط خفيف"],
    refsFull: ["Light activity can support mood regulation (general behavioral guidance)"]
  },
  {
    id: "SLEEP_LIGHT",
    forMoods: ["متعب", "متوتر"],
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
  return m.trim().split(/\s+/)[0];
}

function normalizeMood(raw) {
  let m = cleanMood(raw);

  if (m === "قلق" || m === "متوتر") m = "متوتر";
  if (m === "تعبان") m = "متعب";
  if (m === "لا بأس") m = "هادئ";
  if (m === "هادى") m = "هادئ";

  return MOOD_IMAGES[m] ? m : "غير محدد";
}

function moodColor(m) {
  if (m === "غاضب") return "#dd8181";
  if (m === "سعيد") return "#5fcbae";
  if (m === "حزين") return "#7aacea";
  if (m === "متوتر") return "#eba96b";
  if (m === "متعب") return "#ffee6d";
  if (m === "هادئ") return "#a29bfe";
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
  let pool = EVIDENCE_LIBRARY.filter((x) => x.forMoods.includes(m));

  if (ctx.volatility >= 60) {
    const calmingPriority = new Set(["BREATH_4_6", "GROUND_54321", "SLEEP_LIGHT"]);

    pool = pool.slice().sort((a, b) => {
      return (calmingPriority.has(b.id) ? 1 : 0) - (calmingPriority.has(a.id) ? 1 : 0);
    });
  }

  const picked = [];

  for (const item of pool) {
    if (!picked.find((p) => p.id === item.id)) picked.push(item);
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
   🔥 تحميل الداتا الذكية من ملف JSON الخارجي
============================================================ */
async function loadSmartRecommendations() {
  try {
    const response = await fetch('anah_recommendations_ar_dataset.json');
    const data = await response.json();
    
    if (Array.isArray(data)) {
        data.forEach(item => {
            if (!anahSmartDB[item.mood]) anahSmartDB[item.mood] = [];
            anahSmartDB[item.mood].push({
                moment_containment: item.moment_containment || item.quick_steps,
                day_step: item.day_step || item.daily_suggestions
            });
        });
    } else {
        anahSmartDB = data;
    }
    console.log("📚 تم تحميل التوصيات الذكية من الملف بنجاح!");
  } catch (error) {
    console.error("❌ خطأ في تحميل ملف التوصيات:", error);
  }
}

/* ============================================================
   ✅ التعديل المطلوب: رسم البطاقات الذكية
============================================================ */
function showRecommendations(todayMood, periodMood, daysLabel, ctx = null) {
  const mainMood = normalizeMood(periodMood || "غير محدد");
  const fallbackMood = normalizeMood(todayMood || "غير محدد");
  
  let targetMood = mainMood;
  if (targetMood === "غير محدد" && fallbackMood !== "غير محدد") {
      targetMood = fallbackMood;
  }

  // سحب التوصيات عشوائياً بناءً على الداتا المحملة
  const moodRecs = anahSmartDB[targetMood] || [
    { moment_containment: "خذ نفساً عميقاً واستشعر اللحظة الحالية بهدوء.", day_step: "استمر في تسجيل يومياتك ليتعرف أناه عليك أكثر." }
  ];
  const randomRec = moodRecs[Math.floor(Math.random() * moodRecs.length)];

  // إخفاء الواجهة القديمة (القوائم والنصوص)
  const oldQuote = document.getElementById("recQuote");
  const oldQuick = document.getElementById("recQuick");
  const oldDaily = document.getElementById("recDaily");
  const oldNote = document.getElementById("recWeekNote");
  
  if (oldQuote) oldQuote.style.display = "none";
  if (oldNote) oldNote.style.display = "none";
  if (oldQuick && oldQuick.parentElement) oldQuick.parentElement.style.display = "none";
  if (oldDaily && oldDaily.parentElement) oldDaily.parentElement.style.display = "none";

  const recCard = document.getElementById("recommendationCard");
  if (recCard) {
    const oldSections = recCard.querySelectorAll(".rec-section");
    oldSections.forEach(sec => sec.style.display = "none");
  }

  // رسم البطاقات الذكية في الصندوق المخصص
  let smartContainer = document.getElementById("anah-recommendations-container");
  
  if (smartContainer) {
      smartContainer.innerHTML = `
        <div style="display: flex; gap: 15px; margin-top: 20px; flex-wrap: wrap; text-align: right;">
          
          <div style="flex: 1; min-width: 250px; background: #FDF4F5; padding: 18px; border-radius: 12px; border-right: 5px solid #FF7675; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <h4 style="color: #D63031; margin-top: 0; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
              <span>🤍</span> احتواء اللحظة
            </h4>
            <p style="font-size: 0.95rem; color: #444; line-height: 1.6; margin: 0;">${randomRec.moment_containment}</p>
          </div>

          <div style="flex: 1; min-width: 250px; background: #F4F9F4; padding: 18px; border-radius: 12px; border-right: 5px solid #55EFC4; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <h4 style="color: #00B894; margin-top: 0; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
              <span>🌅</span> خطوتك لليوم
            </h4>
            <p style="font-size: 0.95rem; color: #444; line-height: 1.6; margin: 0;">${randomRec.day_step}</p>
          </div>

        </div>
      `;
  }
}

/* =========================
   Firestore loader
========================= */

async function loadAnalyzedData(days) {
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

  console.log("📅 Range:", startISO, "->", endISO);

  
    const db = firebase.firestore();
    const userRef = db.collection("users").doc(user.uid);

    // اليوميات
    const entriesSnap = await userRef
      .collection("entries")
      .where(firebase.firestore.FieldPath.documentId(), ">=", startISO)
      .where(firebase.firestore.FieldPath.documentId(), "<=", endISO)
      .get();

    // الإيموجي
    const emojiSnap = await userRef
      .collection("emoji_moods")
      .where(firebase.firestore.FieldPath.documentId(), ">=", startISO)
      .where(firebase.firestore.FieldPath.documentId(), "<=", endISO)
      .get();

    const processedDates = new Set();

    // أولاً: entries لهم أولوية
    entriesSnap.forEach((doc) => {
      const data = doc.data() || {};
      const date = doc.id;

      processedDates.add(date);

      const mood = normalizeMood(data.finalMood || "غير محدد");
      const words = Number(data.words || 0);

      totalWords += words;

      entryCounts[mood] = (entryCounts[mood] || 0) + 1;
      historyList.push({ date, dominant: mood });
    });

    // ثانياً: emoji إذا ما فيه entry بنفس اليوم
    emojiSnap.forEach((doc) => {
      const data = doc.data() || {};
      const date = doc.id;

      if (processedDates.has(date)) return;

      const mood = normalizeMood(data.mood || "غير محدد");

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
        datasets: [
          {
            label: "النسبة المئوية للأيام",
            data: [],
            backgroundColor: [],
            borderRadius: 10,
            hoverBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 900,
          easing: "easeOutQuart"
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (t) => (t.parsed.y ?? 0) + "%"
            }
          }
        },
        scales: {
          x: {
            ticks: {
              font: {
                size: 12
              }
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

/* =========================
   Main render
========================= */

async function renderDashboard(days) {
  const { entryCounts, historyList } = await loadAnalyzedData(days);
  const totalEntries = historyList.length;

  const orderedLabels = MOOD_ORDER.filter((m) => (entryCounts[m] || 0) > 0);
  const labels = orderedLabels.length ? orderedLabels : [];

  const values = labels.map((m) =>
    totalEntries ? Math.round(((entryCounts[m] || 0) / totalEntries) * 100) : 0
  );

  const colors = labels.map(moodColor);

  const canvas = document.getElementById("moodChart");
  const chart = ensureChart(canvas);

  if (!labels.length) {
    setChartEmptyState(
      true,
      "لا توجد بيانات لهذه الفترة. جرّبي ٣٠ يوم أو اكتبي مذكرات أكثر 🤍"
    );

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

  let periodDominant = "غير محدد";
  const periodSorted = Object.entries(entryCounts).sort((a, b) => b[1] - a[1]);

  if (periodSorted.length) {
    periodDominant = periodSorted[0][0];
  }

  let todayMood = "غير محدد";

  if (historyList.length) {
    const latest = historyList
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .pop();

    todayMood = latest?.dominant || "غير محدد";
  }

  const daysLabel =
    days === 7
      ? "الأسبوع"
      : days === 30
        ? "آخر 30 يوم"
        : days === 90
          ? "آخر 90 يوم"
          : "الفترة";

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
              <img src="${MOOD_IMAGES[item.dominant] || MOOD_IMAGES["غير محدد"]}" style="width:36px">
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

/* =========================
   Init - Fixed Range Persistence
========================= */

document.addEventListener("DOMContentLoaded", () => {
  // 🔥 استدعاء التوصيات من ملف الجيسون مباشرة
  loadSmartRecommendations();

  const chips = document.querySelectorAll(".an-chip");
  const rangeLabel = document.getElementById("analysisRange");
  const DEFAULT_RANGE = 90;

  function getChipByRange(days) {
    return Array.from(chips).find((btn) => {
      return parseInt(btn.dataset.range, 10) === Number(days);
    });
  }

  function isValidRange(days) {
    return Boolean(getChipByRange(days));
  }

  function getInitialRange() {
    const saved = parseInt(localStorage.getItem("anah_analysis_range"), 10);

    if (!Number.isNaN(saved) && isValidRange(saved)) {
      return saved;
    }

    const activeChip = document.querySelector(".an-chip.is-active");

    if (activeChip) {
      const activeRange = parseInt(activeChip.dataset.range, 10);

      if (!Number.isNaN(activeRange) && isValidRange(activeRange)) {
        return activeRange;
      }
    }

    return DEFAULT_RANGE;
  }

  function setActiveRange(days, shouldSave = true, shouldPulse = true) {
    const safeDays = isValidRange(days) ? Number(days) : DEFAULT_RANGE;
    const selectedChip = getChipByRange(safeDays) || getChipByRange(DEFAULT_RANGE) || chips[0];

    if (!selectedChip) return;

    chips.forEach((btn) => {
      btn.classList.remove("is-active");
    });

    selectedChip.classList.add("is-active");

    if (rangeLabel) {
      rangeLabel.textContent = selectedChip.textContent.trim();
    }

    if (shouldSave) {
      localStorage.setItem("anah_analysis_range", String(safeDays));
    }

    renderDashboard(safeDays);

    if (shouldPulse) {
      const card = document.querySelector(".an-card--primary2");

      if (card) {
        card.classList.add("pulse");
        setTimeout(() => card.classList.remove("pulse"), 250);
      }
    }
  }

  chips.forEach((btn) => {
    btn.addEventListener("click", () => {
      const days = parseInt(btn.dataset.range, 10) || DEFAULT_RANGE;
      setActiveRange(days, true, true);
    });
  });

  const initialRange = getInitialRange();

  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => {
      setActiveRange(initialRange, false, false);
    });
  } else {
    setActiveRange(initialRange, false, false);
  }
});
