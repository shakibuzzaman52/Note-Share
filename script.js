(function () {
  "use strict";

  const SECURITY = {
    MAX_TITLE_LENGTH: 80,
    MAX_TOPIC_LENGTH: 80,
    MAX_URL_LENGTH: 500,
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
    ALLOWED_EXTENSIONS: ["pdf", "doc", "docx", "ppt", "pptx", "png", "jpg", "jpeg"]
  };

  const CHECK_SVG = '<svg class="nav-filter-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  const config = window.APP_CONFIG || {};
  const departments = Array.isArray(config.departments) ? config.departments : [];

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const MONTH_MAP = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
  };

  const safeStorage = {
    get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
    set: (key, val) => { try { localStorage.setItem(key, val); } catch {} },
    remove: (key) => { try { localStorage.removeItem(key); } catch {} }
  };

  const getDeptMeta = (code) => departments.find(d => d.code === code) || null;
  const savedDept = getDeptMeta(safeStorage.get("selected_dept"));
  const savedSec = savedDept?.sections.includes(safeStorage.get("selected_sec")) ? safeStorage.get("selected_sec") : "";
  const today = new Date();

  const state = {
    dept: savedDept ? savedDept.code : "",
    sec: savedSec,
    course: "ALL",
    topic: "ALL",
    viewDate: new Date(today.getFullYear(), today.getMonth(), 1),
    activeDate: null,
    notes: [],
    manualTitleEdited: false,
    isLoading: false,
    uploadMode: "file"
  };

  const ui = {
    mobileMenuToggle: document.getElementById("mobile-menu-toggle"),
    headerNav: document.getElementById("header-nav"),
    selectionBanner: document.getElementById("selection-banner"),
    navFilters: document.getElementById("main-nav-filters"),

    deptMenu: document.getElementById("dept-menu"),
    secMenu: document.getElementById("sec-menu"),
    courseMenu: document.getElementById("course-menu"),
    topicMenu: document.getElementById("topic-menu"),

    deptLabel: document.getElementById("dept-label"),
    secLabel: document.getElementById("sec-label"),
    courseLabel: document.getElementById("course-label"),
    topicLabel: document.getElementById("topic-label"),

    calendarView: document.getElementById("calendar-view"),
    calendarTitle: document.getElementById("calendar-header-title"),
    calendarCarousel: document.getElementById("calendar-carousel"),
    calendarTrack: document.getElementById("calendar-track"),
    calendarCellsPrev: document.getElementById("calendar-cells-prev"),
    calendarCells: document.getElementById("calendar-cells"),
    calendarCellsNext: document.getElementById("calendar-cells-next"),
    prevMonthBtn: document.getElementById("cal-prev"),
    todayBtn: document.getElementById("cal-today"),
    nextMonthBtn: document.getElementById("cal-next"),

    courseView: document.getElementById("course-view"),
    courseTitle: document.getElementById("course-view-title"),
    courseCount: document.getElementById("course-view-count"),
    courseDatesList: document.getElementById("course-dates-list"),

    notesModal: document.getElementById("notes-modal"),
    modalDateLabel: document.getElementById("modal-date-label"),
    modalNotesTotal: document.getElementById("modal-notes-total"),
    modalNotesStack: document.getElementById("modal-notes-stack"),

    addModal: document.getElementById("add-modal"),
    addNoteBtn: document.getElementById("trigger-add-note"),
    addForm: document.getElementById("add-note-form"),

    formDept: document.getElementById("input-dept"),
    formSec: document.getElementById("input-section"),
    formDate: document.getElementById("input-date"),
    formCourse: document.getElementById("input-course"),
    formTopic: document.getElementById("input-topic"),
    formTitle: document.getElementById("input-title"),

    tabModeFile: document.getElementById("tab-mode-file"),
    tabModeLink: document.getElementById("tab-mode-link"),
    fieldFileUpload: document.getElementById("field-file-upload"),
    fieldLinkUpload: document.getElementById("field-link-upload"),

    formFileInput: document.getElementById("input-file"),
    fileDropzone: document.getElementById("file-dropzone"),
    fileDropzoneContent: document.getElementById("file-dropzone-content"),
    fileSelectedBox: document.getElementById("file-selected-box"),
    selectedFileName: document.getElementById("selected-file-name"),
    selectedFileSize: document.getElementById("selected-file-size"),
    selectedFileStatus: document.getElementById("selected-file-status"),
    fileProgressContainer: document.getElementById("file-progress-container"),
    fileProgressBar: document.getElementById("file-progress-bar"),
    btnRemoveFile: document.getElementById("btn-remove-file"),

    formLink: document.getElementById("input-link"),
    btnSubmitNote: document.getElementById("btn-submit-note"),

    formDeptMenu: document.getElementById("form-dept-menu"),
    formSecMenu: document.getElementById("form-sec-menu"),
    formCourseMenu: document.getElementById("form-course-menu"),

    formDeptLabel: document.getElementById("form-dept-label"),
    formSecLabel: document.getElementById("form-sec-label"),
    formCourseLabel: document.getElementById("form-course-label"),

    reportModal: document.getElementById("report-modal"),
    reportForm: document.getElementById("report-link-form"),
    reportTitle: document.getElementById("report-note-title"),
    reportContext: document.getElementById("report-note-context"),
    btnSubmitReport: document.getElementById("btn-submit-report"),

    toastTray: document.getElementById("toast-tray")
  };

  const toDateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const formatDateKey = (date) => toDateKey(date.getFullYear(), date.getMonth(), date.getDate());

  function normalizeDateStr(raw) {
    if (!raw && raw !== 0) return "";
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    const textMatch = str.match(/(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
    if (textMatch) {
      const monthNum = MONTH_MAP[textMatch[1].toLowerCase()];
      if (monthNum) {
        return `${textMatch[3]}-${monthNum}-${textMatch[2].padStart(2, "0")}`;
      }
    }

    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? str : formatDateKey(parsed);
  }

  function parseLocalDate(dateKey) {
    if (!dateKey) return new Date();
    const cleanKey = normalizeDateStr(dateKey);
    const parts = cleanKey.split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const parsed = new Date(dateKey);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function formatReadableDate(dateKey) {
    if (!dateKey) return "";
    const cleanKey = normalizeDateStr(dateKey);
    const parts = cleanKey.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const month = MONTH_NAMES[Number(m) - 1];
      if (month) return `${Number(d)} ${month} ${y}`;
    }
    const d = new Date(dateKey);
    return isNaN(d.getTime()) ? String(dateKey) : `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const pluralize = (count, s, p) => `${count} ${count === 1 ? s : p}`;

  function escapeHtml(text) {
    if (!text && text !== 0) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sanitizeTextInput(text, maxLen) {
    return typeof text === "string" ? text.trim().slice(0, maxLen) : "";
  }

  function validateAndSanitizeUrl(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    const full = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const parsed = new URL(full);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.href.slice(0, SECURITY.MAX_URL_LENGTH);
    } catch {
      return "";
    }
  }

  function injectHoneypot(form) {
    if (!form || form.querySelector(".bot-field")) return;
    const hp = document.createElement("input");
    hp.type = "text";
    hp.name = "company_address_val";
    hp.tabIndex = -1;
    hp.autocomplete = "off";
    hp.className = "bot-field";
    hp.style.cssText = "position:absolute;left:-9999px;opacity:0;pointer-events:none;";
    form.appendChild(hp);
  }

  function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle("is-loading", isLoading);
  }

  function renderEmptyState(message) {
    return `
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="9" y1="13" x2="15" y2="13"></line>
        </svg>
        <p class="empty-state-text">${escapeHtml(message)}</p>
      </div>`;
  }

  function updateProgressUI(percent, statusText, customSizeText = null, isComplete = false, isError = false) {
    const clamped = Math.min(100, Math.max(0, Math.round(percent)));
    if (ui.fileProgressBar) {
      ui.fileProgressBar.style.width = `${clamped}%`;
      ui.fileProgressBar.classList.toggle("is-complete", isComplete || clamped === 100);
      ui.fileProgressBar.classList.toggle("is-animated", !isComplete && clamped > 0 && clamped < 100);
    }
    if (customSizeText && ui.selectedFileSize) {
      ui.selectedFileSize.textContent = customSizeText;
    }
    if (ui.selectedFileStatus) {
      ui.selectedFileStatus.textContent = statusText ? `• ${statusText}` : "";
      ui.selectedFileStatus.classList.toggle("is-error", isError);
      ui.selectedFileStatus.classList.toggle("is-success", isComplete || clamped === 100);
    }
  }

  function startUploadProgressSimulation(fileSize, onUpdate) {
    const totalMB = formatFileSize(fileSize);
    let currentPercent = 15;
    let isFinished = false;

    const fileSizeMB = Math.max(1, fileSize / (1024 * 1024));
    const estimatedTotalMs = Math.max(3000, fileSizeMB * 1800);
    const startTime = Date.now();

    const interval = setInterval(() => {
      if (isFinished) return;

      const elapsed = Date.now() - startTime;
      const progressRatio = Math.min(0.94, elapsed / estimatedTotalMs);

      const easedRatio = 1 - Math.pow(1 - progressRatio, 1.5);
      const targetPercent = Math.min(94, Math.round(15 + easedRatio * 79));

      if (targetPercent > currentPercent) {
        currentPercent = targetPercent;
      } else if (currentPercent < 95) {
        currentPercent = Math.min(95, currentPercent + 0.15);
      }

      const currentUploadedBytes = Math.round((currentPercent / 100) * fileSize);
      const currentMB = formatFileSize(currentUploadedBytes);
      const statusText = currentPercent >= 92 ? "Saving to Drive..." : "Uploading...";

      onUpdate(Math.round(currentPercent), statusText, `${currentMB} of ${totalMB}`);
    }, 100);

    return {
      finish: async () => {
        isFinished = true;
        clearInterval(interval);

        const startP = currentPercent;
        const steps = 8;
        for (let i = 1; i <= steps; i++) {
          const p = Math.round(startP + ((100 - startP) * (i / steps)));
          onUpdate(p, p >= 100 ? "Complete!" : "Finalizing...", totalMB, p >= 100);
          await new Promise(r => setTimeout(r, 30));
        }
      },
      error: () => {
        isFinished = true;
        clearInterval(interval);
        onUpdate(0, "Upload failed", totalMB, false, true);
      }
    };
  }

  function isAllowedFile(file) {
    if (!file || !file.name) return false;
    const ext = file.name.split(".").pop().toLowerCase();
    return SECURITY.ALLOWED_EXTENSIONS.includes(ext);
  }

  function handleFileSelected(file) {
    if (!file) {
      clearSelectedFile();
      return;
    }

    if (!isAllowedFile(file)) {
      showToast("Invalid file type. Allowed: PDF, DOC, PPT, PNG, JPG.");
      clearSelectedFile();
      return;
    }

    if (file.size > SECURITY.MAX_FILE_SIZE_BYTES) {
      showToast("File size exceeds 10MB limit. Please choose a smaller file or upload via Web Link.");
      clearSelectedFile();
      return;
    }

    if (ui.selectedFileName) ui.selectedFileName.textContent = file.name;
    if (ui.selectedFileSize) ui.selectedFileSize.textContent = formatFileSize(file.size);

    if (ui.fileDropzoneContent) ui.fileDropzoneContent.hidden = true;
    if (ui.fileSelectedBox) ui.fileSelectedBox.hidden = false;
    if (ui.fileDropzone) ui.fileDropzone.classList.add("has-file");
    if (ui.fileProgressContainer) ui.fileProgressContainer.hidden = true;

    updateProgressUI(0, "Ready to upload");
  }

  function clearSelectedFile() {
    if (ui.formFileInput) ui.formFileInput.value = "";
    if (ui.selectedFileName) ui.selectedFileName.textContent = "";
    if (ui.selectedFileSize) ui.selectedFileSize.textContent = "";
    if (ui.fileDropzoneContent) ui.fileDropzoneContent.hidden = false;
    if (ui.fileSelectedBox) ui.fileSelectedBox.hidden = true;
    if (ui.fileDropzone) ui.fileDropzone.classList.remove("has-file");
    if (ui.fileProgressContainer) ui.fileProgressContainer.hidden = true;
    updateProgressUI(0, "");
  }

  function setUploadMode(mode) {
    state.uploadMode = mode;
    if (ui.tabModeFile && ui.tabModeLink) {
      ui.tabModeFile.classList.toggle("is-active", mode === "file");
      ui.tabModeLink.classList.toggle("is-active", mode === "link");
    }
    if (ui.fieldFileUpload) ui.fieldFileUpload.hidden = (mode !== "file");
    if (ui.fieldLinkUpload) ui.fieldLinkUpload.hidden = (mode !== "link");
  }

  function dismissPreloader() {
    const preloader = document.getElementById("preloader");
    if (!preloader || preloader.dataset.dismissed) return;
    preloader.dataset.dismissed = "true";
    setTimeout(() => {
      preloader.classList.add("is-hidden");
      setTimeout(() => preloader.remove(), 650);
    }, 1150);
  }

  if (document.readyState === "complete") {
    dismissPreloader();
  } else {
    window.addEventListener("load", dismissPreloader);
  }

  let toastTimer = null;
  function showToast(message) {
    clearTimeout(toastTimer);
    ui.toastTray.innerHTML = "";
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    ui.toastTray.appendChild(toast);
    toastTimer = setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function copyToClipboard(text) {
    if (!text) return;
    const notify = (ok) => showToast(ok ? "Link copied to clipboard!" : "Unable to copy link.");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => notify(true)).catch(() => fallbackCopy(text, notify));
    } else {
      fallbackCopy(text, notify);
    }
  }

  function fallbackCopy(text, cb) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.cssText = "position:fixed;opacity:0;";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      cb(ok);
    } catch {
      cb(false);
    }
  }

  async function syncData(payload) {
    if (!config.googleAppsScriptUrl) return;
    return fetch(config.googleAppsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  }

  function normalizeNote(n, dept = state.dept, sec = state.sec) {
    return {
      ...n,
      title: sanitizeTextInput(String(n.title || ""), SECURITY.MAX_TITLE_LENGTH),
      topic: sanitizeTextInput(String(n.topic || ""), SECURITY.MAX_TOPIC_LENGTH),
      department: n.department || dept,
      section: n.section || sec,
      date: normalizeDateStr(n.date),
      viewCount: Math.max(0, parseInt(n.viewCount || 0, 10))
    };
  }

  function recordNoteView(row) {
    if (!row) return;

    const countEls = ui.modalNotesStack.querySelectorAll(`.view-count-num[data-row="${row}"]`);
    countEls.forEach(el => {
      const cur = parseInt(el.textContent, 10) || 0;
      el.textContent = String(cur + 1);
      const parentBadge = el.closest(".note-view-badge");
      if (parentBadge) parentBadge.title = `${cur + 1} views`;
    });

    const targetNote = state.notes.find(n => String(n.row) === String(row));
    if (targetNote) {
      targetNote.viewCount = (targetNote.viewCount || 0) + 1;
      const cacheKey = `notes_${state.dept}_${state.sec}`;
      safeStorage.set(cacheKey, JSON.stringify(state.notes));
    }

    syncData({ type: "view", row: row });
  }

  async function loadNotes() {
    if (!state.dept || !state.sec) {
      state.notes = [];
      state.isLoading = false;
      syncTopicMenu();
      render();
      return;
    }

    const { dept: currentDept, sec: currentSec } = state;
    const cacheKey = `notes_${currentDept}_${currentSec}`;
    let hasCache = false;

    try {
      const cached = JSON.parse(safeStorage.get(cacheKey) || "null");
      if (Array.isArray(cached)) {
        state.notes = cached.map(n => normalizeNote(n, currentDept, currentSec));
        hasCache = true;
        state.isLoading = false;
        syncTopicMenu();
        render();
      }
    } catch {
      hasCache = false;
    }

    if (!config.googleAppsScriptUrl) {
      state.isLoading = false;
      if (!hasCache) {
        syncTopicMenu();
        render();
      }
      return;
    }

    if (!hasCache) {
      state.isLoading = true;
      render();
    }

    try {
      const sep = config.googleAppsScriptUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${config.googleAppsScriptUrl}${sep}department=${encodeURIComponent(currentDept)}&section=${encodeURIComponent(currentSec)}`);
      const data = await res.json();

      if (data?.success && Array.isArray(data.notes)) {
        const freshNotes = data.notes
          .filter(n => (!n.department || n.department === currentDept) && (!n.section || n.section === currentSec))
          .map(n => normalizeNote(n, currentDept, currentSec));

        safeStorage.set(cacheKey, JSON.stringify(freshNotes));

        if (state.dept === currentDept && state.sec === currentSec) {
          state.notes = freshNotes;
          state.isLoading = false;
          syncTopicMenu();
          render();

          if (state.activeDate && ui.notesModal?.open) {
            renderModalNotes();
          }
        }
      }
    } catch (err) {
      console.warn("Unable to sync lecture notes:", err);
      if (!hasCache) {
        showToast("Could not load latest notes. Please check connection.");
      }
    } finally {
      if (state.dept === currentDept && state.sec === currentSec && state.isLoading) {
        state.isLoading = false;
        syncTopicMenu();
        render();
      }
    }
  }

  function filterActiveNotes() {
    if (!state.dept || !state.sec) return [];
    return state.notes.filter(n =>
      n.department === state.dept &&
      n.section === state.sec &&
      String(n.status || "").toLowerCase() === "approved" &&
      (state.course === "ALL" || n.course === state.course) &&
      (state.topic === "ALL" || n.topic === state.topic)
    );
  }

  function getNotesCountMap(notes) {
    const map = {};
    for (const n of notes) {
      if (n.date) map[n.date] = (map[n.date] || 0) + 1;
    }
    return map;
  }

  function renderMenuOptions(container, list = [], selectedVal, includeAll = false, allLabel = "All Courses", prefix = "") {
    const items = includeAll ? [{ val: "ALL", text: allLabel }] : [];
    for (const item of list) {
      items.push({ val: String(item), text: prefix ? `${prefix} ${item}` : String(item) });
    }

    container.innerHTML = items.map(({ val, text }) => {
      const isSel = selectedVal === val;
      return `<button type="button" class="nav-filter-option ${isSel ? 'is-selected' : ''}" data-value="${escapeHtml(val)}" role="option" aria-selected="${isSel}">
        <span class="nav-filter-option-text">${escapeHtml(text)}</span>
        ${isSel ? CHECK_SVG : ''}
      </button>`;
    }).join("");
  }

  function renderMenuNotice(container, message) {
    container.innerHTML = `<div class="nav-filter-empty">${escapeHtml(message)}</div>`;
  }

  function closeAllMenus() {
    document.querySelectorAll(".nav-filter-menu:not([hidden])").forEach(m => {
      m.hidden = true;
      m.removeAttribute("style");
    });
    document.querySelectorAll('.nav-filter-trigger[aria-expanded="true"]').forEach(b => {
      b.setAttribute("aria-expanded", "false");
    });
  }

  function toggleMenu(menu, trigger) {
    if (!menu || !trigger) return;
    const isClosed = menu.hidden;
    closeAllMenus();
    if (isClosed) {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");

      if (trigger.closest("#main-nav-filters")) {
        const rect = trigger.getBoundingClientRect();
        menu.style.position = "fixed";
        menu.style.top = `${rect.bottom + 5}px`;
        const menuWidth = Math.min(280, Math.max(210, rect.width), Math.max(100, window.innerWidth - 32));
        const left = Math.min(rect.left, window.innerWidth - 16 - menuWidth);
        menu.style.left = `${Math.max(16, left)}px`;
        menu.style.width = `${menuWidth}px`;
      }
    }
  }

  function updateFilterLabels() {
    ui.deptLabel.textContent = state.dept || "Department";
    ui.secLabel.textContent = state.sec ? `Sec ${state.sec}` : "Section";
    ui.courseLabel.textContent = state.sec ? (state.course === "ALL" ? "All Courses" : state.course) : "Course";
    ui.topicLabel.textContent = state.sec ? (state.topic === "ALL" ? "All Topics" : state.topic) : "Topic";
  }

  function updateSelectionBanner() {
    if (!ui.selectionBanner) return;
    if (!state.dept) {
      ui.selectionBanner.innerHTML = 'Select your <span class="badge">department</span>';
    } else if (!state.sec) {
      ui.selectionBanner.innerHTML = `<span class="badge">${escapeHtml(state.dept)}</span> &mdash; select <span class="badge">section</span>`;
    } else {
      ui.selectionBanner.innerHTML = `Viewing notes for <span class="badge">${escapeHtml(state.dept)} &mdash; Sec ${escapeHtml(state.sec)}</span>`;
    }
  }

  function syncTopicMenu() {
    if (!state.dept || !state.sec) {
      renderMenuNotice(ui.topicMenu, "Select Department & Section first");
      return;
    }

    const matching = state.notes.filter(n =>
      n.department === state.dept &&
      n.section === state.sec &&
      (state.course === "ALL" || n.course === state.course) &&
      String(n.status || "").toLowerCase() === "approved" &&
      n.topic?.trim()
    );

    const uniqueTopics = [...new Set(matching.map(n => n.topic.trim()))].sort();
    if (!uniqueTopics.includes(state.topic)) state.topic = "ALL";
    renderMenuOptions(ui.topicMenu, uniqueTopics, state.topic, true, "All Topics");
  }

  function syncDropdownStates() {
    renderMenuOptions(ui.deptMenu, departments.map(d => d.code), state.dept || null);
    const activeDept = getDeptMeta(state.dept);

    if (activeDept) {
      renderMenuOptions(ui.secMenu, activeDept.sections, state.sec || null, false, "", "Sec");
      renderMenuOptions(ui.courseMenu, activeDept.courses, state.sec ? state.course : "ALL", true, "All Courses");
    } else {
      renderMenuNotice(ui.secMenu, "Please select Department first");
      renderMenuNotice(ui.courseMenu, "Please select Department first");
    }
    syncTopicMenu();
  }

  function updateModalDropdowns(deptCode, secCode, courseCode) {
    const dept = getDeptMeta(deptCode) || departments[0] || { code: "", sections: [], courses: [] };
    ui.formDept.value = dept.code;
    ui.formDeptLabel.textContent = dept.code || "Department";
    renderMenuOptions(ui.formDeptMenu, departments.map(d => d.code), dept.code);

    const sec = (dept.sections.includes(secCode) ? secCode : dept.sections[0]) || "";
    ui.formSec.value = sec;
    ui.formSecLabel.textContent = sec ? `Sec ${sec}` : "Section";
    renderMenuOptions(ui.formSecMenu, dept.sections, sec, false, "", "Sec");

    const course = (dept.courses.includes(courseCode) ? courseCode : dept.courses[0]) || "";
    ui.formCourse.value = course;
    ui.formCourseLabel.textContent = course || "Course";
    renderMenuOptions(ui.formCourseMenu, dept.courses, course);

    calculateDefaultTitle();
  }

  function calculateDefaultTitle() {
    if (state.manualTitleEdited) return;
    const targetDate = ui.formDate.value || state.activeDate || formatDateKey(new Date());
    const count = state.notes.filter(n =>
      n.department === ui.formDept.value &&
      n.section === ui.formSec.value &&
      n.date === targetDate &&
      (!ui.formCourse.value || n.course === ui.formCourse.value)
    ).length;
    ui.formTitle.value = `Note ${count + 1}`;
  }

  function checkBodyScrollLock() {
    document.body.classList.toggle("sheet-open", Boolean(document.querySelector(".dialog-modal[open]") || ui.headerNav?.classList.contains("is-open")));
  }

  function isEventOutside(modal, e) {
    const rect = modal.getBoundingClientRect();
    return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
  }

  function openSheetModal(modalEl) {
    if (!modalEl) return;
    delete modalEl.dataset.closing;
    document.body.classList.add("sheet-open");
    modalEl.style.transform = "";
    if (!modalEl.open) modalEl.showModal();
    requestAnimationFrame(() => modalEl.classList.add("is-open"));
  }

  function closeSheetModal(modalEl, onClosed) {
    if (!modalEl?.open) {
      onClosed?.();
      return;
    }
    if (modalEl.dataset.closing === "true") return;
    modalEl.dataset.closing = "true";
    modalEl.classList.remove("is-open");
    modalEl.style.transform = "";
    const delay = (modalEl.classList.contains("bottom-sheet") && window.innerWidth <= 768) ? 280 : 0;
    setTimeout(() => {
      delete modalEl.dataset.closing;
      if (modalEl.open) modalEl.close();
      checkBodyScrollLock();
      onClosed?.();
    }, delay);
  }

  function setMobileMenu(open) {
    if (!ui.headerNav || !ui.mobileMenuToggle) return;
    ui.headerNav.classList.toggle("is-open", open);
    ui.mobileMenuToggle.setAttribute("aria-expanded", String(open));
    ui.mobileMenuToggle.textContent = open ? "Close" : "Menu";
    checkBodyScrollLock();
  }

  function openDateDetails(dateKey) {
    if (!state.dept || !state.sec) {
      showToast("Select Department & Section first");
      return;
    }
    state.activeDate = normalizeDateStr(dateKey);
    renderModalNotes();
    openSheetModal(ui.notesModal);
  }

  function setupBottomSheetGestures(sheet, handle, header, scrollableContent, closeCallback) {
    if (!sheet || !handle) return;

    let startY = 0;
    let currentTranslate = 0;
    let isDragging = false;
    let startTime = 0;
    let isStartedOnContent = false;

    function start(clientY, target) {
      if (window.innerWidth > 768 || !sheet.open) return;
      if (target?.closest(".nav-filter-menu")) return;
      startY = clientY;
      currentTranslate = 0;
      startTime = Date.now();
      isStartedOnContent = Boolean(scrollableContent?.contains(target));
      if (!isStartedOnContent) {
        isDragging = true;
        sheet.classList.add("is-dragging");
      }
    }

    function move(clientY, cancelable, preventDefault) {
      if (window.innerWidth > 768 || !sheet.open) return;
      if (!isDragging) {
        if (isStartedOnContent && scrollableContent && scrollableContent.scrollTop <= 0) {
          const delta = clientY - startY;
          if (delta > 0) {
            isDragging = true;
            startY = clientY;
            sheet.classList.add("is-dragging");
          }
        }
        return;
      }
      const deltaY = clientY - startY;
      if (deltaY > 0) {
        currentTranslate = deltaY;
        sheet.style.transform = `translateY(${deltaY}px)`;
        if (cancelable && preventDefault) preventDefault();
      } else {
        currentTranslate = 0;
        sheet.style.transform = "translateY(0px)";
      }
    }

    function end() {
      if (!isDragging) {
        isStartedOnContent = false;
        return;
      }
      isDragging = false;
      isStartedOnContent = false;
      sheet.classList.remove("is-dragging");

      const elapsed = Date.now() - startTime;
      const velocity = currentTranslate / (elapsed || 1);
      const sheetHeight = sheet.offsetHeight || 340;

      if (currentTranslate > sheetHeight * 0.4 || (currentTranslate > 45 && velocity > 0.42)) {
        closeCallback();
      } else {
        sheet.style.transform = "";
      }
    }

    function onTouchMove(e) {
      move(e.touches[0].clientY, e.cancelable, () => e.preventDefault());
    }

    function onTouchEnd() {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      end();
    }

    function onTouchStart(e) {
      if (window.innerWidth > 768 || !sheet.open || e.touches.length > 1) return;
      start(e.touches[0].clientY, e.target);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd, { passive: true });
      window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    }

    function onMouseMove(e) {
      move(e.clientY, e.cancelable, () => e.preventDefault());
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      end();
    }

    function onMouseDown(e) {
      if (window.innerWidth > 768 || !sheet.open) return;
      start(e.clientY, e.target);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }

    [handle, header, scrollableContent].filter(Boolean).forEach(el => {
      el.addEventListener("touchstart", onTouchStart, { passive: true });
    });
    [handle, header].filter(Boolean).forEach(el => {
      el.addEventListener("mousedown", onMouseDown);
    });
  }

  function generateMonthMarkup(dateObj, notesCountMap, todayKey) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let markup = "<tr>";
    let col = 0;

    for (let i = 0; i < firstDay; i++) {
      markup += '<td class="calendar-cell calendar-cell--empty"></td>';
      col++;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      if (col === 7) {
        markup += "</tr><tr>";
        col = 0;
      }

      if (state.isLoading) {
        markup += '<td class="calendar-cell"><div class="calendar-cell-btn skeleton-btn" aria-hidden="true"></div></td>';
      } else {
        const dateKey = toDateKey(year, month, d);
        const isFuture = dateKey > todayKey;
        const noteCount = notesCountMap[dateKey] || 0;
        const hasNotes = noteCount > 0;

        const classes = [
          "calendar-cell",
          dateKey === todayKey && "calendar-cell--today",
          isFuture && "calendar-cell--disabled",
          hasNotes && "has-notes"
        ].filter(Boolean).join(" ");

        markup += `
          <td class="${classes}" data-date="${dateKey}">
            <button type="button" class="calendar-cell-btn" data-date="${dateKey}" ${isFuture ? "disabled" : ""} ${hasNotes ? `title="${pluralize(noteCount, 'note', 'notes')}"` : ""}>
              ${d}
            </button>
          </td>`;
      }
      col++;
    }

    while (col > 0 && col < 7) {
      markup += '<td class="calendar-cell calendar-cell--empty"></td>';
      col++;
    }
    return markup + "</tr>";
  }

  function updateCalendarTitle(dateObj) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    ui.calendarTitle.innerHTML = `<span class="month-full">${MONTH_NAMES[month]}</span><span class="month-short">${MONTH_NAMES[month].slice(0, 3)}</span> ${year}`;
  }

  function renderCalendarGrid() {
    const currYear = state.viewDate.getFullYear();
    const currMonth = state.viewDate.getMonth();
    const notes = state.isLoading ? [] : filterActiveNotes();
    const notesCountMap = getNotesCountMap(notes);
    const todayKey = formatDateKey(new Date());

    updateCalendarTitle(state.viewDate);
    ui.calendarCells.innerHTML = generateMonthMarkup(state.viewDate, notesCountMap, todayKey);

    if (ui.calendarCellsPrev) {
      ui.calendarCellsPrev.innerHTML = generateMonthMarkup(new Date(currYear, currMonth - 1, 1), notesCountMap, todayKey);
    }
    if (ui.calendarCellsNext) {
      ui.calendarCellsNext.innerHTML = generateMonthMarkup(new Date(currYear, currMonth + 1, 1), notesCountMap, todayKey);
    }
  }

  let isAnimatingMonth = false;
  let hasSwiped = false;

  function slideMonth(direction) {
    if (isAnimatingMonth || state.isLoading) return;
    isAnimatingMonth = true;

    const track = ui.calendarTrack;
    if (!track) {
      state.viewDate.setMonth(state.viewDate.getMonth() + direction, 1);
      renderCalendarGrid();
      isAnimatingMonth = false;
      return;
    }

    track.classList.remove("is-dragging");
    track.style.transition = "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)";
    track.style.transform = direction > 0 ? "translate3d(-66.666666%, 0, 0)" : "translate3d(0%, 0, 0)";

    if (ui.calendarTitle) ui.calendarTitle.style.opacity = "0.5";

    let transitionFired = false;
    function onTransitionEnd() {
      if (transitionFired) return;
      transitionFired = true;
      track.removeEventListener("transitionend", onTransitionEnd);

      state.viewDate.setMonth(state.viewDate.getMonth() + direction, 1);

      track.style.transition = "none";
      track.style.transform = "translate3d(-33.333333%, 0, 0)";
      void track.offsetWidth;

      renderCalendarGrid();

      if (ui.calendarTitle) ui.calendarTitle.style.opacity = "1";
      track.style.transition = "";

      setTimeout(() => { isAnimatingMonth = false; }, 40);
    }

    track.addEventListener("transitionend", onTransitionEnd);
    setTimeout(onTransitionEnd, 320);
  }

  function snapBackCalendar() {
    const track = ui.calendarTrack;
    if (!track) return;
    track.classList.remove("is-dragging");
    track.style.transition = "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
    track.style.transform = "translate3d(-33.333333%, 0, 0)";

    if (ui.calendarTitle) ui.calendarTitle.style.opacity = "1";
    setTimeout(() => {
      track.style.transition = "";
      isAnimatingMonth = false;
    }, 260);
  }

  function setupCalendarSwipe() {
    const carousel = ui.calendarCarousel;
    const track = ui.calendarTrack;
    if (!carousel || !track) return;

    let startX = 0;
    let startY = 0;
    let currentDeltaX = 0;
    let startTime = 0;
    let isDragging = false;
    let isHorizontalGesture = null;

    function getClientPos(e) {
      return e.touches?.[0] ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    }

    function onGestureStart(e) {
      if (isAnimatingMonth || state.isLoading || (e.type === "mousedown" && e.button !== 0)) return;

      const pos = getClientPos(e);
      startX = pos.x;
      startY = pos.y;
      currentDeltaX = 0;
      startTime = Date.now();
      isDragging = false;
      isHorizontalGesture = (e.type === "mousedown") ? true : null;
      hasSwiped = false;

      if (e.type === "touchstart") {
        window.addEventListener("touchmove", onGestureMove, { passive: false });
        window.addEventListener("touchend", onGestureEnd, { passive: true });
        window.addEventListener("touchcancel", onGestureEnd, { passive: true });
      } else {
        window.addEventListener("mousemove", onGestureMove);
        window.addEventListener("mouseup", onGestureEnd);
      }
    }

    function onGestureMove(e) {
      if ((startX === 0 && startY === 0) || isAnimatingMonth) return;

      const pos = getClientPos(e);
      const dx = pos.x - startX;
      const dy = pos.y - startY;

      if (isHorizontalGesture === null) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) {
          isHorizontalGesture = false;
          return;
        }
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 7) {
          isHorizontalGesture = true;
        }
      }

      if (!isHorizontalGesture) return;
      if (e.cancelable) e.preventDefault();

      if (!isDragging) {
        isDragging = true;
        carousel.classList.add("is-dragging");
        track.classList.add("is-dragging");
      }

      currentDeltaX = dx;
      if (Math.abs(dx) > 8) hasSwiped = true;

      const carouselWidth = carousel.offsetWidth || 300;
      track.style.transform = `translate3d(${-carouselWidth + dx}px, 0, 0)`;
    }

    function onGestureEnd() {
      window.removeEventListener("touchmove", onGestureMove);
      window.removeEventListener("touchend", onGestureEnd);
      window.removeEventListener("touchcancel", onGestureEnd);
      window.removeEventListener("mousemove", onGestureMove);
      window.removeEventListener("mouseup", onGestureEnd);

      if (startX === 0 && startY === 0) return;
      const carouselWidth = carousel.offsetWidth || 300;
      const velocity = currentDeltaX / (Date.now() - startTime || 1);

      carousel.classList.remove("is-dragging");
      track.classList.remove("is-dragging");

      if (isDragging) {
        const threshold = Math.min(65, carouselWidth * 0.16);
        if (currentDeltaX < -threshold || (currentDeltaX < -20 && velocity < -0.25)) {
          slideMonth(1);
        } else if (currentDeltaX > threshold || (currentDeltaX > 20 && velocity > 0.25)) {
          slideMonth(-1);
        } else {
          snapBackCalendar();
        }
      }

      startX = startY = currentDeltaX = 0;
      isDragging = false;
      isHorizontalGesture = null;

      if (hasSwiped) {
        setTimeout(() => { hasSwiped = false; }, 80);
      }
    }

    carousel.addEventListener("touchstart", onGestureStart, { passive: true });
    carousel.addEventListener("mousedown", onGestureStart);
  }

  function renderCourseDates() {
    const titleParts = [];
    if (state.course !== "ALL") titleParts.push(state.course);
    if (state.topic !== "ALL") titleParts.push(`Topic: ${state.topic}`);
    ui.courseTitle.textContent = (titleParts.length ? titleParts : ["Filtered Classes"]).join(" • ");

    if (state.isLoading) {
      ui.courseCount.textContent = "";
      ui.courseDatesList.innerHTML = Array.from({ length: 6 }, () => `
        <div class="course-card skeleton-card" aria-hidden="true">
          <div class="course-card-info">
            <div class="skeleton-line skeleton-line--date"></div>
            <div class="skeleton-line skeleton-line--day"></div>
          </div>
          <div class="skeleton-line skeleton-line--badge"></div>
        </div>`).join("");
      return;
    }

    const filtered = filterActiveNotes();
    const notesCountMap = getNotesCountMap(filtered);
    const uniqueDates = Object.keys(notesCountMap).sort();

    ui.courseCount.textContent = `(${pluralize(uniqueDates.length, 'lecture date', 'lecture dates')})`;

    if (!uniqueDates.length) {
      ui.courseDatesList.innerHTML = renderEmptyState((!state.dept || !state.sec) ? "Please select department and section to view notes." : "No notes found matching your selected filters.");
      return;
    }

    ui.courseDatesList.innerHTML = uniqueDates.map(dateStr => {
      const dateObj = parseLocalDate(dateStr);
      return `
        <div class="course-card" data-date="${escapeHtml(dateStr)}">
          <div class="course-card-info">
            <span class="course-card-date">${formatReadableDate(dateStr)}</span>
            <span class="course-card-day">${DAY_NAMES[dateObj.getDay()] || ""}</span>
          </div>
          <span class="course-card-badge">${pluralize(notesCountMap[dateStr] || 0, 'note', 'notes')}</span>
        </div>`;
    }).join("");
  }

  function renderModalNotes() {
    if (!state.activeDate) return;
    ui.modalDateLabel.textContent = `Date: ${formatReadableDate(state.activeDate)}`;
    const notes = filterActiveNotes().filter(n => n.date === state.activeDate);
    ui.modalNotesTotal.textContent = `Total: ${pluralize(notes.length, 'note', 'notes')}`;

    if (!notes.length) {
      ui.modalNotesStack.innerHTML = renderEmptyState((!state.dept || !state.sec) ? "Please select department and section first." : "No lecture material attached to this date for the selected criteria.");
      return;
    }

    const groups = {};
    for (const n of notes) {
      const c = n.course || "General", t = n.topic || "Class Notes";
      if (!groups[c]) groups[c] = {};
      if (!groups[c][t]) groups[c][t] = [];
      groups[c][t].push(n);
    }

    let output = "";
    for (const [course, topics] of Object.entries(groups)) {
      output += `<div class="note-cluster"><h4 class="note-cluster-course">${escapeHtml(course)}</h4>`;
      for (const [topic, items] of Object.entries(topics)) {
        output += `<div class="note-cluster-topic-group"><div class="note-cluster-topic-header">${escapeHtml(topic)}</div><ul class="note-cluster-list">`;
        for (const item of items) {
          const isReported = Number(item.reportCount || 0) >= 3;
          const title = escapeHtml(item.title || "View Note");
          const validatedLink = validateAndSanitizeUrl(item.link);
          const hasLink = Boolean(validatedLink);
          const escapedLink = escapeHtml(validatedLink);
          const viewCount = Number(item.viewCount || 0);

          const titleBody = `
            <svg class="note-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span class="note-title-text">${title}</span>`;

          const titleEl = hasLink
            ? `<a href="${escapedLink}" target="_blank" rel="noopener noreferrer" class="note-title-btn" data-row="${escapeHtml(item.row ?? "")}" title="${title}">${titleBody}</a>`
            : `<span class="note-title-plain" title="${title}">${titleBody}</span>`;

          const actions = `
            <div class="note-row-actions">
              <span class="note-view-badge" title="${viewCount} ${viewCount === 1 ? 'view' : 'views'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span class="view-count-num" data-row="${escapeHtml(item.row ?? "")}">${viewCount}</span>
              </span>
              ${hasLink ? `
              <button type="button" class="btn-share" data-title="${title}" data-link="${escapedLink}" data-course="${escapeHtml(course)}" aria-label="Share note link" title="Share">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
              </button>
              <button type="button" class="btn-report" data-row="${escapeHtml(item.row ?? item.title ?? "")}" data-title="${title}" data-course="${escapeHtml(course)}" aria-label="Report broken link" title="Report">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                  <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
              </button>` : ""}
            </div>`;

          output += `
            <li class="note-row">
              <div class="note-row-left">
                ${titleEl}
                ${isReported ? '<span class="note-row-flag">[Issue Reported]</span>' : ""}
              </div>
              ${actions}
            </li>`;
        }
        output += `</ul></div>`;
      }
      output += `</div>`;
    }
    ui.modalNotesStack.innerHTML = output;
  }

  function render() {
    updateSelectionBanner();
    updateFilterLabels();

    const showCalendar = (state.course === "ALL" && state.topic === "ALL");
    ui.calendarView.hidden = !showCalendar;
    ui.courseView.hidden = showCalendar;

    if (showCalendar) {
      renderCalendarGrid();
    } else {
      renderCourseDates();
    }
  }

  function onFilterSelect(key, val) {
    if (key === "dept") {
      state.dept = val;
      state.sec = "";
      state.course = state.topic = "ALL";
      state.notes = [];
      safeStorage.set("selected_dept", val);
      safeStorage.set("selected_sec", "");
    } else if (key === "sec") {
      state.sec = val;
      state.course = state.topic = "ALL";
      safeStorage.set("selected_sec", val);
      loadNotes();
    } else if (key === "course") {
      state.course = val;
      state.topic = "ALL";
    } else if (key === "topic") {
      state.topic = val;
    }
    closeAllMenus();
    syncDropdownStates();
    render();
  }

  function bindEvents() {
    if (ui.mobileMenuToggle && ui.headerNav) {
      ui.mobileMenuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        setMobileMenu(!ui.headerNav.classList.contains("is-open"));
      });
      ui.headerNav.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => setMobileMenu(false));
      });
      document.addEventListener("click", (e) => {
        if (!ui.headerNav.contains(e.target) && !ui.mobileMenuToggle.contains(e.target) && ui.headerNav.classList.contains("is-open")) {
          setMobileMenu(false);
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && ui.headerNav.classList.contains("is-open")) setMobileMenu(false);
      });
    }

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".nav-filter-item")) closeAllMenus();
    });

    if (ui.navFilters) ui.navFilters.addEventListener("scroll", closeAllMenus, { passive: true });
    window.addEventListener("scroll", closeAllMenus, { passive: true });
    window.addEventListener("resize", closeAllMenus, { passive: true });

    ui.navFilters.addEventListener("click", (e) => {
      const trigger = e.target.closest(".nav-filter-trigger");
      if (trigger) {
        toggleMenu(trigger.closest(".nav-filter-item").querySelector(".nav-filter-menu"), trigger);
        return;
      }
      const opt = e.target.closest(".nav-filter-option");
      if (opt) onFilterSelect(opt.closest(".nav-filter-item").dataset.filter, opt.dataset.value);
    });

    ui.addModal.addEventListener("click", (e) => {
      const trigger = e.target.closest(".field .nav-filter-trigger");
      if (trigger) {
        toggleMenu(trigger.closest(".nav-filter-item").querySelector(".nav-filter-menu"), trigger);
        return;
      }
      const opt = e.target.closest(".field .nav-filter-option");
      if (opt?.dataset.value) {
        const val = opt.dataset.value;
        const field = opt.closest(".nav-filter-item").dataset.field;
        updateModalDropdowns(
          field === "dept" ? val : ui.formDept.value,
          field === "sec" ? val : ui.formSec.value,
          field === "course" ? val : ui.formCourse.value
        );
        closeAllMenus();
      }
    });

    document.querySelectorAll(".dialog-modal").forEach(modal => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal && isEventOutside(modal, e)) closeSheetModal(modal);
      });
      modal.addEventListener("cancel", (e) => {
        e.preventDefault();
        closeSheetModal(modal);
      });
    });

    document.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", () => {
        const m = btn.closest("dialog");
        if (m) closeSheetModal(m);
      });
    });

    ui.notesModal.addEventListener("close", () => { state.activeDate = null; checkBodyScrollLock(); });
    ui.reportModal.addEventListener("close", checkBodyScrollLock);
    ui.addModal.addEventListener("close", () => {
      closeAllMenus();
      clearSelectedFile();
      checkBodyScrollLock();
    });

    ui.prevMonthBtn.addEventListener("click", () => {
      if (!state.isLoading) slideMonth(-1);
    });
    ui.nextMonthBtn.addEventListener("click", () => {
      if (!state.isLoading) slideMonth(1);
    });
    ui.todayBtn.addEventListener("click", () => {
      if (state.isLoading || isAnimatingMonth) return;
      const t = new Date();
      const target = new Date(t.getFullYear(), t.getMonth(), 1);
      if (target.getFullYear() === state.viewDate.getFullYear() && target.getMonth() === state.viewDate.getMonth()) return;
      state.viewDate = target;
      renderCalendarGrid();
    });

    ui.calendarCells.addEventListener("click", (e) => {
      if (hasSwiped || state.isLoading) return;
      const cell = e.target.closest("td[data-date]");
      if (cell && !cell.classList.contains("calendar-cell--disabled")) openDateDetails(cell.dataset.date);
    });

    ui.courseDatesList.addEventListener("click", (e) => {
      if (state.isLoading) return;
      const card = e.target.closest("[data-date]");
      if (card?.dataset.date) openDateDetails(card.dataset.date);
    });

    if (ui.tabModeFile) {
      ui.tabModeFile.addEventListener("click", () => setUploadMode("file"));
    }
    if (ui.tabModeLink) {
      ui.tabModeLink.addEventListener("click", () => setUploadMode("link"));
    }

    if (ui.formFileInput) {
      ui.formFileInput.addEventListener("change", () => {
        if (ui.formFileInput.files && ui.formFileInput.files[0]) {
          handleFileSelected(ui.formFileInput.files[0]);
        } else {
          clearSelectedFile();
        }
      });
    }

    if (ui.btnRemoveFile) {
      ui.btnRemoveFile.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearSelectedFile();
      });
    }

    if (ui.fileDropzone) {
      ["dragenter", "dragover"].forEach(evt => {
        ui.fileDropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          ui.fileDropzone.classList.add("is-dragover");
        });
      });

      ["dragleave", "drop"].forEach(evt => {
        ui.fileDropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          ui.fileDropzone.classList.remove("is-dragover");
        });
      });

      ui.fileDropzone.addEventListener("drop", (e) => {
        if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
          ui.formFileInput.files = e.dataTransfer.files;
          handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }

    ui.addNoteBtn.addEventListener("click", () => {
      setMobileMenu(false);
      state.manualTitleEdited = false;
      ui.addForm.reset();
      clearSelectedFile();
      if (ui.formLink) ui.formLink.value = "";
      setUploadMode("file");
      const todayDate = formatDateKey(new Date());
      ui.formDate.max = todayDate;
      ui.formDate.value = (state.activeDate && state.activeDate <= todayDate) ? state.activeDate : todayDate;
      ui.formTopic.value = (state.topic !== "ALL") ? state.topic : "";
      updateModalDropdowns(state.dept, state.sec, state.course !== "ALL" ? state.course : "");
      openSheetModal(ui.addModal);
    });

    ui.formDate.addEventListener("change", calculateDefaultTitle);
    ui.formTitle.addEventListener("input", () => {
      state.manualTitleEdited = ui.formTitle.value.trim().length > 0;
    });

    ui.addForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const botCheck = ui.addForm.querySelector(".bot-field");
      if (botCheck && botCheck.value.trim() !== "") {
        closeSheetModal(ui.addModal);
        showToast("Submission rejected.");
        return;
      }

      const cleanTitle = sanitizeTextInput(ui.formTitle.value, SECURITY.MAX_TITLE_LENGTH);
      const cleanTopic = sanitizeTextInput(ui.formTopic.value, SECURITY.MAX_TOPIC_LENGTH);

      if (!cleanTitle || !cleanTopic) {
        showToast("Please provide valid title and topic.");
        return;
      }

      const basePayload = {
        department: ui.formDept.value,
        section: ui.formSec.value,
        date: ui.formDate.value,
        course: ui.formCourse.value,
        topic: cleanTopic,
        title: cleanTitle,
        status: "Pending"
      };

      if (state.uploadMode === "file") {
        const selectedFile = ui.formFileInput?.files ? ui.formFileInput.files[0] : null;

        if (!selectedFile) {
          showToast("Please choose a lecture file to upload.");
          return;
        }

        if (!isAllowedFile(selectedFile)) {
          showToast("Invalid file type. Allowed: PDF, DOC, PPT, PNG, JPG.");
          return;
        }

        if (selectedFile.size > SECURITY.MAX_FILE_SIZE_BYTES) {
          showToast("File size exceeds 10MB limit. Please choose a smaller file.");
          return;
        }

        setButtonLoading(ui.btnSubmitNote, true);
        if (ui.btnRemoveFile) ui.btnRemoveFile.disabled = true;
        if (ui.fileProgressContainer) ui.fileProgressContainer.hidden = false;

        const totalFormatted = formatFileSize(selectedFile.size);

        updateProgressUI(3, "Preparing file...", `0 B of ${totalFormatted}`);

        let fileBase64 = "";
        try {
          fileBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onprogress = (evt) => {
              if (evt.lengthComputable && evt.total > 0) {
                const ratio = evt.loaded / evt.total;
                const p = Math.max(3, Math.round(ratio * 15));
                const loadedSize = formatFileSize(evt.loaded);
                updateProgressUI(p, "Reading file...", `${loadedSize} of ${totalFormatted}`);
              }
            };
            reader.onload = () => {
              const res = reader.result;
              resolve(typeof res === "string" ? res.split(",")[1] || "" : "");
            };
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(selectedFile);
          });
        } catch (readErr) {
          setButtonLoading(ui.btnSubmitNote, false);
          if (ui.btnRemoveFile) ui.btnRemoveFile.disabled = false;
          updateProgressUI(0, "Read failed", totalFormatted, false, true);
          showToast("Could not read file. Please try again.");
          return;
        }

        const progressTracker = startUploadProgressSimulation(selectedFile.size, (pct, status, sizeText, isDone, isErr) => {
          updateProgressUI(pct, status, sizeText, isDone, isErr);
        });

        try {
          await syncData({
            ...basePayload,
            fileName: selectedFile.name,
            fileMimeType: selectedFile.type || "application/octet-stream",
            fileData: fileBase64
          });

          await progressTracker.finish();
          await new Promise(r => setTimeout(r, 450));

          safeStorage.remove(`notes_${ui.formDept.value}_${ui.formSec.value}`);
          closeSheetModal(ui.addModal);
          ui.addForm.reset();
          clearSelectedFile();
          showToast("Note and file uploaded! Pending admin approval.");
        } catch (err) {
          console.error("Upload error:", err);
          progressTracker.error();
          showToast("Failed to upload note. Please retry.");
        } finally {
          setButtonLoading(ui.btnSubmitNote, false);
          if (ui.btnRemoveFile) ui.btnRemoveFile.disabled = false;
        }
      } else {
        const rawLink = ui.formLink?.value ? ui.formLink.value.trim() : "";
        if (!rawLink) {
          showToast("Please provide a resource URL.");
          return;
        }

        const validatedLink = validateAndSanitizeUrl(rawLink);
        if (!validatedLink) {
          showToast("Please provide a valid web URL (e.g. https://...).");
          return;
        }

        setButtonLoading(ui.btnSubmitNote, true);

        try {
          await syncData({
            ...basePayload,
            link: validatedLink
          });

          safeStorage.remove(`notes_${ui.formDept.value}_${ui.formSec.value}`);
          closeSheetModal(ui.addModal);
          ui.addForm.reset();
          if (ui.formLink) ui.formLink.value = "";
          showToast("Note link submitted! Pending admin approval.");
        } catch (err) {
          console.error("Submit error:", err);
          showToast("Failed to submit note. Please retry.");
        } finally {
          setButtonLoading(ui.btnSubmitNote, false);
        }
      }
    });

    ui.modalNotesStack.addEventListener("click", async (e) => {
      const noteLink = e.target.closest(".note-title-btn");
      if (noteLink) {
        const row = noteLink.dataset.row;
        if (row) recordNoteView(row);
        return;
      }

      const shareBtn = e.target.closest(".btn-share");
      if (shareBtn) {
        const title = shareBtn.dataset.title || "Lecture Note";
        const link = shareBtn.dataset.link || "";
        const course = shareBtn.dataset.course || "";

        if (navigator.share) {
          try {
            await navigator.share({
              title: `${title} (${course})`,
              text: `ClassNotes: ${course} - ${title}`,
              url: link
            });
          } catch (err) {
            if (err.name !== "AbortError") copyToClipboard(link);
          }
        } else {
          copyToClipboard(link);
        }
        return;
      }

      const reportBtn = e.target.closest(".btn-report");
      if (reportBtn) {
        setButtonLoading(ui.btnSubmitReport, false);
        const title = reportBtn.dataset.title || "";
        const course = reportBtn.dataset.course || "";
        const row = reportBtn.dataset.row || title;
        const context = `${course} • ${formatReadableDate(state.activeDate)}`;

        closeSheetModal(ui.notesModal, () => {
          ui.reportTitle.textContent = title;
          ui.reportContext.textContent = context;
          ui.reportForm.dataset.targetRow = row;
          openSheetModal(ui.reportModal);
        });
      }
    });

    ui.reportForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const botCheck = ui.reportForm.querySelector(".bot-field");
      if (botCheck && botCheck.value.trim() !== "") {
        closeSheetModal(ui.reportModal);
        return;
      }

      const row = ui.reportForm.dataset.targetRow;

      setButtonLoading(ui.btnSubmitReport, true);
      try {
        await syncData({ type: "report", row });
        closeSheetModal(ui.reportModal);
        showToast("Thank you. Link report has been recorded.");
      } catch {
        showToast("Could not submit report. Check internet connection.");
      } finally {
        setButtonLoading(ui.btnSubmitReport, false);
      }
    });

    document.querySelectorAll(".dialog-modal.bottom-sheet").forEach(sheet => {
      const handle = sheet.querySelector(".bottom-sheet-handle-wrapper");
      const header = sheet.querySelector(".dialog-modal-header");
      const content = sheet.querySelector(".notes-stack, .modal-body-scroll");
      setupBottomSheetGestures(sheet, handle, header, content, () => closeSheetModal(sheet));
    });

    setupCalendarSwipe();
  }

  function init() {
    injectHoneypot(ui.addForm);
    injectHoneypot(ui.reportForm);
    updateModalDropdowns(state.dept, state.sec);
    syncDropdownStates();
    bindEvents();
    render();
    if (state.dept && state.sec) {
      loadNotes();
    }
  }

  init();
})();