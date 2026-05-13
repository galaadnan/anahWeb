/**
 * ============================================================================
 * JOURNAL.JS - Professional Edition (Anah)
 * Features: Rich Editor, Dual Emotion, Achievements, Daily Prompts.
 * ============================================================================
 */

// Function to display status messages (success, error, info) using a custom modal
function showJournalStatus(message, type = "info") {
  // Get UI elements for the status modal
  const modal = document.getElementById("journalStatusModal");
  const msgEl = document.getElementById("journalStatusMessage");
  const titleEl = document.getElementById("journalStatusTitle");
  const iconEl = document.getElementById("journalStatusIcon");
  const closeBtn = document.getElementById("closeJournalStatusModal");

  // Safety check: ensure all modal elements exist before proceeding
  if (!modal || !msgEl || !titleEl || !iconEl || !closeBtn) return;

  // Set the text content of the message
  msgEl.textContent = message;
  // Set the title based on the message type (Success, Alert, or Info)
  titleEl.textContent = type === "success" ? "تم بنجاح" : (type === "error" ? "تنبيه" : "معلومة");
  // Set the emoji icon based on the message type
  iconEl.textContent = type === "success" ? "🎉" : (type === "error" ? "⚠️" : "ℹ️");

  // Make the modal visible
  modal.hidden = false;
  // Handle modal closing when the button is clicked
  closeBtn.onclick = () => (modal.hidden = true);
}

// Utility function to count words in a string by matching non-whitespace sequences
function wordCount(t = "") { return t.trim() ? (t.trim().match(/\S+/g) || []).length : 0; }
// Utility to get today's date in YYYY-MM-DD format (ISO standard)
function isoToday() { return new Date().toISOString().split("T")[0]; }
// Utility to sanitize HTML and prevent Cross-Site Scripting (XSS)
function escapeHtml(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Global variable to store the cursor position in the rich text editor
let savedRange = null;

// Function to save the current text selection/cursor position
function saveSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0);
}

// Function to put the focus back on the editor and restore the cursor position
function restoreSelection() {
  const noteEl = document.getElementById("note");
  noteEl.focus(); // Focus on the editor
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges(); // Clear current selections
    sel.addRange(savedRange); // Restore the saved range
  }
}

// Wrapper for document.execCommand to apply text formatting (bold, italic, etc.)
window.formatDoc = (cmd, val = null) => { 
  restoreSelection(); // Ensure the cursor is in the right place
  document.execCommand(cmd, false, val); // Execute browser formatting command
  saveSelection(); // Update the saved selection
};

// Function to insert an emoji into the editor content
window.insertEmoji = (emoji) => {
  restoreSelection();
  document.execCommand('insertHTML', false, emoji); // Insert emoji as HTML
  const p = document.getElementById("emojiPalette");
  if(p) p.hidden = true; // Hide the emoji picker after selection
  saveSelection();
};

/**
 * Daily Prompts - 30 questions for user inspiration
 */
const dailyPrompts = [
  // Group 1: Gratitude and Beautiful Moments
  "ما هو أكثر شيء تشعر بالامتنان له اليوم؟",
  "موقف بسيط أسعدك أو أضحكك اليوم؟",
  "من هو الشخص الذي أحدث فرقاً في يومك ولو بكلمة بسيطة؟",
  "رائحة، صوت، أو منظر جذب انتباهك وشعرت بجماله اليوم؟",
  "ما هو الجزء المفضل من روتينك اليومي ولماذا؟",
  "شيء قمت به اليوم لتعتني بنفسك (Self-care)؟",

  // Group 2: Self-Analysis and Feelings
  "لو كان ليومك عنوان، ماذا سيكون؟",
  "ما هو الشعور الغالب عليك الآن ولماذا؟",
  "صف شعورك الآن باستخدام لون، ولماذا اخترت هذا اللون؟",
  "كلمة واحدة تصف فيها طاقتك الآن؟",
  "أين شعرت بمشاعرك في جسدك اليوم؟ (مثلاً: خفة في القلب، أو ضيق؟)",
  "ما هو الفرق بين طاقتك في الصباح وطاقتك الآن؟",

  // Group 3: Challenges and Growth
  "تحدي واجهته اليوم وكيف تعاملت معه؟",
  "ما هو الدرس البسيط الذي تعلمته من أحداث اليوم؟",
  "شيء كنت تخشاه اليوم واكتشفت أنه أبسط مما توقعت؟",
  "هل خرجت من منطقة راحتك اليوم؟ وكيف كان شعورك؟",
  "شيء قلت له 'لا' اليوم لحماية وقتك أو طاقتك؟",
  "شيء قررت التخلي عنه اليوم لترتاح نفسياً؟",

  // Group 4: Achievements and Work
  "إنجاز صغير قمت به اليوم وتفتخر به؟",
  "ما هو الشيء الذي جعلك تشعر بالفخر بنفسك اليوم؟",
  "ماذا فعلت اليوم لتجعل حياة شخص آخر أسهل أو أجمل؟",
  "فكرة ملهمة أو جملة قرأتها اليوم ولامست قلبك؟",
  "شيء واحد تتمنى إنجازه غداً؟",

  // Group 5: Future Reflections and Messages
  "رسالة تود توجيهها لنفسك في نهاية هذا اليوم؟",
  "لو كان بإمكانك إعادة لحظة واحدة من يومك، أي لحظة ستختار؟",
  "لو زارك شخص يحبك الآن، ماذا سيقول عنك وعن يومك؟",
  "لو كتبت رسالة لنفسك بعد عام من الآن، ماذا ستحكي لها عن يومك؟",
  "فكرة أو خاطرة لم تفارق ذهنك اليوم؟",
  "ما هو الصوت أو اللحن الذي كان رفيقاً لمزاجك اليوم؟",
  "ركن أو مكان شعرت فيه بالراحة والسكينة اليوم؟"
];

