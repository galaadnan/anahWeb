/* ============================================================
   UTILS.JS – النسخة النهائية المعتمدة لمشروع "أناه"
   (التاريخ، الثيم، إدارة المستخدم، تسجيل الخروج، انتهاء الجلسة)
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initDateDisplay();
  initThemeToggle();
  initUserAuth();
  initFooterYear();
  initSessionTimeout(); // خروج تلقائي عند عدم النشاط مثل تطبيقات البنوك
  // ملاحظة: تم حذف initMobileMenu لتجنب خطأ ReferenceError
});

/* 1) عرض التاريخ بالتنسيق العربي السعودي */
function initDateDisplay() {
  const elements = [
    document.getElementById("today-date"),
    document.getElementById("homeToday"),
    document.getElementById("journal-today")
  ];

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const dateString = formatter.format(now);

  elements.forEach(el => {
    if (el) el.textContent = dateString;
  });
}

/* سنة الفوتر */
function initFooterYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* 2) إدارة الثيم (الوضع الليلي والنهاري) */
function initThemeToggle() {
  const themeToggle = document.getElementById("theme-toggle");

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("is-dark");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("is-dark");
      const isDark = document.body.classList.contains("is-dark");
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  }
}

/* 3) إدارة المستخدم وتسجيل الخروج */
function initUserAuth() {
  const authBtn = document.getElementById("authButton");
  if (!authBtn) return;

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch {
    user = null;
  }

  if (!user || !user.name) {
    authBtn.textContent = "تسجيل / دخول";
    authBtn.href = "SignOrLogin.html";
    authBtn.classList.remove("auth-chip");
    return;
  }

  authBtn.textContent = `مرحبًا، ${user.name}`;
  authBtn.href = "#";
  authBtn.classList.add("auth-chip");

  injectLogoutModal();

  authBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const modal = document.getElementById("globalLogoutModal");
    if (modal) modal.hidden = false;
  });
}

/* نافذة تسجيل الخروج */
function injectLogoutModal() {
  if (document.getElementById("globalLogoutModal")) return;

  const modalHTML = `
    <div id="globalLogoutModal" class="journal-modal" hidden>
      <div class="journal-modal-dialog" style="text-align: center; max-width: 400px;">
        <h3 style="color: var(--text-color);">تسجيل الخروج</h3>
        <p style="margin: 15px 0; color: var(--text-color);">
          هل أنتِ متأكدة أنك تريدين تسجيل الخروج؟
        </p>

        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
          <button
            id="utilsConfirmLogout"
            class="pill-button"
            style="background: #ff6b6b; color: white; border:none; padding:10px 20px; border-radius:20px; cursor:pointer;"
          >
            نعم، خروج
          </button>

          <button
            id="utilsCancelLogout"
            class="pill-button"
            style="background: transparent; border: 1px solid #ccc; padding:10px 20px; border-radius:20px; cursor:pointer; color: var(--text-color);"
          >
            تراجع
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const confirmBtn = document.getElementById("utilsConfirmLogout");
  const cancelBtn = document.getElementById("utilsCancelLogout");

  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      logoutUser();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      const modal = document.getElementById("globalLogoutModal");
      if (modal) modal.hidden = true;
    });
  }
}

/* 4) دوال مساعدة عامة */
window.getTodayISO = function () {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ============================================================
   5) تسجيل الخروج الموحد
   - يحذف بيانات المستخدم من localStorage
   - يحاول تسجيل الخروج من Firebase إن كان متاحًا
============================================================ */
function logoutUser(reason = "") {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("rememberMe");
  localStorage.removeItem("rememberedEmail");

  const redirectUrl =
    reason === "expired"
      ? "SignOrLogin.html?session=expired"
      : "SignOrLogin.html";

  if (window.firebase && firebase.auth) {
    firebase.auth().signOut().finally(() => {
      window.location.href = redirectUrl;
    });
  } else {
    window.location.href = redirectUrl;
  }
}

/* ============================================================
   6) انتهاء الجلسة عند عدم النشاط مثل تطبيقات البنوك
============================================================ */
function initSessionTimeout() {
  const protectedPages = ["home.html", "journal.html", "analyze.html"];
  const currentPage = window.location.pathname.split("/").pop();

  // لا يعمل في index.html ولا SignOrLogin.html
  if (!protectedPages.includes(currentPage)) return;

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch {
    user = null;
  }

  // لو المستخدم غير مسجل دخول وفتح صفحة محمية
  if (!user) {
    window.location.href = "SignOrLogin.html";
    return;
  }

  /*
    للتجربة:
    1 دقيقة = 1 * 60 * 1000

    للنسخة النهائية:
    5 دقائق = 5 * 60 * 1000
  */
const IDLE_LIMIT = 5 * 60 * 1000;
const WARNING_BEFORE = 60 * 1000;

  let warningTimer = null;
  let logoutTimer = null;

  function injectSessionModal() {
    if (document.getElementById("sessionTimeoutModal")) return;

    const modalHTML = `
      <div id="sessionTimeoutModal" class="journal-modal" hidden>
        <div class="journal-modal-dialog" style="text-align:center; max-width:420px;">
          <h3 style="color: var(--text-color);">انتهاء الجلسة قريبًا</h3>

          <p style="margin:15px 0; color: var(--text-color);">
            بسبب عدم النشاط، سيتم تسجيل خروجك تلقائيًا خلال دقيقة.
          </p>

          <button id="stayLoggedInBtn" class="pill-button pill-primary">
            البقاء مسجلة الدخول
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const stayBtn = document.getElementById("stayLoggedInBtn");

    if (stayBtn) {
      stayBtn.addEventListener("click", () => {
        const modal = document.getElementById("sessionTimeoutModal");
        if (modal) modal.hidden = true;
        resetSessionTimers();
      });
    }
  }

  function showSessionWarning() {
    const modal = document.getElementById("sessionTimeoutModal");
    if (modal) modal.hidden = false;
  }

  function resetSessionTimers() {
    clearTimeout(warningTimer);
    clearTimeout(logoutTimer);

    const modal = document.getElementById("sessionTimeoutModal");
    if (modal) modal.hidden = true;

    warningTimer = setTimeout(() => {
      showSessionWarning();
    }, IDLE_LIMIT - WARNING_BEFORE);

    logoutTimer = setTimeout(() => {
      logoutUser("expired");
    }, IDLE_LIMIT);
  }

  injectSessionModal();

  const activityEvents = [
    "click",
    "keydown",
    "mousemove",
    "scroll",
    "touchstart"
  ];

  activityEvents.forEach(eventName => {
    document.addEventListener(eventName, resetSessionTimers, { passive: true });
  });

  resetSessionTimers();
}