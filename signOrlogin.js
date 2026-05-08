// signOrlogin.js

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* =====================================
     0) Config
  ====================================== */

  const REQUIRE_GMAIL_FOR_EMAIL_PASSWORD = true;

  /* =====================================
     1) Reveal elements with animation
  ====================================== */

  document
    .querySelectorAll(".anim-glass-in, .anim-fade-up, .reveal")
    .forEach((el) => el.classList.add("is-visible"));

  /* =====================================
     2) Modal helpers
  ====================================== */

  const authErrorModal = document.getElementById("authErrorModal");
  const authErrorMsg = document.getElementById("authErrorMessage");
  const closeAuthErrorBtn = document.getElementById("closeAuthError");

  const successModal = document.getElementById("successModal");
  const closeSuccessBtn = document.getElementById("closeSuccessModal");

  function showAuthError(message) {
    if (authErrorMsg) authErrorMsg.textContent = message;
    if (authErrorModal) authErrorModal.hidden = false;
  }

  function closeAuthError() {
    if (authErrorModal) authErrorModal.hidden = true;
  }

  if (closeAuthErrorBtn) {
    closeAuthErrorBtn.addEventListener("click", closeAuthError);
  }

  if (authErrorModal) {
    authErrorModal.addEventListener("click", (e) => {
      if (e.target === authErrorModal) closeAuthError();
    });
  }

  if (closeSuccessBtn && successModal) {
    closeSuccessBtn.addEventListener("click", (e) => {
      e.preventDefault();
      successModal.hidden = true;
      switchPanel("login-panel");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* =====================================
     3) Basic guards
  ====================================== */

  if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) {
    showAuthError("Firebase غير محمّل. تأكدي من ترتيب ملفات JavaScript في الصفحة.");
    return;
  }

  if (typeof auth === "undefined" || typeof db === "undefined") {
    showAuthError("firebase-config.js غير محمّل بشكل صحيح.");
    return;
  }

  /* =====================================
     4) Helpers
  ====================================== */

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isGmailAddress(email) {
    const clean = normalizeEmail(email);
    return clean.endsWith("@gmail.com") || clean.endsWith("@googlemail.com");
  }

  function getFirebaseErrorMessage(error) {
    const code = error?.code || "";
    const message = error?.message || "";

    if (message === "ONLY_GMAIL_ALLOWED") {
      return "يسمح فقط بحسابات Gmail.";
    }

    if (code === "auth/popup-closed-by-user") {
      return "تم إغلاق نافذة Google قبل إكمال تسجيل الدخول.";
    }

    if (code === "auth/popup-blocked") {
      return "المتصفح منع نافذة Google. اسمحي بالنوافذ المنبثقة وحاولي مرة أخرى.";
    }

    if (code === "auth/email-already-in-use") {
      return "هذا البريد الإلكتروني مسجل مسبقًا.";
    }

    if (code === "auth/weak-password") {
      return "كلمة المرور ضعيفة جدًا.";
    }

    if (code === "auth/invalid-email") {
      return "البريد الإلكتروني غير صحيح.";
    }

    if (
      code === "auth/user-not-found" ||
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential"
    ) {
      return "بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور.";
    }

    if (code === "auth/network-request-failed") {
      return "تعذر الاتصال بالشبكة. تأكدي من الإنترنت وحاولي مرة أخرى.";
    }

    return "حدث خطأ، يرجى المحاولة مرة أخرى.";
  }

  function setButtonLoading(button, isLoading, loadingText, normalText) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : normalText;
  }

  function saveCurrentUserToLocalStorage(user, userName, provider) {
    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        uid: user.uid,
        email: user.email || "",
        name: userName || "مستخدم",
        provider: provider || "unknown",
      })
    );
  }

  async function saveUserProfile(user, options = {}) {
    if (!user) throw new Error("No Firebase user found.");

    const provider = options.provider || "unknown";
    const fallbackName = options.name || "مستخدم";
    const userName = user.displayName || fallbackName;
    const userEmail = normalizeEmail(user.email || options.email || "");

    if (!userEmail) {
      throw new Error("NO_EMAIL_FOUND");
    }

    if (REQUIRE_GMAIL_FOR_EMAIL_PASSWORD && provider !== "google" && !isGmailAddress(userEmail)) {
      await auth.signOut();
      throw new Error("ONLY_GMAIL_ALLOWED");
    }

    if (provider === "google" && !user.providerData.some((p) => p.providerId === "google.com")) {
      await auth.signOut();
      throw new Error("ONLY_GOOGLE_PROVIDER_ALLOWED");
    }

    const userRef = db.collection("users").doc(user.uid);
    const existing = await userRef.get();

    const profileData = {
      name: userName,
      email: userEmail,
      provider,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!existing.exists) {
      profileData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    await userRef.set(profileData, { merge: true });

    saveCurrentUserToLocalStorage(user, userName, provider);
  }

  function switchPanel(targetId) {
    const tabs = document.querySelectorAll(".auth-tab");
    const panels = document.querySelectorAll(".auth-panel");

    tabs.forEach((t) => t.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));

    const targetTab = document.querySelector(`.auth-tab[data-target="${targetId}"]`);
    const targetPanel = document.getElementById(targetId);

    if (targetTab) targetTab.classList.add("active");
    if (targetPanel) targetPanel.classList.add("active");
  }

  /* =====================================
     5) Tabs: Login / Sign Up
  ====================================== */

  const tabs = document.querySelectorAll(".auth-tab");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.target;
      switchPanel(targetId);
    });
  });

  document.querySelectorAll(".swap-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const targetId = btn.dataset.swap === "signup" ? "signup-panel" : "login-panel";
      switchPanel(targetId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* =====================================
     6) Show / Hide password toggle
  ====================================== */

  document.querySelectorAll(".peek").forEach((btn) => {
    const input = btn.previousElementSibling;
    const icon = btn.querySelector(".peek-icon");

    if (!input || !icon) return;

    btn.addEventListener("click", () => {
      const isPassword = input.type === "password";

      input.type = isPassword ? "text" : "password";
      icon.src = isPassword ? "images/seen.png" : "images/eyebrow.png";
      icon.alt = isPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور";
    });
  });

  /* =====================================
     7) Password validation
  ====================================== */

  function validatePasswordStrength(password) {
    if (!password || password.length < 8) {
      return {
        ok: false,
        msg: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
      };
    }

    if (!/[A-Za-zأ-ي]/.test(password)) {
      return {
        ok: false,
        msg: "كلمة المرور يجب أن تحتوي على حرف واحد على الأقل.",
      };
    }

    if (!/[0-9]/.test(password)) {
      return {
        ok: false,
        msg: "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.",
      };
    }

    if (!/[!@#$%^&*()_\-+=\[{\]};:'",.<>/?\\|]/.test(password)) {
      return {
        ok: false,
        msg: "كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل.",
      };
    }

    return { ok: true };
  }

  function setupPasswordStrength() {
    const pwInput = document.getElementById("signup-password");
    const strengthWrap = document.getElementById("signup-strength");
    const strengthText = document.getElementById("signup-strength-text");

    if (!pwInput || !strengthWrap || !strengthText) return;

    function evaluateStrength(password) {
      let score = 0;

      if (password.length >= 8) score++;
      if (password.length >= 12) score++;
      if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
      if (/\d/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;

      if (!password) return { level: 0, label: "—" };
      if (score <= 2) return { level: 1, label: "ضعيفة" };
      if (score <= 4) return { level: 2, label: "متوسطة" };
      return { level: 3, label: "قوية" };
    }

    function updateStrengthUI(password) {
      const { level, label } = evaluateStrength(password);

      strengthWrap.classList.remove("is-weak", "is-medium", "is-strong");
      strengthText.textContent = label;

      if (level === 1) strengthWrap.classList.add("is-weak");
      else if (level === 2) strengthWrap.classList.add("is-medium");
      else if (level === 3) strengthWrap.classList.add("is-strong");
    }

    pwInput.addEventListener("input", (e) => {
      updateStrengthUI(e.target.value);
    });
  }

  setupPasswordStrength();

  /* =====================================
     8) Google Sign-In
  ====================================== */

  const googleLoginBtn = document.getElementById("googleLoginBtn");

  async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: "select_account",
    });

    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    if (!user) {
      throw new Error("NO_GOOGLE_USER");
    }

    await saveUserProfile(user, {
      provider: "google",
      name: user.displayName || "مستخدم",
      email: user.email || "",
    });

    window.location.href = "home.html";
  }

  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", async () => {
      try {
        setButtonLoading(googleLoginBtn, true, "جاري فتح Google...", "المتابعة باستخدام حساب Google");
        await signInWithGoogle();
      } catch (error) {
        console.error("Google sign-in error:", error);
        showAuthError(getFirebaseErrorMessage(error));
      } finally {
        setButtonLoading(googleLoginBtn, false, "جاري فتح Google...", "المتابعة باستخدام حساب Google");
      }
    });
  }

  /* =====================================
     9) Sign Up with Gmail + Password
  ====================================== */

  const signupForm = document.getElementById("signup-panel");
  const signupSubmitBtn = document.getElementById("signupSubmitBtn");

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = signupForm.querySelector("#signup-name")?.value.trim() || "";
      const email = normalizeEmail(signupForm.querySelector("#signup-email")?.value || "");
      const passVal = signupForm.querySelector("#signup-password")?.value.trim() || "";
      const confirm = signupForm.querySelector("#signup-password-confirm")?.value.trim() || "";

      if (!name || !email || !passVal || !confirm) {
        showAuthError("يرجى تعبئة جميع الحقول.");
        return;
      }

      if (REQUIRE_GMAIL_FOR_EMAIL_PASSWORD && !isGmailAddress(email)) {
        showAuthError("يسمح فقط باستخدام بريد Gmail مثل name@gmail.com.");
        return;
      }

      const strength = validatePasswordStrength(passVal);

      if (!strength.ok) {
        showAuthError(strength.msg);
        return;
      }

      if (passVal !== confirm) {
        showAuthError("كلمتا المرور غير متطابقتين.");
        return;
      }

      try {
        setButtonLoading(signupSubmitBtn, true, "جاري إنشاء الحساب...", "إنشاء حساب");

        const userCredential = await auth.createUserWithEmailAndPassword(email, passVal);
        const user = userCredential.user;

        if (user && user.updateProfile) {
          await user.updateProfile({
            displayName: name,
          });
        }

        await saveUserProfile(user, {
          provider: "password",
          name,
          email,
        });

        await auth.signOut();
        localStorage.removeItem("currentUser");

        if (successModal) {
          successModal.hidden = false;
        } else {
          showAuthError("تم إنشاء الحساب بنجاح. يمكنك الآن تسجيل الدخول.");
        }

        signupForm.reset();

        const strengthWrap = document.getElementById("signup-strength");
        const strengthText = document.getElementById("signup-strength-text");

        if (strengthWrap) {
          strengthWrap.classList.remove("is-weak", "is-medium", "is-strong");
        }

        if (strengthText) {
          strengthText.textContent = "—";
        }
      } catch (error) {
        console.error("Signup error:", error);
        showAuthError(getFirebaseErrorMessage(error));
      } finally {
        setButtonLoading(signupSubmitBtn, false, "جاري إنشاء الحساب...", "إنشاء حساب");
      }
    });
  }

  /* =====================================
     10) Login with Gmail + Password
  ====================================== */

  const loginForm = document.getElementById("login-panel");
  const rememberCheckbox = document.getElementById("remember-me");
  const loginSubmitBtn = document.getElementById("loginSubmitBtn");
  const loginEmailInput = document.getElementById("login-email");

  function restoreRememberedEmail() {
    if (!loginEmailInput || !rememberCheckbox) return;

    const rememberMe = localStorage.getItem("rememberMe") === "1";
    const rememberedEmail = localStorage.getItem("rememberedEmail") || "";

    if (rememberMe && rememberedEmail) {
      rememberCheckbox.checked = true;
      loginEmailInput.value = rememberedEmail;
    }
  }

  restoreRememberedEmail();

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = normalizeEmail(loginForm.querySelector("#login-email")?.value || "");
      const pass = loginForm.querySelector("#login-password")?.value.trim() || "";

      if (!email || !pass) {
        showAuthError("يرجى إدخال البريد وكلمة المرور.");
        return;
      }

      if (REQUIRE_GMAIL_FOR_EMAIL_PASSWORD && !isGmailAddress(email)) {
        showAuthError("يسمح فقط باستخدام بريد Gmail مثل name@gmail.com.");
        return;
      }

      try {
        setButtonLoading(loginSubmitBtn, true, "جاري الدخول...", "دخول");

        await auth.setPersistence(
          rememberCheckbox && rememberCheckbox.checked
            ? firebase.auth.Auth.Persistence.LOCAL
            : firebase.auth.Auth.Persistence.SESSION
        );

        const userCredential = await auth.signInWithEmailAndPassword(email, pass);
        const user = userCredential.user;

        const doc = await db.collection("users").doc(user.uid).get();

        let userName = user.displayName || "مستخدم";

        if (doc.exists && doc.data()?.name) {
          userName = doc.data().name;
        }

        await db.collection("users").doc(user.uid).set(
          {
            email: user.email || email,
            name: userName,
            provider: "password",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        saveCurrentUserToLocalStorage(user, userName, "password");

        if (rememberCheckbox && rememberCheckbox.checked) {
          localStorage.setItem("rememberMe", "1");
          localStorage.setItem("rememberedEmail", email);
        } else {
          localStorage.removeItem("rememberMe");
          localStorage.removeItem("rememberedEmail");
        }

        window.location.href = "home.html";
      } catch (error) {
        console.error("Login error:", error);
        showAuthError(getFirebaseErrorMessage(error));
      } finally {
        setButtonLoading(loginSubmitBtn, false, "جاري الدخول...", "دخول");
      }
    });
  }

  /* =====================================
     11) Forgot password
  ====================================== */

  const forgotLink = document.getElementById("forgot-password-link");

  if (forgotLink) {
    forgotLink.addEventListener("click", async (e) => {
      e.preventDefault();

      const email = normalizeEmail(loginEmailInput?.value || "");

      if (!email) {
        showAuthError("اكتبي بريد Gmail أولاً ثم اضغطي نسيت كلمة المرور.");
        return;
      }

      if (REQUIRE_GMAIL_FOR_EMAIL_PASSWORD && !isGmailAddress(email)) {
        showAuthError("يسمح فقط باستخدام بريد Gmail مثل name@gmail.com.");
        return;
      }

      try {
        await auth.sendPasswordResetEmail(email);
        showAuthError("تم إرسال رابط استعادة كلمة المرور إلى بريدك.");
      } catch (error) {
        console.error("Password reset error:", error);
        showAuthError(getFirebaseErrorMessage(error));
      }
    });
  }

  /* =====================================
     12) Footer year
  ====================================== */

  const yearSpan = document.getElementById("year");

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
});