/**
 * ============================================================================
 * JOURNAL.JS - Professional Edition (Anah - Dual Analysis & Sentences)
 * Features: Rich Text Editor, Dual Emotion Detection (Primary/Secondary),
 * Sentence-Level Breakdown, Conflict Resolution, and Data Persistence.
 * ============================================================================
 */

/**
 * 1. Status Modal Utility
 */
function showJournalStatus(message, type = "info") {
  const modal = document.getElementById("journalStatusModal");
  const msgEl = document.getElementById("journalStatusMessage");
  const titleEl = document.getElementById("journalStatusTitle");
  const iconEl = document.getElementById("journalStatusIcon");
  const closeBtn = document.getElementById("closeJournalStatusModal");

  if (!modal || !msgEl || !titleEl || !iconEl || !closeBtn) return;

  msgEl.textContent = message;
  titleEl.textContent = type === "success" ? "تم بنجاح" : (type === "error" ? "تنبيه" : "معلومة");
  iconEl.textContent = type === "success" ? "🎉" : (type === "error" ? "⚠️" : "ℹ️");

  modal.hidden = false;
  closeBtn.onclick = () => (modal.hidden = true);
}

/**
 * Helper Functions
 */
function wordCount(t = "") { return t.trim() ? (t.trim().match(/\S+/g) || []).length : 0; }
function isoToday() { return new Date().toISOString().split("T")[0]; }
function escapeHtml(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Rich Text Editor State Management
 */
let savedRange = null;

function saveSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0);
}

function restoreSelection() {
  const noteEl = document.getElementById("note");
  noteEl.focus();
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
}

window.formatDoc = (cmd, val = null) => { 
  restoreSelection(); 
  document.execCommand(cmd, false, val); 
  saveSelection(); 
};

window.insertEmoji = (emoji) => {
  restoreSelection();
  document.execCommand('insertHTML', false, emoji);
  document.getElementById("emojiPalette").hidden = true;
  saveSelection();
};

/**
 * 2. AI Emotion Analysis (API Call)
 */
async function runLocalAnalysis(text) {
  try {
    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) throw new Error(`AI server error`);

    const data = await response.json();
    
    return {
      finalMood: data.finalMood || "غير محدد",
      secondaryMood: data.secondaryMood || null,
      moodCounts: data.moodCounts || {},
      sentencesDetails: data.sentencesDetails || []
    };
  } catch (error) {
    console.error("AI Server Error:", error);
    return { finalMood: "⚠️ فشل الاتصال", secondaryMood: null, moodCounts: {}, sentencesDetails: [] };
  }
}

/**
 * 3. Star Rating System
 */
let selectedRating = 0;
function initRating() {
  const stars = Array.from(document.querySelectorAll("#rating button[data-v]"));
  const paint = (n) => {
    selectedRating = n;
    stars.forEach(btn => btn.classList.toggle("active", Number(btn.dataset.v) <= n));
    if (document.getElementById("ratingText")) {
      document.getElementById("ratingText").textContent = `قيّم يومك: ${n}/5`;
    }
  };
  document.getElementById("rating")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-v]");
    if (btn) paint(Number(btn.dataset.v));
  });
  paint(0);
}

/**
 * 4. Save Journal Entry (With Dual Emotion Data)
 */
