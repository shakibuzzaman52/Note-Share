/**
 * ClassNotes — Clean Application Logic with Smart Auto-increment Title
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
  const SHORT_MONTHS = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
  };

  // State
  const now = new Date();
  const state = {
    dept: cfg.departments[0]?.code || "CSE",
    sec: cfg.departments[0]?.sections[0] || "73_L",
    viewDate: new Date(now.getFullYear(), now.getMonth(), 1),
    selectedDate: toDateKey(now),
    notes: []
  };

  // ব্যবহারকারী নিজে টাইটেল এডিট করেছে কিনা ট্র্যাক করার ফ্ল্যাগ
  let isTitleManuallyEdited = false;

  const $ = id => document.getElementById(id);

  // Helper: Format date as YYYY-MM-DD
  function toDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Helper: Normalize sheet date string to YYYY-MM-DD
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

  function populateSelect(selectEl, items) {
    selectEl.innerHTML = items.map(item => `<option value="${item}">${item}</option>`).join("");
  }

  function updateDropdowns() {
    const activeDept = cfg.departments.find(d => d.code === state.dept) || cfg.departments[0];
    if (!activeDept) return;

    populateSelect($("section-select"), activeDept.sections);
    populateSelect($("form-section"), activeDept.sections);
    populateSelect($("form-course"), activeDept.courses);

    $("dept-select").value = state.dept;
    if (activeDept.sections.includes(state.sec)) {
      $("section-select").value = state.sec;
    } else {
      state.sec = activeDept.sections[0] || "";
      $("section-select").value = state.sec;
    }

    $("current-class-badge").textContent = `${state.dept} • Section ${state.sec}`;
  }

  function updateFormCourses() {
    const selectedDeptCode = $("form-dept").value;
    const deptObj = cfg.departments.find(d => d.code === selectedDeptCode);
    if (deptObj) {
      populateSelect($("form-section"), deptObj.sections);
      populateSelect($("form-course"), deptObj.courses);
    }
  }

  // -------------------------------------------------------------
  // অটো-ইনক্রিমেন্ট টাইটেল লজিক (Note 1, Note 2, etc.)
  // -------------------------------------------------------------
  function updateDefaultTitle() {
    // যদি ব্যবহারকারী নিজে টাইটেল লিখে থাকে, তাহলে পরিবর্তন করবে না
    if (isTitleManuallyEdited) return;

    const dept = $("form-dept").value || state.dept;
    const sec = $("form-section").value || state.sec;
    const date = $("form-date").value || state.selectedDate;
    const course = $("form-course").value;

    // নির্বাচিত তারিখ, ডিপার্টমেন্ট, সেকশন এবং কোর্সের বিদ্যমান নোট সংখ্যা গণনা
    const count = state.notes.filter(n =>
      n.department.toLowerCase() === dept.toLowerCase() &&
      n.section.toLowerCase() === sec.toLowerCase() &&
      n.date === date &&
      (!course || n.course.toLowerCase() === course.toLowerCase())
    ).length;

    // পরবর্তী ক্রমিক সংখ্যা বসিয়ে দেওয়া (Note 1, Note 2, Note 3...)
    $("form-title").value = `Note ${count + 1}`;
  }

  function getFilteredNotes() {
    return state.notes.filter(n =>
      n.department.toLowerCase() === state.dept.toLowerCase() &&
      n.section.toLowerCase() === state.sec.toLowerCase() &&
      n.status.toLowerCase() === "approved"
    );
  }

  // Render Calendar
  function renderCalendar() {
    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();
    $("calendar-month-year").textContent = `${MONTH_NAMES[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const noteDates = new Set(getFilteredNotes().map(n => n.date));

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

  // Render Notes
  function renderNotes() {
    $("selected-date-display").textContent = formatDisplayDate(state.selectedDate);
    const dayNotes = getFilteredNotes().filter(n => n.date === state.selectedDate);
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

  function render() {
    $("current-class-badge").textContent = `${state.dept} • Section ${state.sec}`;
    renderCalendar();
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

        const matches = getFilteredNotes();
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
    // Dept & Section Change
    $("dept-select").onchange = e => {
      state.dept = e.target.value;
      updateDropdowns();
      state.sec = $("section-select").value;
      render();
    };

    $("section-select").onchange = e => {
      state.sec = e.target.value;
      render();
    };

    // Calendar Navigation
    $("cal-prev").onclick = () => {
      state.viewDate.setMonth(state.viewDate.getMonth() - 1);
      renderCalendar();
    };

    $("cal-next").onclick = () => {
      state.viewDate.setMonth(state.viewDate.getMonth() + 1);
      renderCalendar();
    };

    $("cal-today").onclick = () => {
      const current = new Date();
      state.viewDate = new Date(current.getFullYear(), current.getMonth(), 1);
      state.selectedDate = toDateKey(current);
      render();
    };

    // Calendar Grid Click
    $("calendar-grid").onclick = e => {
      const btn = e.target.closest(".cal-day[data-date]");
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
      // মোডাল খোলার সময় এডিট ফ্ল্যাগ রিসেট
      isTitleManuallyEdited = false;

      $("form-dept").value = state.dept;
      updateFormCourses();
      $("form-section").value = state.sec;
      $("form-date").value = state.selectedDate;

      // ডিফল্ট টাইটেল তৈরি (Note 1 / Note 2...)
      updateDefaultTitle();

      statusMsg.className = "form-status";
      statusMsg.style.display = "none";
      modal.classList.add("is-active");
    };

    const closeModal = () => modal.classList.remove("is-active");
    $("close-modal").onclick = closeModal;
    $("cancel-modal").onclick = closeModal;

    // ফর্মের ফিল্ড পরিবর্তনের সাথে সাথে টাইটেল সংখ্যা রি-ক্যালকুলেট
    $("form-dept").onchange = () => {
      updateFormCourses();
      updateDefaultTitle();
    };
    $("form-section").onchange = updateDefaultTitle;
    $("form-date").onchange = updateDefaultTitle;
    $("form-course").onchange = updateDefaultTitle;

    // ব্যবহারকারী নিজে টাইটেল বক্সে লিখলে তা চিহ্নিত রাখা
    $("form-title").oninput = () => {
      // বক্স খালি না থাকলে ইউজার-এডিটেড হিসেবে গণ্য হবে
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

  // Initialization
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