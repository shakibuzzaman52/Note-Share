/**
 * ClassNotes — Clean Application Logic (No Confusing Lecture Numbers)
 */
(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {
    googleAppsScriptUrl: "",
    departments: []
  };

  const API_URL = cfg.googleAppsScriptUrl;
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const SHORT_MONTHS = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
  };

  // State
  const now = new Date();
  const state = {
    dept: cfg.departments[0]?.code || "CSE",
    sec: cfg.departments[0]?.sections[0] || "73_L",
    course: "ALL", // "ALL" = All Courses, or specific course name
    viewDate: new Date(now.getFullYear(), now.getMonth(), 1),
    selectedDate: toDateKey(now),
    notes: []
  };

  let isTitleManuallyEdited = false;
  const $ = id => document.getElementById(id);

  function toDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function cleanDate(val) {
    if (!val) return "";
    const str = String(val).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    const textMatch = str.match(/\b([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\b/) || str.match(/\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b/);
    if (textMatch) {
      const monthPart = isNaN(textMatch[1]) ? textMatch[1].toLowerCase() : textMatch[2].toLowerCase();
      const dayPart = isNaN(textMatch[1]) ? textMatch[2] : textMatch[1];
      const yearPart = textMatch[3];
      if (SHORT_MONTHS[monthPart]) {
        return `${yearPart}-${SHORT_MONTHS[monthPart]}-${String(dayPart).padStart(2, "0")}`;
      }
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return toDateKey(parsed);
    }

    return str;
  }

  function formatDisplayDate(dateKey) {
    if (!dateKey) return "";
    const parts = dateKey.split("-");
    if (parts.length === 3) {
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${parseInt(parts[2], 10)} ${MONTH_NAMES[mIdx]} ${parts[0]}`;
    }
    return dateKey;
  }

  function populateSelect(selectEl, items, includeAll = false, allLabel = "All Courses") {
    let options = "";
    if (includeAll) {
      options += `<option value="ALL">${allLabel}</option>`;
    }
    options += items.map(item => `<option value="${item}">${item}</option>`).join("");
    selectEl.innerHTML = options;
  }

  function updateDropdowns() {
    const activeDept = cfg.departments.find(d => d.code === state.dept) || cfg.departments[0];
    if (!activeDept) return;

    populateSelect($("section-select"), activeDept.sections);
    populateSelect($("course-select"), activeDept.courses, true, "All Courses");

    populateSelect($("form-section"), activeDept.sections);
    populateSelect($("form-course"), activeDept.courses);

    $("dept-select").value = state.dept;

    if (activeDept.sections.includes(state.sec)) {
      $("section-select").value = state.sec;
    } else {
      state.sec = activeDept.sections[0] || "";
      $("section-select").value = state.sec;
    }

    if (state.course === "ALL" || activeDept.courses.includes(state.course)) {
      $("course-select").value = state.course;
    } else {
      state.course = "ALL";
      $("course-select").value = "ALL";
    }

    updateClassBadge();
  }

  function updateFormCourses() {
    const selectedDeptCode = $("form-dept").value;
    const deptObj = cfg.departments.find(d => d.code === selectedDeptCode);
    if (deptObj) {
      populateSelect($("form-section"), deptObj.sections);
      populateSelect($("form-course"), deptObj.courses);
    }
  }

  function updateClassBadge() {
    if (state.course === "ALL") {
      $("current-class-badge").textContent = `${state.dept} • Section ${state.sec}`;
    } else {
      $("current-class-badge").textContent = `${state.dept} • Sec ${state.sec} • ${state.course}`;
    }
  }

  function updateDefaultTitle() {
    if (isTitleManuallyEdited) return;

    const dept = $("form-dept").value || state.dept;
    const sec = $("form-section").value || state.sec;
    const date = $("form-date").value || state.selectedDate;
    const course = $("form-course").value;

    const count = state.notes.filter(n =>
      n.department.toLowerCase() === dept.toLowerCase() &&
      n.section.toLowerCase() === sec.toLowerCase() &&
      n.date === date &&
      (!course || n.course.toLowerCase() === course.toLowerCase())
    ).length;

    $("form-title").value = `Note ${count + 1}`;
  }

  function getSectionApprovedNotes() {
    return state.notes.filter(n =>
      n.department.toLowerCase() === state.dept.toLowerCase() &&
      n.section.toLowerCase() === state.sec.toLowerCase() &&
      n.status.toLowerCase() === "approved"
    );
  }

  // -------------------------------------------------------------
  // BEHAVIOR 1: Render Full Monthly Calendar
  // -------------------------------------------------------------
  function renderFullCalendar() {
    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();
    $("calendar-month-year").textContent = `${MONTH_NAMES[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const noteDates = new Set(getSectionApprovedNotes().map(n => n.date));

    let html = "";
    for (let i = 0; i < firstDayIndex; i++) {
      html += `<div class="cal-day empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isSelected = dateKey === state.selectedDate;
      const hasNote = noteDates.has(dateKey);

      html += `
        <button class="cal-day ${isSelected ? 'is-selected' : ''}" data-date="${dateKey}">
          <span>${d}</span>
          ${hasNote ? '<span class="cal-dot"></span>' : ''}
        </button>
      `;
    }

    $("calendar-grid").innerHTML = html;
  }

  // -------------------------------------------------------------
  // BEHAVIOR 2: Render Specific Course Dates (No Lecture Numbers)
  // -------------------------------------------------------------
  function renderCourseDatesView() {
    const courseNotes = getSectionApprovedNotes().filter(n =>
      n.course.toLowerCase() === state.course.toLowerCase()
    );

    // Extract unique dates sorted chronologically
    const uniqueDates = [...new Set(courseNotes.map(n => n.date))].sort();

    $("course-dates-title").textContent = state.course;
    $("course-dates-count").textContent = `${uniqueDates.length} ${uniqueDates.length === 1 ? 'date' : 'dates'}`;

    const container = $("course-dates-list");

    if (uniqueDates.length === 0) {
      container.innerHTML = `
        <div class="notes-empty-state">
          <p>No notes found for <strong>${state.course}</strong> yet.</p>
        </div>
      `;
      return;
    }

    // Auto-select latest date if currently selected date is not in this course's dates
    if (!uniqueDates.includes(state.selectedDate)) {
      state.selectedDate = uniqueDates[uniqueDates.length - 1];
    }

    let html = "";
    uniqueDates.forEach((dateStr) => {
      const d = new Date(dateStr + "T00:00:00");
      const weekday = !isNaN(d.getTime()) ? WEEKDAYS[d.getDay()] : "";
      const isSelected = dateStr === state.selectedDate;
      const noteCount = courseNotes.filter(n => n.date === dateStr).length;

      // শুধুমাত্র তারিখ, বার এবং নোটের সংখ্যা দেখানো হচ্ছে
      html += `
        <button class="course-date-card ${isSelected ? 'is-selected' : ''}" data-date="${dateStr}">
          <div class="course-date-info">
            <span class="date-main">${formatDisplayDate(dateStr)}</span>
            <span class="date-sub">${weekday}</span>
          </div>
          <span class="date-badge">${noteCount} ${noteCount === 1 ? 'note' : 'notes'}</span>
        </button>
      `;
    });

    container.innerHTML = html;
  }

  // -------------------------------------------------------------
  // Render Notes (Right Side)
  // -------------------------------------------------------------
  function renderNotes() {
    $("selected-date-display").textContent = formatDisplayDate(state.selectedDate);

    let dayNotes = getSectionApprovedNotes().filter(n => n.date === state.selectedDate);

    if (state.course !== "ALL") {
      dayNotes = dayNotes.filter(n => n.course.toLowerCase() === state.course.toLowerCase());
    }

    $("notes-count").textContent = `${dayNotes.length} notes`;
    const container = $("notes-list");

    if (!dayNotes.length) {
      container.innerHTML = `<div class="notes-empty-state"><p>No notes for this date.</p></div>`;
      return;
    }

    const grouped = {};
    dayNotes.forEach(n => {
      if (!grouped[n.course]) grouped[n.course] = {};
      if (!grouped[n.course][n.topic]) grouped[n.course][n.topic] = [];
      grouped[n.course][n.topic].push(n);
    });

    let html = "";
    for (const [course, topics] of Object.entries(grouped)) {
      html += `
        <div class="course-group">
          <h4 class="course-title">${course}</h4>
          <div class="topics-container">
            ${Object.entries(topics).map(([topic, items]) => `
              <div>
                <div class="topic-title">&rarr; ${topic}</div>
                <div>
                  ${items.map(item => `
                    <a href="${item.link || 'javascript:void(0)'}" 
                       ${item.link ? 'target="_blank" rel="noopener noreferrer"' : ''} 
                       class="note-link-item">
                      ${item.title} ↗
                    </a>
                  `).join("")}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // Master Render Function
  function render() {
    updateClassBadge();

    if (state.course === "ALL") {
      $("full-calendar-view").style.display = "block";
      $("course-dates-view").style.display = "none";
      renderFullCalendar();
    } else {
      $("full-calendar-view").style.display = "none";
      $("course-dates-view").style.display = "block";
      renderCourseDatesView();
    }

    renderNotes();
  }

  // Fetch Notes from Google Sheets
  async function fetchNotes() {
    if (!API_URL) return;
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (data?.success && Array.isArray(data.notes)) {
        state.notes = data.notes.map(n => ({
          department: String(n.department || "").trim(),
          section: String(n.section || "").trim(),
          date: cleanDate(n.date),
          course: String(n.course || "").trim(),
          topic: String(n.topic || "").trim(),
          title: String(n.title || "").trim(),
          link: String(n.link || "").trim(),
          status: String(n.status || "Approved").trim()
        }));

        const matches = getSectionApprovedNotes();
        if (matches.length > 0 && !matches.some(n => n.date === state.selectedDate)) {
          const parts = matches[0].date.split("-");
          if (parts.length === 3) {
            state.viewDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
            state.selectedDate = matches[0].date;
          }
        }

        render();
      }
    } catch (err) {
      console.warn("Could not fetch notes from Google Sheet:", err);
    }
  }

  // Event Listeners
  function bindEvents() {
    $("dept-select").onchange = e => {
      state.dept = e.target.value;
      updateDropdowns();
      state.sec = $("section-select").value;
      state.course = $("course-select").value;
      render();
    };

    $("section-select").onchange = e => {
      state.sec = e.target.value;
      render();
    };

    $("course-select").onchange = e => {
      state.course = e.target.value;
      render();
    };

    $("cal-prev").onclick = () => {
      state.viewDate.setMonth(state.viewDate.getMonth() - 1);
      render();
    };

    $("cal-next").onclick = () => {
      state.viewDate.setMonth(state.viewDate.getMonth() + 1);
      render();
    };

    $("cal-today").onclick = () => {
      const current = new Date();
      state.viewDate = new Date(current.getFullYear(), current.getMonth(), 1);
      state.selectedDate = toDateKey(current);
      render();
    };

    $("calendar-grid").onclick = e => {
      const btn = e.target.closest(".cal-day[data-date]");
      if (btn) {
        state.selectedDate = btn.dataset.date;
        render();
      }
    };

    $("course-dates-list").onclick = e => {
      const btn = e.target.closest(".course-date-card[data-date]");
      if (btn) {
        state.selectedDate = btn.dataset.date;
        render();
      }
    };

    // Modal Events
    const modal = $("add-modal");
    const statusMsg = $("form-status");
    const submitBtn = $("submit-btn");

    $("open-add-modal-btn").onclick = () => {
      isTitleManuallyEdited = false;

      $("form-dept").value = state.dept;
      updateFormCourses();
      $("form-section").value = state.sec;
      $("form-date").value = state.selectedDate;

      if (state.course !== "ALL") {
        $("form-course").value = state.course;
      }

      updateDefaultTitle();

      statusMsg.className = "form-status";
      statusMsg.style.display = "none";
      modal.classList.add("is-active");
    };

    const closeModal = () => modal.classList.remove("is-active");
    $("close-modal").onclick = closeModal;
    $("cancel-modal").onclick = closeModal;

    $("form-dept").onchange = () => {
      updateFormCourses();
      updateDefaultTitle();
    };
    $("form-section").onchange = updateDefaultTitle;
    $("form-date").onchange = updateDefaultTitle;
    $("form-course").onchange = updateDefaultTitle;

    $("form-title").oninput = () => {
      isTitleManuallyEdited = $("form-title").value.trim().length > 0;
    };

    // Submit Note
    $("note-form").onsubmit = async e => {
      e.preventDefault();
      submitBtn.disabled = true;

      statusMsg.className = "form-status info";
      statusMsg.textContent = "Submitting to Google Sheets...";

      const payload = {
        department: $("form-dept").value,
        section: $("form-section").value,
        date: $("form-date").value,
        course: $("form-course").value,
        topic: $("form-topic").value,
        title: $("form-title").value,
        link: $("form-link").value || "",
        status: "Pending"
      };

      try {
        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });

        statusMsg.className = "form-status success";
        statusMsg.textContent = "✓ Note submitted with Pending status! Once approved in the Sheet, it will appear.";

        setTimeout(() => {
          closeModal();
          $("note-form").reset();
          isTitleManuallyEdited = false;
          submitBtn.disabled = false;
        }, 2000);
      } catch (err) {
        statusMsg.className = "form-status success";
        statusMsg.textContent = "✓ Submitted! Please check Google Sheets.";
        setTimeout(() => {
          closeModal();
          isTitleManuallyEdited = false;
          submitBtn.disabled = false;
        }, 2000);
      }
    };
  }

  function init() {
    const deptCodes = cfg.departments.map(d => d.code);
    populateSelect($("dept-select"), deptCodes);
    populateSelect($("form-dept"), deptCodes);

    updateDropdowns();
    bindEvents();
    render();
    fetchNotes();
  }

  document.addEventListener("DOMContentLoaded", init);
})();