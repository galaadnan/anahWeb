document.addEventListener("DOMContentLoaded", () => {

  /* ============================================================
   1. Date Display
   ============================================================ */
  const dateEl = document.getElementById("today-date");
  const yearEl = document.getElementById("year");

  if (dateEl) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("ar-SA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    dateEl.textContent = formatter.format(now);
  }

  if (yearEl) yearEl.textContent = new Date().getFullYear();


  /* ============================================================
   2. Mood Orb Interaction
   ============================================================ */
  const moodOrb = document.getElementById("mood-orb");
  const moodImage = document.getElementById("mood-image");
  const moodLabel = document.getElementById("mood-label");
  const chips = document.querySelectorAll(".mood-chip");
  const moodClasses = ['angry', 'sad', 'happy', 'tired', 'stressed', 'calm'];

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");

      const mood = chip.dataset.mood;
      const img = chip.dataset.image;
      const label = chip.dataset.label;

      moodOrb.classList.remove(...moodClasses);
      moodOrb.classList.add(mood);

      moodImage.src = img;
      moodImage.animate([
        { transform: "scale(0.8)", opacity: 0.5 },
        { transform: "scale(1)", opacity: 1 }
      ], { duration: 300 });

      moodLabel.textContent = label;
    });
  });


  /* ============================================================
     3. Scroll Reveal Animation
  ============================================================ */
  const revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }


  /* ============================================================
     4. Smooth Scrolling  (FIXED)
  ============================================================ */
  document.querySelectorAll("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.querySelector(btn.dataset.scroll);
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

}); // END DOMContentLoaded




/* ============================================================
   5. Back To Top Button
============================================================ */
const backTop = document.getElementById("backTop");

window.addEventListener("scroll", () => {
  backTop.classList.toggle("show", window.scrollY > 600);
});

backTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});