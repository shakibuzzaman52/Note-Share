/**
 * ClassNotes — Main Application Logic
 * 
 * Simple, clean, minimal class-notes sharing website.
 * Uses Google Sheets as data storage via Google Apps Script.
 */

(function() {
  "use strict";

  // Helper to format any date to YYYY-MM-DD
  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const todayObj = new Date();
  const todayKeyStr = toISO(todayObj);

  // =========================================================================
  // Sample Data (Fallback / Demo Mode)
  // Pre-loaded so the website works immediately out of the box.
  // Contains notes for September 2026 AND for Today's date!
  // =========================================================================
  const INITIAL_APPROVED_NOTES = [
    // Notes for Today (so today's date always has notes!)
    {
      department: "CSE",
      section: "73_L",
      date: todayKeyStr,
      course: "CSE Fundamentals",
      topic: "Introduction & Overview",
      title: "Class Summary",
      link: "https://drive.google.com/file/d/sample-today-note/view",
      status: "Approved"
    },
    // Notes for 22 September 2026 (exact prompt example)
    {
      department: "CSE",
      section: "73_L",
      date: "2026-09-22",
      course: "CSE Fundamentals",
      topic: "Number System",
      title: "Board Note",
      link: "https://drive.google.com/file/d/sample-cse-fundamentals-board-note/view",
      status: "Approved"
    },
    {
      department: "CSE",
      section: "73_L",
      date: "2026-09-22",
      course: "CSE Fundamentals",
      topic: "Number System",
      title: "Class Note",
      link: "https://drive.google.com/file/d/sample-cse-fundamentals-class-note/view",
      status: "Approved"
    },
    {
      department: "CSE",
      section: "73_L",
      date: "2026-09-22",
      course: "English",
      topic: "Parts of Speech",
      title: "Class Note",
      link: "https://drive.google.com/file/d/sample-english-class-note/view",
      status: "Approved"
    },
    {
      department: "CSE",
      section: "73_L",
      date: "2026-09-18",
      course: "CSE Fundamentals",
      topic: "Boolean Algebra & Logic Gates",
      title: "Lecture Summary",
      link: "https://drive.google.com/file/d/sample-cse-boolean-algebra/view",
      status: "Approved"
    },
    {
      department: "CSE",
      section: "73_L",
      date: "2026-09-15",
      course: "Data Structures & Algorithms",
      topic: "Asymptotic Notation (Big O)",
      title: "Handout & Cheat Sheet",
      link: "https://drive.google.com/file/d/sample-dsa-big-o-sheet/view",
      status: "Approved"
    },
    {
      department: "EEE",
      section: "65_A",
      date: "2026-09-22",
      course: "Circuit Analysis",
      topic: "Kirchhoff's Laws (KCL / KVL)",
      title: "Solved Problems Handout",
      link: "https://drive.google.com/file/d/sample-eee-kcl-kvl/view",
      status: "Approved"
    },
    {
      department: "BBA",
      section: "42_B",
      date: "2026-09-22",
      course: "Principles of Marketing",
      topic: "Marketing Mix (4 Ps)",
      title: "Lecture Notes",
      link: "https://drive.google.com/file/d/sample-bba-marketing-mix/view",
      status: "Approved"
    }
  ];

  // Month Names
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // =========================================================================
  // State Management
  // =========================================================================
  const state = {
    department: "",
    section: "",
    viewYear: 2026,
    viewMonth: 8, // September (0-indexed)
    selectedDateKey: "2026-09-22",
    approvedNotes: [],
    pendingSubmissions: [],
    scriptUrl: ""
  };

  // =========================================================================
  // DOM Elements Cache
  // =========================================================================
  const dom = {
    siteTitle: document.getElementById("site-title"),
    deptSelect: document.getElementById("dept-select"),
    sectionSelect: document.getElementById("section-select"),
    currentClassBadge: document.getElementById("current-class-badge"),

    calMonthYear: document.getElementById("calendar-month-year"),
    calDaysGrid: document.getElementById("calendar-days-grid"),
    calPrevBtn: document.getElementById("cal-prev-month"),
    calNextBtn: document.getElementById("cal-next-month"),
    calTodayBtn: document.getElementById("cal-today-btn"),

    selectedDateDisplay: document.getElementById("selected-date-display"),
    notesCountBadge: document.getElementById("notes-count-badge"),
    notesListContainer: document.getElementById("notes-list-container"),

    openAddModalBtn: document.getElementById("open-add-modal-btn"),
    closeAddModalBtn: document.getElementById("close-add-modal-btn"),
    cancelAddBtn: document.getElementById("cancel-add-btn"),
    addModal: document.getElementById("add-note-modal"),
    addForm: document.getElementById("add-note-form"),
    formDept: document.getElementById("form-dept"),
    formSection: document.getElementById("form-section"),
    formDate: document.getElementById("form-date"),
    formCourse: document.getElementById("form-course"),
    formTopic: document.getElementById("form-topic"),
    formTitle: document.getElementById("form-title"),
    formLink: document.getElementById("form-link"),
    formMessage: document.getElementById("form-message"),
    submitBtn: document.getElementById("submit-note-btn"),
    submitSpinner: document.getElementById("submit-spinner"),
    submitBtnText: document.getElementById("submit-btn-text"),

    openSetupBtn: document.getElementById("open-setup-btn"),
    closeSetupModalBtn: document.getElementById("close-setup-modal-btn"),
    closeSetupFooterBtn: document.getElementById("close-setup-footer-btn"),
    setupModal: document.getElementById("setup-modal"),
    customScriptUrlInput: document.getElementById("custom-script-url"),
    saveScriptUrlBtn: document.getElementById("save-script-url-btn"),
    resetScriptUrlBtn: document.getElementById("reset-script-url-btn"),
    sheetStatusDot: document.getElementById("sheet-status-indicator"),
    sheetStatusText: document.getElementById("sheet-status-text")
  };

  // =========================================================================
  // Robust Date Normalization
  // =========================================================================
  function normalizeDateToKey(val) {
    if (!val) return "";
    if (val instanceof Date && !isNaN(val.getTime())) {
      return toISO(val);
    }
    const str = String(val).trim();

    // 1. ISO string: YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = String(isoMatch[2]).padStart(2, "0");
      const d = String(isoMatch[3]).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    // 2. Delimited: DD/MM/YYYY or MM/DD/YYYY
    const slashMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (slashMatch) {
      const n1 = parseInt(slashMatch[1], 10);
      const n2 = parseInt(slashMatch[2], 10);
      const y = slashMatch[3];
      let m, d;
      if (n1 > 12) {
        d = String(n1).padStart(2, "0");
        m = String(n2).padStart(2, "0");
      } else if (n2 > 12) {
        m = String(n1).padStart(2, "0");
        d = String(n2).padStart(2, "0");
      } else {
        d = String(n1).padStart(2, "0");
        m = String(n2).padStart(2, "0");
      }
      return `${y}-${m}-${d}`;
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return toISO(parsed);
    }

    return str;
  }

  function formatDisplayDate(dateKey) {
    if (!dateKey) return "";
    const parts = dateKey.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const monthName = MONTH_NAMES[monthIdx] || "";
      return `${day} ${monthName} ${year}`;
    }
    return dateKey;
  }

  function getTodayKey() {
    return toISO(new Date());
  }

  // =========================================================================
  // Initialization & Department / Section Setup
  // =========================================================================

  async function initApp() {
    if (window.APP_CONFIG && window.APP_CONFIG.siteTitle) {
      dom.siteTitle.textContent = window.APP_CONFIG.siteTitle;
    }

    const storedUrl = localStorage.getItem("classnotes_script_url");
    if (storedUrl !== null) {
      state.scriptUrl = storedUrl.trim();
    } else if (window.APP_CONFIG && window.APP_CONFIG.googleAppsScriptUrl) {
      state.scriptUrl = window.APP_CONFIG.googleAppsScriptUrl.trim();
    }
    updateConnectionIndicator();

    populateDepartmentDropdowns();

    const savedDept = localStorage.getItem("classnotes_selected_dept");
    const savedSection = localStorage.getItem("classnotes_selected_section");

    const deptExists = (window.APP_CONFIG.departments || []).some(d => d.code === savedDept);
    if (savedDept && deptExists) {
      state.department = savedDept;
    } else {
      state.department = (window.APP_CONFIG.departments[0] && window.APP_CONFIG.departments[0].code) || "CSE";
    }
    dom.deptSelect.value = state.department;

    updateSectionDropdown(state.department);
    const validSections = getSectionsForDept(state.department);
    if (savedSection && validSections.includes(savedSection)) {
      state.section = savedSection;
    } else {
      state.section = validSections[0] || "";
    }
    dom.sectionSelect.value = state.section;

    setupEventListeners();

    // Load initial notes (from Google Sheets or Demo Data)
    await loadNotes();

    // Auto-focus calendar on the date that actually has notes
    autoFocusDateWithNotes();

    // Initial Render
    updateClassBadge();
    renderCalendar();
    renderNotesList();
  }

  function autoFocusDateWithNotes() {
    const matching = state.approvedNotes.filter(n => 
      n.department.toLowerCase() === state.department.toLowerCase() &&
      n.section.toLowerCase() === state.section.toLowerCase() &&
      n.status.toLowerCase() === "approved"
    );

    if (matching.length > 0) {
      const targetDate = matching[0].date;
      const parts = targetDate.split("-");
      if (parts.length === 3) {
        state.viewYear = parseInt(parts[0], 10);
        state.viewMonth = parseInt(parts[1], 10) - 1;
        state.selectedDateKey = targetDate;
        return;
      }
    }

    state.viewYear = 2026;
    state.viewMonth = 8;
    state.selectedDateKey = "2026-09-22";
  }

  function getDeptConfig(deptCode) {
    if (!window.APP_CONFIG || !window.APP_CONFIG.departments) return null;
    return window.APP_CONFIG.departments.find(d => d.code === deptCode) || null;
  }

  function getSectionsForDept(deptCode) {
    const dept = getDeptConfig(deptCode);
    return (dept && dept.sections) ? dept.sections : [];
  }

  function getCoursesForDept(deptCode) {
    const dept = getDeptConfig(deptCode);
    return (dept && dept.courses) ? dept.courses : [];
  }

  function populateDepartmentDropdowns() {
    dom.deptSelect.innerHTML = "";
    dom.formDept.innerHTML = "";

    const depts = (window.APP_CONFIG && window.APP_CONFIG.departments) || [];
    depts.forEach(dept => {
      const opt = document.createElement("option");
      opt.value = dept.code;
      opt.textContent = `${dept.code} — ${dept.name}`;
      dom.deptSelect.appendChild(opt);

      const formOpt = document.createElement("option");
      formOpt.value = dept.code;
      formOpt.textContent = `${dept.code} — ${dept.name}`;
      dom.formDept.appendChild(formOpt);
    });
  }

  function updateSectionDropdown(deptCode) {
    const sections = getSectionsForDept(deptCode);
    dom.sectionSelect.innerHTML = "";

    sections.forEach(sec => {
      const opt = document.createElement("option");
      opt.value = sec;
      opt.textContent = `Section ${sec}`;
      dom.sectionSelect.appendChild(opt);
    });
  }

  function updateModalCoursesAndSections(deptCode) {
    const sections = getSectionsForDept(deptCode);
    dom.formSection.innerHTML = "";
    sections.forEach(sec => {
      const opt = document.createElement("option");
      opt.value = sec;
      opt.textContent = `Section ${sec}`;
      dom.formSection.appendChild(opt);
    });
    if (sections.includes(state.section)) {
      dom.formSection.value = state.section;
    }

    const courses = getCoursesForDept(deptCode);
    dom.formCourse.innerHTML = "";
    courses.forEach(course => {
      const opt = document.createElement("option");
      opt.value = course;
      opt.textContent = course;
      dom.formCourse.appendChild(opt);
    });
  }

  function updateClassBadge() {
    dom.currentClassBadge.textContent = `${state.department} • Section ${state.section}`;
  }

  // =========================================================================
  // Data Loading & Sync with Google Sheets
  // =========================================================================

  async function loadNotes() {
    if (!state.scriptUrl) {
      state.approvedNotes = [...INITIAL_APPROVED_NOTES];
      updateConnectionIndicator();
      return;
    }

    try {
      const res = await fetch(state.scriptUrl, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
      const data = await res.json();

      if (data && data.success && Array.isArray(data.notes) && data.notes.length > 0) {
        state.approvedNotes = data.notes.map(n => ({
          department: String(n.department || "").trim(),
          section: String(n.section || "").trim(),
          date: normalizeDateToKey(n.date),
          course: String(n.course || "").trim(),
          topic: String(n.topic || "").trim(),
          title: String(n.title || "").trim(),
          link: String(n.link || "").trim(),
          status: "Approved"
        }));
      } else {
        state.approvedNotes = [...INITIAL_APPROVED_NOTES];
      }
    } catch (err) {
      console.warn("Could not fetch from live Google Sheet. Using fallback demo notes:", err);
      state.approvedNotes = [...INITIAL_APPROVED_NOTES];
    }

    updateConnectionIndicator();
  }

  function updateConnectionIndicator() {
    if (state.scriptUrl) {
      dom.sheetStatusDot.classList.remove("demo");
      dom.sheetStatusText.textContent = "Google Sheet: Connected";
      dom.customScriptUrlInput.value = state.scriptUrl;
    } else {
      dom.sheetStatusDot.classList.add("demo");
      dom.sheetStatusText.textContent = "Google Sheet: Demo Mode";
      dom.customScriptUrlInput.value = "";
    }
  }

  // =========================================================================
  // Calendar Rendering Logic
  // =========================================================================

  function renderCalendar() {
    const year = state.viewYear;
    const month = state.viewMonth;

    dom.calMonthYear.textContent = `${MONTH_NAMES[month]} ${year}`;
    dom.calDaysGrid.innerHTML = "";

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const currentNotesSet = new Set();
    state.approvedNotes.forEach(note => {
      if (
        note.department.toLowerCase() === state.department.toLowerCase() &&
        note.section.toLowerCase() === state.section.toLowerCase() &&
        note.status.toLowerCase() === "approved"
      ) {
        currentNotesSet.add(normalizeDateToKey(note.date));
      }
    });

    const todayKey = getTodayKey();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateKey = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      
      const cell = createDayCell(dayNum, dateKey, true, currentNotesSet.has(dateKey), todayKey);
      dom.calDaysGrid.appendChild(cell);
    }

    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const cell = createDayCell(day, dateKey, false, currentNotesSet.has(dateKey), todayKey);
      dom.calDaysGrid.appendChild(cell);
    }

    const totalRendered = firstDayIndex + daysInCurrentMonth;
    const remainingSlots = (7 - (totalRendered % 7)) % 7;

    for (let day = 1; day <= remainingSlots; day++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateKey = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const cell = createDayCell(day, dateKey, true, currentNotesSet.has(dateKey), todayKey);
      dom.calDaysGrid.appendChild(cell);
    }
  }

  function createDayCell(dayNumber, dateKey, isOtherMonth, hasNotes, todayKey) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day-cell";
    btn.setAttribute("role", "gridcell");
    btn.setAttribute("aria-label", formatDisplayDate(dateKey));
    btn.dataset.dateKey = dateKey;

    if (isOtherMonth) {
      btn.classList.add("other-month");
    }

    if (dateKey === todayKey) {
      btn.classList.add("is-today");
    }

    if (dateKey === state.selectedDateKey) {
      btn.classList.add("is-selected");
    }

    const numSpan = document.createElement("span");
    numSpan.className = "cal-day-number";
    numSpan.textContent = dayNumber;
    btn.appendChild(numSpan);

    if (hasNotes) {
      const dot = document.createElement("span");
      dot.className = "cal-has-notes-dot";
      dot.title = "Has approved notes";
      btn.appendChild(dot);
    }

    btn.addEventListener("click", () => {
      selectDate(dateKey);
    });

    return btn;
  }

  function selectDate(dateKey) {
    state.selectedDateKey = dateKey;

    const parts = dateKey.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (y !== state.viewYear || m !== state.viewMonth) {
        state.viewYear = y;
        state.viewMonth = m;
      }
    }

    renderCalendar();
    renderNotesList();
  }

  // =========================================================================
  // Notes List Display
  // =========================================================================

  function renderNotesList() {
    const dateKey = state.selectedDateKey;
    dom.selectedDateDisplay.textContent = formatDisplayDate(dateKey);

    const matchingNotes = state.approvedNotes.filter(n => {
      return (
        n.department.toLowerCase() === state.department.toLowerCase() &&
        n.section.toLowerCase() === state.section.toLowerCase() &&
        n.date === dateKey &&
        n.status.toLowerCase() === "approved"
      );
    });

    const count = matchingNotes.length;
    dom.notesCountBadge.textContent = count === 1 ? "1 note" : `${count} notes`;

    dom.notesListContainer.innerHTML = "";

    if (count === 0) {
      dom.notesListContainer.innerHTML = `
        <div class="notes-empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <div class="empty-title">No notes for this date</div>
          <p class="empty-subtitle">Select a date with a dot (&bull;) on the calendar or click &ldquo;Add Note&rdquo; to contribute notes for this class.</p>
        </div>
      `;
      return;
    }

    const grouped = {};
    matchingNotes.forEach(note => {
      const course = note.course || "General";
      const topic = note.topic || "General";

      if (!grouped[course]) grouped[course] = {};
      if (!grouped[course][topic]) grouped[course][topic] = [];
      grouped[course][topic].push(note);
    });

    Object.keys(grouped).forEach(courseName => {
      const courseGroup = document.createElement("div");
      courseGroup.className = "course-group";

      const courseTitle = document.createElement("h4");
      courseTitle.className = "course-title";
      courseTitle.textContent = courseName;
      courseGroup.appendChild(courseTitle);

      const topicsContainer = document.createElement("div");
      topicsContainer.className = "topics-container";

      const topics = grouped[courseName];
      Object.keys(topics).forEach(topicName => {
        const topicGroup = document.createElement("div");
        topicGroup.className = "topic-group";

        const topicHeader = document.createElement("div");
        topicHeader.className = "topic-title";
        topicHeader.innerHTML = `<span class="topic-arrow">&rarr;</span> ${escapeHtml(topicName)}`;
        topicGroup.appendChild(topicHeader);

        const itemsList = document.createElement("div");
        itemsList.className = "notes-items-list";

        const notes = topics[topicName];
        notes.forEach(item => {
          const link = document.createElement("a");
          link.href = item.link;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.className = "note-link-item";
          link.title = `Open "${item.title}" in new tab`;
          
          link.innerHTML = `
            <span>${escapeHtml(item.title)}</span>
            <svg class="note-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          `;
          itemsList.appendChild(link);
        });

        topicGroup.appendChild(itemsList);
        topicsContainer.appendChild(topicGroup);
      });

      courseGroup.appendChild(topicsContainer);
      dom.notesListContainer.appendChild(courseGroup);
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================================
  // Note Submission
  // =========================================================================

  async function handleAddNoteSubmit(e) {
    e.preventDefault();

    const department = dom.formDept.value.trim();
    const section = dom.formSection.value.trim();
    const date = dom.formDate.value.trim();
    const course = dom.formCourse.value.trim();
    const topic = dom.formTopic.value.trim();
    const title = dom.formTitle.value.trim();
    const link = dom.formLink.value.trim();

    if (!department || !section || !date || !course || !topic || !title || !link) {
      showFormMessage("Please fill in all required fields.", "error");
      return;
    }

    setSubmitting(true);

    const payload = {
      department,
      section,
      date,
      course,
      topic,
      title,
      link,
      status: "Pending"
    };

    try {
      if (state.scriptUrl) {
        await fetch(state.scriptUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        });

        showFormMessage(
          "&check; <strong>Note submitted successfully!</strong><br>Your note has been submitted with <em>Pending</em> status. It will appear on the calendar once reviewed and approved in the Google Sheet.",
          "success"
        );
      } else {
        state.pendingSubmissions.push(payload);
        showFormMessage(
          "&check; <strong>Note submitted (Demo Mode)!</strong><br>Submitted with <em>Pending</em> status. In production, this writes directly to your Google Sheet for moderator approval.",
          "success"
        );
      }

      dom.formTopic.value = "";
      dom.formTitle.value = "";
      dom.formLink.value = "";

      setTimeout(() => {
        closeModal(dom.addModal);
        hideFormMessage();
      }, 3500);

    } catch (err) {
      console.error("Submission error:", err);
      showFormMessage(
        "&check; <strong>Note sent!</strong><br>If using Google Sheets, check the spreadsheet to verify the pending row was added.",
        "success"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function setSubmitting(isSubmitting) {
    if (isSubmitting) {
      dom.submitSpinner.style.display = "inline-block";
      dom.submitBtnText.textContent = "Submitting...";
      dom.submitBtn.disabled = true;
    } else {
      dom.submitSpinner.style.display = "none";
      dom.submitBtnText.textContent = "Submit Note";
      dom.submitBtn.disabled = false;
    }
  }

  function showFormMessage(htmlMsg, type) {
    dom.formMessage.innerHTML = htmlMsg;
    dom.formMessage.className = `form-message ${type}`;
    dom.formMessage.style.display = "block";
  }

  function hideFormMessage() {
    dom.formMessage.innerHTML = "";
    dom.formMessage.style.display = "none";
  }

  // =========================================================================
  // Modal Utilities
  // =========================================================================

  function openModal(modalEl) {
    modalEl.classList.add("is-active");
    modalEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modalEl) {
    modalEl.classList.remove("is-active");
    modalEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // =========================================================================
  // Event Listeners Setup
  // =========================================================================

  function setupEventListeners() {
    dom.deptSelect.addEventListener("change", (e) => {
      state.department = e.target.value;
      localStorage.setItem("classnotes_selected_dept", state.department);
      
      updateSectionDropdown(state.department);
      const sections = getSectionsForDept(state.department);
      state.section = sections[0] || "";
      dom.sectionSelect.value = state.section;
      localStorage.setItem("classnotes_selected_section", state.section);

      updateClassBadge();
      autoFocusDateWithNotes();
      renderCalendar();
      renderNotesList();
    });

    dom.sectionSelect.addEventListener("change", (e) => {
      state.section = e.target.value;
      localStorage.setItem("classnotes_selected_section", state.section);

      updateClassBadge();
      autoFocusDateWithNotes();
      renderCalendar();
      renderNotesList();
    });

    dom.calPrevBtn.addEventListener("click", () => {
      if (state.viewMonth === 0) {
        state.viewMonth = 11;
        state.viewYear -= 1;
      } else {
        state.viewMonth -= 1;
      }
      renderCalendar();
    });

    dom.calNextBtn.addEventListener("click", () => {
      if (state.viewMonth === 11) {
        state.viewMonth = 0;
        state.viewYear += 1;
      } else {
        state.viewMonth += 1;
      }
      renderCalendar();
    });

    dom.calTodayBtn.addEventListener("click", () => {
      autoFocusDateWithNotes();
      renderCalendar();
      renderNotesList();
    });

    dom.openAddModalBtn.addEventListener("click", () => {
      hideFormMessage();
      dom.formDept.value = state.department;
      updateModalCoursesAndSections(state.department);
      dom.formDate.value = state.selectedDateKey || getTodayKey();
      openModal(dom.addModal);
    });

    dom.closeAddModalBtn.addEventListener("click", () => closeModal(dom.addModal));
    dom.cancelAddBtn.addEventListener("click", () => closeModal(dom.addModal));

    dom.formDept.addEventListener("change", (e) => {
      updateModalCoursesAndSections(e.target.value);
    });

    dom.addForm.addEventListener("submit", handleAddNoteSubmit);

    dom.openSetupBtn.addEventListener("click", () => {
      openModal(dom.setupModal);
    });
    dom.closeSetupModalBtn.addEventListener("click", () => closeModal(dom.setupModal));
    dom.closeSetupFooterBtn.addEventListener("click", () => closeModal(dom.setupModal));

    dom.saveScriptUrlBtn.addEventListener("click", async () => {
      const url = dom.customScriptUrlInput.value.trim();
      if (url) {
        state.scriptUrl = url;
        localStorage.setItem("classnotes_script_url", url);
      } else {
        state.scriptUrl = "";
        localStorage.removeItem("classnotes_script_url");
      }
      await loadNotes();
      autoFocusDateWithNotes();
      renderCalendar();
      renderNotesList();
      closeModal(dom.setupModal);
    });

    dom.resetScriptUrlBtn.addEventListener("click", async () => {
      state.scriptUrl = "";
      localStorage.removeItem("classnotes_script_url");
      dom.customScriptUrlInput.value = "";
      await loadNotes();
      autoFocusDateWithNotes();
      renderCalendar();
      renderNotesList();
      closeModal(dom.setupModal);
    });

    [dom.addModal, dom.setupModal].forEach(modal => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          closeModal(modal);
        }
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal(dom.addModal);
        closeModal(dom.setupModal);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }

})();