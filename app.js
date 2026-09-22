(function () {
  "use strict";

  // load config
  const cfg = window.APP_CONFIG || { googleAppsScriptUrl: "", departments: [] };
  const API_URL = cfg.googleAppsScriptUrl;

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // state
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

  // dom helper
  const $ = id => document.getElementById(id);

  // date helpers
  function toDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatDisplayDate(dateKey) {
    if (!dateKey) return "";
    const [y, m, d] = dateKey.split("-");
    return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
  }

  // send data to google sheet
  async function sendData(payload) {
    return fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  }

  // select helpers
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
      ? `[ ${state.dept} | Section: ${state.sec} ]` 
      : `[ ${state.dept} | Sec: ${state.sec} | Course: ${state.course} ]`;
  }

  // auto fill note title
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

  // get filtered notes
  function getSectionApprovedNotes() {
    return state.notes.filter(n =>
      n.department === state.dept &&
      n.section === state.sec &&
      (n.status || "").toLowerCase() === "approved"
    );
  }

  // render monthly calendar
  function renderFullCalendar() {
    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();
    $("calendar-month-year").textContent = `${MONTHS[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const noteDates = new Set(getSectionApprovedNotes().map(n => n.date));
    const todayKey = toDateKey(new Date());

    let html = "<tr>";
    let dayCol = 0;

    for (let i = 0; i < firstDay; i++) {
      html += "<td></td>";
      dayCol++;
    }

    for (let d = 1; d <= totalDays; d++) {
      if (dayCol === 7) {
        html += "</tr><tr>";
        dayCol = 0;
      }

      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isFuture = dateKey > todayKey;
      const isSelected = dateKey === state.selectedDate;
      const hasNotes = noteDates.has(dateKey);

      html += `
        <td>
          <button type="button" class="cal-day" data-date="${dateKey}" ${isFuture ? "disabled" : ""}>
            ${isSelected ? `[${d}]` : d} ${hasNotes ? "•" : ""}
          </button>
        </td>
      `;
      dayCol++;
    }

    while (dayCol < 7 && dayCol > 0) {
      html += "<td></td>";
      dayCol++;
    }
    html += "</tr>";

    $("calendar-grid").innerHTML = html;
  }

  // render dates for specific course
  function renderCourseDatesView() {
    const courseNotes = getSectionApprovedNotes().filter(n => n.course === state.course);
    const uniqueDates = [...new Set(courseNotes.map(n => n.date))].sort();

    $("course-dates-title").textContent = `Classes: ${state.course}`;
    $("course-dates-count").textContent = `(${uniqueDates.length} dates found)`;

    const container = $("course-dates-list");
    if (!uniqueDates.length) {
      container.innerHTML = `<p>No notes for ${state.course} yet.</p>`;
      return;
    }

    if (!uniqueDates.includes(state.selectedDate)) {
      state.selectedDate = uniqueDates[uniqueDates.length - 1];
    }

    container.innerHTML = uniqueDates.map(dateStr => {
      const d = new Date(dateStr + "T00:00:00");
      const count = courseNotes.filter(n => n.date === dateStr).length;
      const isSelected = dateStr === state.selectedDate;

      return `
        <div>
          <button type="button" class="course-date-btn" data-date="${dateStr}">
            ${isSelected ? ">> " : ""}${formatDisplayDate(dateStr)} (${DAYS[d.getDay()] || ""}) - ${count} note(s)
          </button>
        </div>
      `;
    }).join("");
  }

  // render notes list inside modal
  function renderNotes() {
    $("selected-date-display").textContent = `Date: ${formatDisplayDate(state.selectedDate)}`;

    let dayNotes = getSectionApprovedNotes().filter(n => n.date === state.selectedDate);
    if (state.course !== "ALL") {
      dayNotes = dayNotes.filter(n => n.course === state.course);
    }

    $("notes-count").textContent = `Total: ${dayNotes.length} notes`;
    const container = $("notes-list");

    if (!dayNotes.length) {
      container.innerHTML = "<p>No notes for this date.</p>";
      return;
    }

    const grouped = {};
    dayNotes.forEach(n => {
      const c = n.course || "General";
      const t = n.topic || "Class Notes";
      if (!grouped[c]) grouped[c] = {};
      if (!grouped[c][t]) grouped[c][t] = [];
      grouped[c][t].push(n);
    });

    let html = "";
    for (const course in grouped) {
      html += `<fieldset><legend><strong>${course}</strong></legend>`;
      for (const topic in grouped[course]) {
        html += `<h4>Topic: ${topic}</h4><ul>`;
        grouped[course][topic].forEach(item => {
          const isReported = Number(item.reportCount || 0) >= 3;
          const title = item.title || "View Note";
          const link = item.link || "";

          html += `
            <li>
              ${link ? `<a href="${link}" target="_blank" rel="noopener">${title}</a>` : title}
              ${isReported ? "<strong>[Issue Reported]</strong>" : ""}
              ${link ? `<button type="button" class="btn-report" data-row="${item.row}" data-title="${title}" data-course="${course}">Report</button>` : ""}
            </li>
          `;
        });
        html += "</ul>";
      }
      html += "</fieldset>";
    }
    container.innerHTML = html;
  }

  // main render
  function render() {
    updateClassBadge();
    const isAll = state.course === "ALL";

    $("full-calendar-view").hidden = !isAll;
    $("course-dates-view").hidden = isAll;

    if (isAll) renderFullCalendar();
    else renderCourseDatesView();

    renderNotes();
  }

  // fetch notes from sheet
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
      console.warn("fetch error:", e);
    }
  }

  // bind user actions
  function bindEvents() {
    const notesModal = $("notes-modal");

    // Close notes modal button
    $("close-notes-modal").onclick = () => {
      notesModal.close();
    };

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
      const d = new Date();
      state.viewDate = new Date(d.getFullYear(), d.getMonth(), 1);
      state.selectedDate = toDateKey(d);
      render();
    };

    // ক্যালেন্ডারের ডেট বাটনে ক্লিক করলে পপআপ মোডালটি ওপেন হবে
    $("calendar-grid").onclick = e => {
      const btn = e.target.closest(".cal-day[data-date]:not(:disabled)");
      if (btn) {
        state.selectedDate = btn.dataset.date;
        render();
        if (!notesModal.open) {
          notesModal.showModal();
        }
      }
    };

    // কোর্স ডেটস লিস্টে ক্লিক করলে পপআপ মোডালটি ওপেন হবে
    $("course-dates-list").onclick = e => {
      const btn = e.target.closest(".course-date-btn[data-date]");
      if (btn) {
        state.selectedDate = btn.dataset.date;
        render();
        if (!notesModal.open) {
          notesModal.showModal();
        }
      }
    };

    // add note dialog
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
      $("form-status").hidden = true;
      addModal.showModal();
    };

    $("cancel-modal").onclick = () => addModal.close();
    $("form-dept").onchange = () => { updateFormCourses(); updateDefaultTitle(); };
    $("form-section").onchange = $("form-date").onchange = $("form-course").onchange = updateDefaultTitle;
    $("form-title").oninput = () => { isTitleManuallyEdited = $("form-title").value.trim().length > 0; };

    // submit new note
    $("note-form").onsubmit = async e => {
      e.preventDefault();
      if (isNoteSubmitting) return;
      isNoteSubmitting = true;

      const submitBtn = $("submit-btn");
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting...";

      const status = $("form-status");
      status.hidden = false;
      status.textContent = "Submitting note...";

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

        status.textContent = "Submitted successfully!";
        setTimeout(() => {
          addModal.close();
          $("note-form").reset();
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          status.hidden = true;
          isNoteSubmitting = false;
          isTitleManuallyEdited = false;
        }, 1200);

      } catch (err) {
        status.textContent = "Submission failed.";
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        isNoteSubmitting = false;
      }
    };

    // report note dialog
    const reportModal = $("report-modal");
    const reportStatus = $("report-status");
    const submitReportBtn = $("submit-report-btn");

    $("cancel-report-modal").onclick = () => reportModal.close();

    $("notes-list").onclick = e => {
      const btn = e.target.closest(".btn-report");
      if (!btn) return;

      isReportSubmitting = false;
      submitReportBtn.disabled = false;
      submitReportBtn.textContent = "Report Link";
      reportStatus.hidden = true;

      $("report-target-title").textContent = btn.dataset.title;
      $("report-target-meta").textContent = `${btn.dataset.course} • ${formatDisplayDate(state.selectedDate)}`;
      $("report-form").dataset.targetRow = btn.dataset.row;

      reportModal.showModal();
    };

    // submit report
    $("report-form").onsubmit = async e => {
      e.preventDefault();
      if (isReportSubmitting) return;

      const targetRow = $("report-form").dataset.targetRow;
      const key = `rep_row_${targetRow}`;
      const originalText = submitReportBtn.textContent;

      if (localStorage.getItem(key)) {
        reportStatus.hidden = false;
        reportStatus.textContent = "You have already reported this note.";
        setTimeout(() => reportModal.close(), 1200);
        return;
      }

      isReportSubmitting = true;
      submitReportBtn.disabled = true;
      submitReportBtn.textContent = "Reporting...";
      reportStatus.hidden = false;
      reportStatus.textContent = "Sending report...";

      try {
        await sendData({
          type: "report",
          row: targetRow
        });

        localStorage.setItem(key, "true");
        reportStatus.textContent = "Report recorded!";

        setTimeout(() => {
          reportModal.close();
          submitReportBtn.disabled = false;
          submitReportBtn.textContent = originalText;
          reportStatus.hidden = true;
          isReportSubmitting = false;
        }, 1200);

      } catch (err) {
        reportStatus.textContent = "Report failed.";
        submitReportBtn.disabled = false;
        submitReportBtn.textContent = originalText;
        isReportSubmitting = false;
      }
    };
  }

  // init
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