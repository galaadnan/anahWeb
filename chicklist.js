/* ============================================================
   chicklist.js – TODO LIST FIXED
   ✅ Works with existing home.html IDs/classes
   ✅ Open/close form via #startChallengeBtn
   ✅ Add / Edit / Toggle Done / Delete
   ✅ Counters: #tasksTotalCount / #tasksDoneCount
   ✅ Progress ring: .progress-ring-fill + #progressText
   ✅ LocalStorage per-day
   ✅ Arabic/Persian digits support
   ✅ FIX: no page jump / no scrollIntoView
   ✅ FIX: form stays open after saving so page height does not shrink
============================================================ */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ chicklist.js loaded - fixed version");

    /* =========================
       0) Helpers
    ========================= */

    function isoTodayLocal() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    const TODAY = isoTodayLocal();
    const STORAGE_KEY = `anah_tasks_${TODAY}`;
    const MAX_MINUTES = 600;

    function trimStr(value) {
      return String(value ?? "").trim();
    }

    function normalizeDigits(str = "") {
      const arabicDigits = {
        "٠": "0",
        "١": "1",
        "٢": "2",
        "٣": "3",
        "٤": "4",
        "٥": "5",
        "٦": "6",
        "٧": "7",
        "٨": "8",
        "٩": "9"
      };

      const persianDigits = {
        "۰": "0",
        "۱": "1",
        "۲": "2",
        "۳": "3",
        "۴": "4",
        "۵": "5",
        "۶": "6",
        "۷": "7",
        "۸": "8",
        "۹": "9"
      };

      return String(str)
        .replace(/[٠-٩]/g, (digit) => arabicDigits[digit] || digit)
        .replace(/[۰-۹]/g, (digit) => persianDigits[digit] || digit);
    }

    function arabicMinutesLabel(num) {
      num = Number(num);

      if (num === 1) return "دقيقة واحدة";
      if (num === 2) return "دقيقتان";
      if (num >= 3 && num <= 10) return `${num} دقائق`;

      return `${num} دقيقة`;
    }

    function safeId() {
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    /* =========================
       1) Elements
    ========================= */

    const startChallengeBtn = document.getElementById("startChallengeBtn");
    const newTaskContainer = document.getElementById("newTaskContainer");
    const saveTaskBtn = document.getElementById("saveTaskBtn");
    const taskList = document.getElementById("taskList");

    const descInput = document.getElementById("taskDescription");
    const timeInput = document.getElementById("taskTime");
    const taskTimeError = document.getElementById("taskTimeError");

    const emojiButtons = document.querySelectorAll("#emojiSelector .emoji");

    const totalCountEl = document.getElementById("tasksTotalCount");
    const doneCountEl = document.getElementById("tasksDoneCount");

    const emptyModal = document.getElementById("emptyTaskModal");
    const closeEmptyBtn = document.getElementById("closeEmptyTaskModal");

    const timeModal = document.getElementById("timeAlertModal");
    const closeTimeBtn = document.getElementById("closeTimeAlertModal");

    const ringFill = document.querySelector(".progress-ring-fill");
    const progressTextEl = document.getElementById("progressText");

    if (
      !startChallengeBtn ||
      !newTaskContainer ||
      !saveTaskBtn ||
      !taskList ||
      !descInput ||
      !timeInput
    ) {
      console.error("❌ Missing required DOM elements for checklist.");
      return;
    }

    /* =========================
       2) State
    ========================= */

    let selectedEmoji = "☀️";
    let editingTaskId = null;

    const DEFAULT_TIME_MODAL_TEXT =
      "يجب تحديد وقت تقريبي للمهمة (بالدقائق).<br>اكتب رقمًا فقط (مثلاً: 15).";

    /* =========================
       3) Storage
    ========================= */

    function loadTasks() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function saveTasks(tasks) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks || []));
      } catch (error) {
        console.error("❌ Could not save tasks:", error);
      }
    }

    /* =========================
       4) Modal helpers
    ========================= */

    function openModal(modalEl) {
      if (!modalEl) return;
      modalEl.hidden = false;
    }

    function closeModal(modalEl) {
      if (!modalEl) return;
      modalEl.hidden = true;
    }

    function resetTimeModalText() {
      if (!timeModal) return;

      const body = timeModal.querySelector(".time-body");
      if (body) body.innerHTML = DEFAULT_TIME_MODAL_TEXT;
    }

    if (closeEmptyBtn && emptyModal) {
      closeEmptyBtn.addEventListener("click", () => closeModal(emptyModal));
    }

    if (closeTimeBtn && timeModal) {
      closeTimeBtn.addEventListener("click", () => {
        closeModal(timeModal);
        resetTimeModalText();
      });
    }

    /* =========================
       5) Form helpers
    ========================= */

    function isFormVisible() {
      return getComputedStyle(newTaskContainer).display !== "none";
    }

    function showForm(show) {
      newTaskContainer.style.display = show ? "block" : "none";

      if (show) {
        setTimeout(() => descInput.focus(), 80);
      }
    }

    function clearInlineErrors() {
      if (taskTimeError) taskTimeError.textContent = "";
      timeInput.removeAttribute("aria-invalid");
      descInput.removeAttribute("aria-invalid");
    }

    function setInlineTimeError(message) {
      if (taskTimeError) taskTimeError.textContent = message;
      timeInput.setAttribute("aria-invalid", "true");
    }

    function resetForm() {
      editingTaskId = null;
      saveTaskBtn.textContent = "حفظ المهمة";
      descInput.value = "";
      timeInput.value = "";
      setActiveEmoji("☀️");
      clearInlineErrors();
      resetTimeModalText();
    }

    // الفورم يبدأ مخفي
    showForm(false);

    startChallengeBtn.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        const willShow = !isFormVisible();

        showForm(willShow);

        if (willShow) {
          resetForm();
        }
      },
      true
    );

    /* =========================
       6) Emoji picker
    ========================= */

    function setActiveEmoji(char) {
      selectedEmoji = trimStr(char) || "☀️";

      emojiButtons.forEach((button) => {
        const buttonEmoji = button.textContent.trim();
        button.classList.toggle("is-active", buttonEmoji === selectedEmoji);
      });
    }

    if (emojiButtons.length) {
      emojiButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          setActiveEmoji(button.textContent.trim());
        });
      });
    }

    setActiveEmoji("☀️");

    /* =========================
       7) Progress ring + counters
    ========================= */

    let ringCircumference = 0;

    if (ringFill) {
      const radius = Number(ringFill.getAttribute("r") || 58);
      ringCircumference = 2 * Math.PI * radius;

      ringFill.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
      ringFill.style.strokeDashoffset = String(ringCircumference);
      ringFill.style.transition = "stroke-dashoffset 450ms ease";
    }

    function setRingProgress(percent) {
      const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));

      if (progressTextEl) {
        progressTextEl.textContent = `${Math.round(safePercent)}%`;
      }

      if (!ringFill || !ringCircumference) return;

      const offset = ringCircumference * (1 - safePercent / 100);
      ringFill.style.strokeDashoffset = String(offset);
    }

    function updateCountersAndRing(tasks) {
      const total = tasks.length;
      const done = tasks.filter((task) => task.done).length;

      if (totalCountEl) totalCountEl.textContent = String(total);
      if (doneCountEl) doneCountEl.textContent = String(done);

      const percent = total ? (done / total) * 100 : 0;
      setRingProgress(percent);
    }

    /* =========================
       8) Render tasks
    ========================= */

    function render() {
      const tasks = loadTasks();

      if (!tasks.length) {
        taskList.innerHTML = `
          <p style="font-size:0.86rem; opacity:0.75;">
            لا توجد مهام بعد. اضغط "ابدأ تحدّي المهام" لإضافة أول مهمة.
          </p>
        `;

        updateCountersAndRing(tasks);
        return;
      }

      taskList.innerHTML = tasks
        .map((task) => {
          const doneClass = task.done ? " is-done" : "";
          const minutesLabel = arabicMinutesLabel(task.minutes || 0);

          return `
            <div class="task-card${doneClass}" data-id="${escapeHtml(task.id)}" role="listitem">
              <div class="task-details">
                <span class="emoji">${escapeHtml(task.emoji || "☀️")}</span>

                <div>
                  <div class="description">${escapeHtml(task.description || "")}</div>
                  <div class="time">المدة: ${escapeHtml(minutesLabel)}</div>
                </div>
              </div>

              <div class="task-actions">
                <button type="button" class="task-toggle" aria-pressed="${task.done ? "true" : "false"}">
                  ${task.done ? "إلغاء" : "تم"}
                </button>

                <button type="button" class="task-edit">
                  تعديل
                </button>

                <button type="button" class="task-delete" aria-label="حذف المهمة">
                  ✕
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      updateCountersAndRing(tasks);
    }

    /* =========================
       9) Task actions
    ========================= */

    taskList.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      const card = event.target.closest(".task-card");
      if (!card) return;

      const id = card.getAttribute("data-id");
      if (!id) return;

      const tasks = loadTasks();
      const index = tasks.findIndex((task) => task.id === id);

      if (index === -1) return;

      // Toggle done
      if (button.classList.contains("task-toggle")) {
        tasks[index].done = !tasks[index].done;

        saveTasks(tasks);
        render();
        return;
      }

      // Delete
      if (button.classList.contains("task-delete")) {
        const wasEditingThisTask = editingTaskId === id;

        tasks.splice(index, 1);

        saveTasks(tasks);
        render();

        if (wasEditingThisTask) {
          resetForm();
          showForm(true);
        }

        return;
      }

      // Edit
      if (button.classList.contains("task-edit")) {
        const task = tasks[index];

        editingTaskId = task.id;
        descInput.value = task.description || "";
        timeInput.value = String(task.minutes || "");
        setActiveEmoji(task.emoji || "☀️");

        saveTaskBtn.textContent = "تحديث المهمة";
        clearInlineErrors();
        showForm(true);

        setTimeout(() => descInput.focus(), 80);
      }
    });

    /* =========================
       10) Save add/update
    ========================= */

    saveTaskBtn.addEventListener("click", (event) => {
      event.preventDefault();

      clearInlineErrors();

      const description = trimStr(descInput.value);
      const minutesRaw = trimStr(timeInput.value);
      const normalizedMinutes = normalizeDigits(minutesRaw);
      const minutes = parseInt(normalizedMinutes, 10);

      if (!description) {
        descInput.setAttribute("aria-invalid", "true");
        openModal(emptyModal);
        return;
      }

      if (!normalizedMinutes || Number.isNaN(minutes) || minutes <= 0) {
        setInlineTimeError("اكتبي مدة صحيحة بالدقائق.");
        openModal(timeModal);
        return;
      }

      if (minutes > MAX_MINUTES) {
        setInlineTimeError(`الحد الأعلى هو ${MAX_MINUTES} دقيقة.`);

        if (timeModal) {
          const body = timeModal.querySelector(".time-body");

          if (body) {
            body.innerHTML =
              `المدة القصوى للمهمة الواحدة هي ${MAX_MINUTES} دقيقة.<br>قسّميها لمهام أصغر.`;
          }
        }

        openModal(timeModal);
        return;
      }

      const tasks = loadTasks();

      if (editingTaskId) {
        const index = tasks.findIndex((task) => task.id === editingTaskId);

        if (index !== -1) {
          tasks[index] = {
            ...tasks[index],
            emoji: selectedEmoji || "☀️",
            description,
            minutes
          };
        }
      } else {
        tasks.push({
          id: safeId(),
          emoji: selectedEmoji || "☀️",
          description,
          minutes,
          done: false,
          createdAt: Date.now()
        });
      }

      saveTasks(tasks);
      render();

      // مهم: نخلي الفورم ظاهر بعد الحفظ عشان الصفحة ما "تنقص" فجأة
      resetForm();
      showForm(true);
    });

    /* =========================
       11) Prevent form refresh
    ========================= */

    const form = document.getElementById("newTaskForm");

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
      });
    }

    /* =========================
       12) Init
    ========================= */

    render();
  });
})();