async function saveTodayEntry() {
  const saveBtn = document.getElementById("save");
  const noteEl = document.getElementById("note");
  const textContent = noteEl.innerText.trim();
  const htmlContent = noteEl.innerHTML.trim();

  if (!textContent) return showJournalStatus("يرجى كتابة نص أولاً", "error");

  const user = firebase.auth().currentUser;
  if (!user) return showJournalStatus("يرجى تسجيل الدخول", "error");

  const today = isoToday();
  const userRef = firebase.firestore().collection("users").doc(user.uid);

  try {
    const emojiDoc = await userRef.collection("emoji_moods").doc(today).get();
    if (emojiDoc.exists) {
      if (!(await showJournalChoiceModal())) return; 
      await userRef.collection("emoji_moods").doc(today).delete(); 
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "جاري التحليل المفصل...";

    const analysis = await runLocalAnalysis(textContent);

    await userRef.collection("entries").doc(today).set({
      text: textContent,
      html: htmlContent,
      rating: selectedRating,
      words: wordCount(textContent),
      finalMood: analysis.finalMood,
      secondaryMood: analysis.secondaryMood,
      moodCounts: analysis.moodCounts,         
      sentencesDetails: analysis.sentencesDetails, 
      savedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    let msg = `تم الحفظ! الشعور الغالب: ${analysis.finalMood}`;
if (analysis.secondaryMood) msg += `، ممزوجاً بشعور: ${analysis.secondaryMood}`;
    showJournalStatus(msg, "success");
    
    noteEl.innerHTML = ""; 
    initRating();

  } catch (err) {
    console.error("Firestore Save Error:", err);
    showJournalStatus("حدث خطأ أثناء الحفظ.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "حفظ المذكرة";
  }
}

/**
 * 5. View Unified History (Dual Badges Render) - FIXED
 */
async function openAllEntriesModal() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const viewContent = document.getElementById("viewContent");
  document.getElementById("viewModal").hidden = false;
  viewContent.innerHTML = "<p style='padding:20px'>جاري جلب مذكراتك المحللة...</p>";

  try {
    const userRef = firebase.firestore().collection("users").doc(user.uid);
    const [eSnap, jSnap] = await Promise.all([
      userRef.collection("emoji_moods").get(), 
      userRef.collection("entries").get()
    ]);

    const history = new Map();
    
    // Add Emoji entries to history
    eSnap.forEach(d => {
        history.set(d.id, { 
            mood: d.data().mood, 
            type: 'إيموجي ✨', 
            date: d.id 
        });
    });
    
    // Add Journal entries to history
    jSnap.forEach(d => {
      const data = d.data();
      history.set(d.id, { 
        ...data, 
        // Ensure we are grabbing the correct finalMood and secondaryMood
        mood: data.finalMood || "غير محدد", 
        secondaryMood: data.secondaryMood || null, 
        type: 'يومية 📝', 
        date: d.id 
      });
    });

    const sorted = Array.from(history.values()).sort((a, b) => b.date.localeCompare(a.date));

    viewContent.innerHTML = sorted.map(item => {
      let moodBadges = "";

      // Construct badges based on entry type (Emoji vs. Journal)
      if (item.type === 'إيموجي ✨') {
          moodBadges = `<span class="mood-badge" style="background:rgba(162,155,254,0.15); color:var(--purple); padding:4px 12px; border-radius:20px; font-weight:bold; font-size:0.85rem;">${item.mood}</span>`;
      } else {
          // It's a Journal entry, so display Primary and Secondary
          moodBadges = `<span class="mood-badge" style="background:rgba(162,155,254,0.15); color:var(--purple); padding:4px 12px; border-radius:20px; font-weight:bold; font-size:0.85rem;">أساسي: ${item.mood}</span>`;
          
          if (item.secondaryMood) {
            moodBadges += ` <span class="mood-badge" style="background:rgba(200,200,200,0.15); color:#666; padding:4px 12px; border-radius:20px; font-weight:bold; font-size:0.8rem; margin-right:5px;">ثانوي: ${item.secondaryMood}</span>`;
          }
      }

      let sentencesHtml = "";
      if (item.sentencesDetails && item.sentencesDetails.length > 0) {
        sentencesHtml = `<div class="sentence-breakdown" style="margin-top:10px; border-top:1px dashed #eee; padding-top:10px;">
          <small style="color:#888; display:block; margin-bottom:5px;">تحليل الجمل الذكي:</small>
          ${item.sentencesDetails.map(s => `
            <div style="font-size:0.85rem; margin-bottom:4px; display:flex; justify-content:space-between; background:#f9f9f9; padding:4px 8px; border-radius:8px;">
              <span style="color:#555;">"${s.sentence}"</span>
              <strong style="color:var(--purple); min-width:60px; text-align:left;">${s.mood}</strong>
            </div>
          `).join("")}
        </div>`;
      }

      return `
        <div class="entry-card" style="border:1px solid #eee; border-radius:18px; padding:16px; margin-bottom:15px; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <strong style="color:var(--purple);">${item.date}</strong>
            <div style="display:flex; align-items:center;">${moodBadges}</div>
          </div>
          <div style="color:#999; font-size:0.75rem; margin:5px 0;">المصدر: ${item.type}</div>
          <div style="margin:10px 0; line-height:1.6;">${item.html || escapeHtml(item.text)}</div>
          ${sentencesHtml}
        </div>
      `;
    }).join("");
  } catch (err) { 
    viewContent.innerHTML = "خطأ في التحميل."; 
    console.error(err);
  }
}

/**
 * Conflict Resolution Modal
 */
function showJournalChoiceModal() {
  const modal = document.getElementById("journalChoiceModal");
  return new Promise(resolve => {
    modal.hidden = false;
    document.getElementById("confirmChoiceBtn").onclick = () => { 
      modal.hidden = true; 
      resolve(true); 
    };
    document.getElementById("cancelChoiceBtn").onclick = () => { 
      modal.hidden = true; 
      resolve(false); 
    };
  });
}

/**
 * Initialization & Event Listeners
 */
document.addEventListener("DOMContentLoaded", () => {
  initRating();
  
  if (typeof initAchievementsUI === "function") initAchievementsUI();
  
  document.getElementById("save")?.addEventListener("click", saveTodayEntry);
  document.getElementById("showAll")?.addEventListener("click", openAllEntriesModal);
  document.getElementById("closeModal")?.addEventListener("click", () => document.getElementById("viewModal").hidden = true);
  
  document.getElementById("emojiBtn")?.addEventListener("click", () => {
    const p = document.getElementById("emojiPalette"); 
    if (p) p.hidden = !p.hidden;
  });

  document.getElementById("imageUpload")?.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => { 
        restoreSelection(); 
        document.execCommand('insertImage', false, ev.target.result); 
        saveSelection(); 
      };
      reader.readAsDataURL(file);
    }
  });

  const note = document.getElementById("note");
  if(note) {
    ["keyup", "mouseup", "focusout"].forEach(ev => note.addEventListener(ev, saveSelection));
  }
});