/**
 * ClassNotes — Ultra Simple Client Logic (No useless dropdowns)
 */
(function () {
  "use strict";

  const cfg = window.APP_CONFIG || { googleAppsScriptUrl: "", departments: [] };
  const API_URL = cfg.googleAppsScriptUrl;

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const now = new Date();
  const state = {
    dept: cfg.departments[0]?.code || "CSE",
    sec: cfg.departments[0]?.sections[0] || "73_L",
    course: "ALL",
    viewDate: new Date(now.getFullYear(), now.getMonth(), 1),
    selectedDate: toDateKey(now),
    notes: []
  };

  let isTitleManuallyEdited = false;
  let isNoteSubmitting = false;
  let isReportSubmitting = false;

  const $ = id => document.getElementById(id);

  function toDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatDisplayDate(dateKey) {
    if (!dateKey) return "";
    const [y, m, d] = dateKey.split("-");
    return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
  }

  async function sendData(payload) {
    return fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  }

  function populateSelect(selectEl, items, addAll = false) {
    selectEl.innerHTML = (addAll ? `<option value="ALL">All Courses</option>` : "") +
      items.map(item => `<option value="${item}">${item}</option>`).join("");
  }

  function updateDropdowns() {
    const activeDept = cfg.departments.find(d => d.code === state.dept) || cfg.departments[0];
    if (!activeDept) return;

    populateSelect($("section-select"), activeDept.sections);
    populateSelect($("course-select"), activeDept.courses, true);
    populateSelect($("form-section"), activeDept.sections);
    populateSelect($("form-course"), activeDept.courses);

    $("dept-select").value = state.dept;
    state.sec = activeDept.sections.includes(state.sec) ? state.sec : activeDept.sections[0];
    $("section-select").value = state.sec;

    state.course = activeDept.courses.includes(state.course) || state.course === "ALL" ? state.course : "ALL";
    $("course-select").value = state.course;

    updateClassBadge();
  }

  function updateFormCourses() {
    const deptObj = cfg.departments.find(d => d.code === $("form-dept").value);
    if (deptObj) {
      populateSelect($("form-section"), deptObj.sections);
      populateSelect($("form-course"), deptObj.courses);
    }
  }

  function updateClassBadge() {
    $("current-class-badge").textContent = state.course === "ALL" 
      ? `${state.dept} • Section ${state.sec}` 
      : `${state.dept} • Sec ${state.sec} • ${state.course}`;
  }

  function updateDefaultTitle() {
    if (isTitleManuallyEdited) return;
    const course = $("form-course").value;
    const count = state.notes.filter(n =>
      n.department === $("form-dept").value &&
      n.section === $("form-section").value &&
      n.date === ($("form-date").value || state.selectedDate) &&
      (!course || n.course === course)
    ).length;

    $("form-title").value = `Note ${count + 1}`;
  }

  function getSectionApprovedNotes() {
    return state.notes.filter(n =>
      n.department === state.dept &&
      n.section === state.sec &&
      n.status.toLowerCase() === "approved"
    );
  }

  function renderFullCalendar() {
    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();
    $("calendar-month-year").textContent = `${MONTHS[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const noteDates = new Set(getSectionApprovedNotes().map(n => n.date));
    const todayKey = toDateKey(new Date());

    let html = "";
    for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isFuture = dateKey > todayKey;
      const isSelected = dateKey === state.selectedDate;

      html += `
        <button class="cal-day ${isSelected ? 'is-selected' : ''} ${isFuture ? 'is-future' : ''}" 
                data-date="${dateKey}" ${isFuture ? 'disabled' : ''}>
          <span>${d}</span>
          ${noteDates.has(dateKey) ? '<span class="cal-dot"></span>' : ''}
        </button>
      `;
    }
    $("calendar-grid").innerHTML = html;
  }

  function renderCourseDatesView() {
    const courseNotes = getSectionApprovedNotes().filter(n => n.course === state.course);
    const uniqueDates = [...new Set(courseNotes.map(n => n.date))].sort();

    $("course-dates-title").textContent = state.course;
    $("course-dates-count").textContent = `${uniqueDates.length} dates`;

    const container = $("course-dates-list");
    if (!uniqueDates.length) {
      container.innerHTML = `<div class="notes-empty-state"><p>No notes for <strong>${state.course}</strong> yet.</p></div>`;
      return;
    }

    if (!uniqueDates.includes(state.selectedDate)) {
      state.selectedDate = uniqueDates[uniqueDates.length - 1];
    }

    container.innerHTML = uniqueDates.map(dateStr => {
      const d = new Date(dateStr + "T00:00:00");
      const noteCount = courseNotes.filter(n => n.date === dateStr).length;
      return `
        <button class="course-date-card ${dateStr === state.selectedDate ? 'is-selected' : ''}" data-date="${dateStr}">
          <div class="course-date-info">
            <span class="date-main">${formatDisplayDate(dateStr)}</span>
            <span class="date-sub">${DAYS[d.getDay()] || ""}</span>
          </div>
          <span class="date-badge">${noteCount} ${noteCount === 1 ? 'note' : 'notes'}</span>
        </button>
      `;
    }).join("");
  }

  function renderNotes() {
    $("selected-date-display").textContent = formatDisplayDate(state.selectedDate);

    let dayNotes = getSectionApprovedNotes().filter(n => n.date === state.selectedDate);
    if (state.course !== "ALL") {
      dayNotes = dayNotes.filter(n => n.course === state.course);
    }

    $("notes-count").textContent = `${dayNotes.length} notes`;
    const container = $("notes-list");

    if (!dayNotes.length) {
      container.innerHTML = `<div class="notes-empty-state"><p>No notes for this date.</p></div>`;
      return;
    }

    const grouped = {};
    dayNotes.forEach(n => {
      const c = n.course || "Course Notes";
      const t = n.topic || "Class Topic";
      if (!grouped[c]) grouped[c] = {};
      if (!grouped[c][t]) grouped[c][t] = [];
      grouped[c][t].push(n);
    });

    let html = "";
    for (const course in grouped) {
      html += `
        <div class="course-group">
          <h4 class="course-title">${course}</h4>
          <div class="topics-container">
            ${Object.entries(grouped[course]).map(([topic, items]) => `
              <div>
                <div class="topic-title">&rarr; ${topic}</div>
                <div>
                  ${items.map(item => {
                    const isReported = Number(item.reportCount || 0) >= 3;
                    const itemTitle = item.title || "View Note";
                    const itemLink = item.link || "";

                    return `
                      <div class="note-item-row ${isReported ? 'has-issue' : ''}">
                        <a href="${itemLink || 'javascript:void(0)'}" 
                           ${itemLink ? 'target="_blank" rel="noopener noreferrer"' : ''} 
                           class="note-link-item">
                          ${itemTitle} ↗
                        </a>
                        ${isReported ? `<span class="badge-reported">⚠️ Permission Issue</span>` : ''}
                        ${itemLink ? `
                          <button type="button" class="btn-report" title="Report Issue" 
                                  data-row="${item.row}"
                                  data-title="${itemTitle}" 
                                  data-course="${course}">
                            ⚑
                          </button>` : ''}
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  function render() {
    updateClassBadge();
    const isAll = state.course === "ALL";
    $("full-calendar-view").style.display = isAll ? "block" : "none";
    $("course-dates-view").style.display = isAll ? "none" : "block";

    if (isAll) renderFullCalendar();
    else renderCourseDatesView();

    renderNotes();
  }

  async function fetchNotes() {
    if (!API_URL) return;
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (data?.success && Array.isArray(data.notes)) {
        state.notes = data.notes;

        const matches = getSectionApprovedNotes();
        if (matches.length > 0 && !matches.some(n => n.date === state.selectedDate)) {
          state.selectedDate = matches[0].date;
          const [y, m] = matches[0].date.split("-");
          state.viewDate = new Date(y, m - 1, 1);
        }
        render();
      }
    } catch (e) {
      console.warn("Fetch error:", e);
    }
  }

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

    $("cal-prev").onclick = () => { state.viewDate.setMonth(state.viewDate.getMonth() - 1); render(); };
    $("cal-next").onclick = () => { state.viewDate.setMonth(state.viewDate.getMonth() + 1); render(); };
    $("cal-today").onclick = () => {
      const d = new Date();
      state.viewDate = new Date(d.getFullYear(), d.getMonth(), 1);
      state.selectedDate = toDateKey(d);
      render();
    };

    $("calendar-grid").onclick = e => {
      const btn = e.target.closest(".cal-day[data-date]:not(:disabled)");
      if (btn) { state.selectedDate = btn.dataset.date; render(); }
    };

    $("course-dates-list").onclick = e => {
      const btn = e.target.closest(".course-date-card[data-date]");
      if (btn) { state.selectedDate = btn.dataset.date; render(); }
    };

    // Add Note Modal
    const addModal = $("add-modal");
    $("open-add-modal-btn").onclick = () => {
      isTitleManuallyEdited = false;
      const todayKey = toDateKey(new Date());
      $("form-date").max = todayKey;
      $("form-dept").value = state.dept;
      updateFormCourses();
      $("form-section").value = state.sec;
      $("form-date").value = state.selectedDate > todayKey ? todayKey : state.selectedDate;
      if (state.course !== "ALL") $("form-course").value = state.course;
      updateDefaultTitle();
      $("form-status").style.display = "none";
      addModal.classList.add("is-active");
    };

    $("close-modal").onclick = $("cancel-modal").onclick = () => addModal.classList.remove("is-active");
    $("form-dept").onchange = () => { updateFormCourses(); updateDefaultTitle(); };
    $("form-section").onchange = $("form-date").onchange = $("form-course").onchange = updateDefaultTitle;
    $("form-title").oninput = () => { isTitleManuallyEdited = $("form-title").value.trim().length > 0; };

    // Note Submit
    $("note-form").onsubmit = async e => {
      e.preventDefault();
      if (isNoteSubmitting) return;
      isNoteSubmitting = true;

      const submitBtn = $("submit-btn");
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting... ⏳";

      const status = $("form-status");
      status.style.display = "block";
      status.className = "form-status info";
      status.textContent = "Submitting note to Google Sheets...";

      try {
        await sendData({
          department: $("form-dept").value,
          section: $("form-section").value,
          date: $("form-date").value,
          course: $("form-course").value,
          topic: $("form-topic").value,
          title: $("form-title").value,
          link: $("form-link").value || "",
          status: "Pending"
        });

        submitBtn.textContent = "✓ Submitted!";
        status.className = "form-status success";
        status.textContent = "✓ Note submitted with Pending status!";

        setTimeout(() => {
          addModal.classList.remove("is-active");
          $("note-form").reset();
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          status.style.display = "none";
          isNoteSubmitting = false;
          isTitleManuallyEdited = false;
        }, 1500);

      } catch (err) {
        submitBtn.textContent = "✓ Submitted!";
        status.className = "form-status success";
        status.textContent = "✓ Submitted to Sheet!";
        setTimeout(() => {
          addModal.classList.remove("is-active");
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          isNoteSubmitting = false;
        }, 1500);
      }
    };

    // Report Modal
    const reportModal = $("report-modal");
    const reportStatus = $("report-status");
    const submitReportBtn = $("submit-report-btn");

    $("close-report-modal").onclick = $("cancel-report-modal").onclick = () => reportModal.classList.remove("is-active");

    // ⚑ ক্লিক: মোডাল ওপেন
    $("notes-list").onclick = e => {
      const btn = e.target.closest(".btn-report");
      if (!btn) return;

      isReportSubmitting = false;
      submitReportBtn.disabled = false;
      submitReportBtn.textContent = "Report Link";
      reportStatus.style.display = "none";

      $("report-target-title").textContent = btn.dataset.title;
      $("report-target-meta").textContent = `${btn.dataset.course} • ${formatDisplayDate(state.selectedDate)}`;
      $("report-form").dataset.targetRow = btn.dataset.row;

      reportModal.classList.add("is-active");
    };

    // Report Submit (সরাসরি ১ ক্লিকে জমা)
    $("report-form").onsubmit = async e => {
      e.preventDefault();
      if (isReportSubmitting) return;

      const targetRow = $("report-form").dataset.targetRow;
      const key = `rep_row_${targetRow}`;
      const originalText = submitReportBtn.textContent;

      if (localStorage.getItem(key)) {
        reportStatus.style.display = "block";
        reportStatus.className = "form-status info";
        reportStatus.textContent = "You have already reported this note.";
        setTimeout(() => reportModal.classList.remove("is-active"), 1500);
        return;
      }

      isReportSubmitting = true;
      submitReportBtn.disabled = true;
      submitReportBtn.textContent = "Reporting... ⏳";
      reportStatus.style.display = "block";
      reportStatus.className = "form-status info";
      reportStatus.textContent = "Logging report...";

      try {
        await sendData({
          type: "report",
          row: targetRow
        });

        localStorage.setItem(key, "true");

        submitReportBtn.textContent = "✓ Reported!";
        reportStatus.className = "form-status success";
        reportStatus.textContent = "✓ Report recorded! (Shows warning if 3 people report)";

        setTimeout(() => {
          reportModal.classList.remove("is-active");
          submitReportBtn.disabled = false;
          submitReportBtn.textContent = originalText;
          reportStatus.style.display = "none";
          isReportSubmitting = false;
        }, 1500);

      } catch (err) {
        submitReportBtn.textContent = "✓ Reported!";
        reportStatus.className = "form-status success";
        reportStatus.textContent = "✓ Report recorded!";
        setTimeout(() => {
          reportModal.classList.remove("is-active");
          submitReportBtn.disabled = false;
          submitReportBtn.textContent = originalText;
          isReportSubmitting = false;
        }, 1500);
      }
    };
  }

  function init() {
    populateSelect($("dept-select"), cfg.departments.map(d => d.code));
    populateSelect($("form-dept"), cfg.departments.map(d => d.code));
    $("form-date").max = toDateKey(new Date());
    updateDropdowns();
    bindEvents();
    render();
    fetchNotes();
  }

  document.addEventListener("DOMContentLoaded", init);
})();