// Initialize the daily prompt UI
function initDailyPrompt() {
  const textEl = document.getElementById("dailyPromptText");
  const btnEl = document.getElementById("newPromptBtn");
  if (!textEl || !btnEl) return;

  // Function to select and display a random prompt
  const setRandomPrompt = () => {
    const random = dailyPrompts[Math.floor(Math.random() * dailyPrompts.length)];
    textEl.textContent = random;
  };

  setRandomPrompt(); // Initial load
  btnEl.addEventListener("click", setRandomPrompt); // Change on button click
}

// Function to call the AI Emotion Recognition API on Render
async function runLocalAnalysis(text) {
  try {
    // API Call to the sentiment analysis model hosted on Render
    const response = await fetch("https://anahweb.onrender.com/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(`AI server error`);
    const data = await response.json();
    // Return structured analysis results (Primary and secondary emotions)
    return {
      finalMood: data.finalMood || "غير محدد",
      secondaryMood: data.secondaryMood || null,
      moodCounts: data.moodCounts || {},
      sentencesDetails: data.sentencesDetails || []
    };
  } catch (error) {
    console.error("AI Server Error:", error);
    // Return fallback values in case of API failure
    return { finalMood: "⚠️ فشل الاتصال", secondaryMood: null, moodCounts: {}, sentencesDetails: [] };
  }
}

// Main function to save the journal entry to Firebase Firestore
async function saveTodayEntry() {
  const saveBtn = document.getElementById("save");
  const noteEl = document.getElementById("note");
  const textContent = noteEl.innerText.trim(); // Plain text for analysis
  const htmlContent = noteEl.innerHTML.trim(); // HTML for preserving formatting

  // Validation: Check if the editor is empty
  if (!textContent) return showJournalStatus("يرجى كتابة نص أولاً", "error");

  // Check if the user is authenticated
  const user = firebase.auth().currentUser;
  if (!user) return showJournalStatus("يرجى تسجيل الدخول", "error");

  const today = isoToday(); // Date key
  const userRef = firebase.firestore().collection("users").doc(user.uid);

  try {
    // Check if the user already chose an emoji mood for today
    const emojiDoc = await userRef.collection("emoji_moods").doc(today).get();
    if (emojiDoc.exists) {
      // If an emoji mood exists, ask the user if they want to override it with a text journal
      if (!(await showJournalChoiceModal())) return;

      // Delete the temporary emoji mood to prioritize the deep text analysis
      await userRef.collection("emoji_moods").doc(today).delete();
      localStorage.removeItem("anah_current_mood"); // Clear local storage cache
    }

    // Visual feedback during processing
    saveBtn.disabled = true;
    saveBtn.textContent = "جاري التحليل المفصل...";

    // Execute the AI analysis on the text
    const analysis = await runLocalAnalysis(textContent);

    // Save the journal entry and analysis results to Firestore
    await userRef.collection("entries").doc(today).set({
      text: textContent,
      html: htmlContent,
      words: wordCount(textContent),
      finalMood: analysis.finalMood,
      secondaryMood: analysis.secondaryMood,
      moodCounts: analysis.moodCounts,          
      sentencesDetails: analysis.sentencesDetails, 
      savedAt: firebase.firestore.FieldValue.serverTimestamp(), // Server-side timestamp
    }, { merge: true }); // Merge with existing data if applicable

    // Display success notification with the detected emotions
    let msg = `تم الحفظ! الشعور الغالب: ${analysis.finalMood}`;
    if (analysis.secondaryMood) msg += `، ممزوجاً بشعور: ${analysis.secondaryMood}`;
    showJournalStatus(msg, "success");
    
    noteEl.innerHTML = ""; // Clear editor after saving
    if(typeof initAchievementsUI === "function") initAchievementsUI(); // Refresh achievements after saving

  } catch (err) {
    console.error("Firestore Save Error:", err);
    showJournalStatus("حدث خطأ أثناء الحفظ.", "error");
  } finally {
    // Reset save button state
    saveBtn.disabled = false;
    saveBtn.textContent = "حفظ المذكرة";
  }
}

// Function to open the history modal and display all past entries
async function openAllEntriesModal() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const viewContent = document.getElementById("viewContent");
  document.getElementById("viewModal").hidden = false;
  viewContent.innerHTML = "<p style='padding:20px'>جاري جلب مذكراتك المحللة...</p>";

  try {
    const userRef = firebase.firestore().collection("users").doc(user.uid);
    // Fetch both emoji moods and text entries simultaneously
    const [eSnap, jSnap] = await Promise.all([
      userRef.collection("emoji_moods").get(), 
      userRef.collection("entries").get()
    ]);

    const history = new Map(); // Use Map to prevent duplicates for the same date
    
    // Store emoji moods in the history map
    eSnap.forEach(d => {
        history.set(d.id, { mood: d.data().mood, type: 'إيموجي ✨', date: d.id });
    });
    
    // Store text entries (overwrites emoji if date is same) in the history map
    jSnap.forEach(d => {
      const data = d.data();
      history.set(d.id, { 
        ...data, 
        mood: data.finalMood || "غير محدد", 
        secondaryMood: data.secondaryMood || null, 
        type: 'يومية 📝', 
        date: d.id 
      });
    });

    // Sort entries by date in descending order (Newest first)
    const sorted = Array.from(history.values()).sort((a, b) => b.date.localeCompare(a.date));

    // Map sorted data to HTML structure for the modal
    viewContent.innerHTML = sorted.map(item => {
      let moodBadges = "";
      if (item.type === 'إيموجي ✨') {
          moodBadges = `<span class="mood-badge" style="background:rgba(162,155,254,0.15); color:var(--purple); padding:4px 12px; border-radius:20px; font-weight:bold; font-size:0.85rem;">${item.mood}</span>`;
      } else {
          // Display primary and secondary mood badges for AI analyzed entries
          moodBadges = `<span class="mood-badge" style="background:rgba(162,155,254,0.15); color:var(--purple); padding:4px 12px; border-radius:20px; font-weight:bold; font-size:0.85rem;">أساسي: ${item.mood}</span>`;
          if (item.secondaryMood) {
            moodBadges += ` <span class="mood-badge" style="background:rgba(200,200,200,0.15); color:#666; padding:4px 12px; border-radius:20px; font-weight:bold; font-size:0.8rem; margin-right:5px;">ثانوي: ${item.secondaryMood}</span>`;
          }
      }

      // Generate HTML for sentence-level AI analysis breakdown
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

      // Return the final card HTML for each history item
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
  }
}

/**
 * Achievements System - Streaks and Badges
 */

// Helper to convert date strings back to JavaScript Date objects
function parseISODate(id) {
  const [y, m, d] = String(id).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Calculate the number of days between two dates
function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000; // Milliseconds in a day
  return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / ms);
}

// Initialize and update the Achievements section in the UI
async function initAchievementsUI() {
  const box = document.getElementById("achievements");
  const list = document.getElementById("achvList");
  
  const user = firebase.auth().currentUser;
  if (!user || !box || !list) return;

  try {
    const db = firebase.firestore();
    const userRef = db.collection("users").doc(user.uid);

    // Fetch all mood records for streak calculation
    const [eSnap, jSnap] = await Promise.all([userRef.collection("emoji_moods").get(), userRef.collection("entries").get()]);
    
    // Create a sorted list of unique activity dates
    const allDates = [...new Set([...eSnap.docs.map(d => d.id), ...jSnap.docs.map(d => d.id)])].sort();
    
    let best = 0, current = 0;
    if (allDates.length > 0) {
      let run = 1; best = 1;
      // Calculate best streak (consecutive days)
      for (let i = 1; i < allDates.length; i++) {
        if (daysBetween(parseISODate(allDates[i-1]), parseISODate(allDates[i])) === 1) run++;
        else run = 1;
        if (run > best) best = run;
      }
      // Calculate current active streak
      current = (daysBetween(parseISODate(allDates[allDates.length-1]), new Date()) <= 1) ? run : 0;
    }

    // Update streak numbers in UI
    const curEl = document.getElementById("curStreak");
    const bestEl = document.getElementById("bestStreak");
    if(curEl) curEl.textContent = current;
    if(bestEl) bestEl.textContent = best;

    // Calculate total words written across all entries
    const totalWords = jSnap.docs.reduce((sum, d) => sum + (Number(d.data()?.words) || 0), 0);
    
    // Check if the user has ever recorded mixed/complex emotions
    const hasMixedEmotions = jSnap.docs.some(d => d.data()?.secondaryMood != null);

    // Define the list of achievements and their unlock conditions
    const achvs = [
      { title: "أول تدوينة", desc: "سجلت أول شعور لك.", unlocked: allDates.length >= 1, icon: "✍️" },
      { title: "سلسلة ٣ أيام", desc: "تابعت مشاعرك لـ ٣ أيام.", unlocked: best >= 3, icon: "🔥" },
      { title: "٣٠٠ كلمة", desc: "كتبت أكثر من ٣٠٠ كلمة.", unlocked: totalWords >= 300, icon: "📝" },
      { title: "مشاعر عميقة", desc: "كتبت يومية تحتوي على مشاعر مركبة.", unlocked: hasMixedEmotions, icon: "🌌" }
    ];

    // Generate HTML for achievement cards
    list.innerHTML = achvs.map(a => `
      <div class="achv-card ${a.unlocked ? "is-unlocked" : ""}">
        <div class="achv-content"><div class="achv-icon">${a.icon}</div><div class="achv-text"><strong>${a.title}</strong><small>${a.desc}</small></div></div>
        <div class="achv-badge">${a.unlocked ? "مفتوح" : "مغلق"}</div>
      </div>
    `).join("");
  } catch (e) { console.error(e); }
}

// Show a confirmation modal when the user is about to override an emoji with a text entry
function showJournalChoiceModal() {
  const modal = document.getElementById("journalChoiceModal");
  return new Promise(resolve => {
    modal.hidden = false;
    // Resolve true if confirmed
    document.getElementById("confirmChoiceBtn").onclick = () => { 
      modal.hidden = true; 
      resolve(true); 
    };
    // Resolve false if cancelled
    document.getElementById("cancelChoiceBtn").onclick = () => { 
      modal.hidden = true; 
      resolve(false); 
    };
  });
}

// Main event listener that runs when the document is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  initDailyPrompt(); // Start daily prompts
  
  // Refresh achievements when the authentication state changes (user logs in)
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      setTimeout(() => initAchievementsUI(), 1000); 
    }
  });

  // Toggle achievements box visibility
  const showAchvBtn = document.getElementById("showAchv");
  if(showAchvBtn) {
    showAchvBtn.addEventListener("click", () => {
      const box = document.getElementById("achievements");
      if(box) box.hidden = !box.hidden;
      initAchievementsUI();
    });
  }
  
  // Bind click events to main action buttons
  document.getElementById("save")?.addEventListener("click", saveTodayEntry);
  document.getElementById("showAll")?.addEventListener("click", openAllEntriesModal);
  document.getElementById("closeModal")?.addEventListener("click", () => document.getElementById("viewModal").hidden = true);
  // Clear the text inside the rich editor when the "مسح النص" button is clicked
document.getElementById("clearToday")?.addEventListener("click", () => {
  // Get the rich text editor element
  const noteEl = document.getElementById("note");

  // Stop if the editor does not exist
  if (!noteEl) return;

  // Clear all editor content, including formatted text, emojis, and images
  noteEl.innerHTML = "";

  // Put the cursor back inside the editor after clearing
  noteEl.focus();

  // Reset the saved cursor position because the old selection no longer exists
  savedRange = null;
});
  // Emoji palette toggle
  document.getElementById("emojiBtn")?.addEventListener("click", () => {
    const p = document.getElementById("emojiPalette"); 
    if (p) p.hidden = !p.hidden;
  });

  // Handle image uploads within the rich editor
  document.getElementById("imageUpload")?.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => { 
        restoreSelection(); 
        document.execCommand('insertImage', false, ev.target.result); // Insert image as Base64
        saveSelection(); 
      };
      reader.readAsDataURL(file); // Read file as Data URL
    }
  });

  // Auto-save the current cursor position on various input events
  const note = document.getElementById("note");
  if(note) {
    ["keyup", "mouseup", "focusout"].forEach(ev => note.addEventListener(ev, saveSelection));
  }
});
