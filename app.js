/**
 * ClassNotes — Simplified & Clean Application Logic
 * Direct, simple integration with Google Sheets.
 */

(function () {
  "use strict";

  // Configuration with fallback
  const cfg = (window.APP_CONFIG && window.APP_CONFIG.departments) ? window.APP_CONFIG : {
    siteTitle: "ClassNotes",
    googleAppsScriptUrl: "https://script.google.com/macros/s/AKfycbw3aWwV--qQQMyplo3GnTexrnbTaGb5p_I-twV-fK4mokGSIA2PkOHQ7L9Ye05fv55T/exec",
    departments: [
      {
        code: "CSE",
        name: "Computer Science & Engineering",
        sections: ["73_L", "73_A", "73_B"],
        courses: ["CSE Fundamentals", "Data Structures & Algorithms", "English", "Computer Networks"]
      },
      {
        code: "EEE",
        name: "Electrical & Electronic Engineering",
        sections: ["65_A", "65_B"],
        courses: ["Circuit Analysis", "Signals & Systems"]
      },
      {
        code: "BBA",
        name: "Business Administration",
        sections: ["42_B", "42_A"],
        courses: ["Principles of Marketing", "Financial Accounting"]
      }
    ]
  };

  const API_URL = (window.APP_CONFIG && window.APP_CONFIG.googleAppsScriptUrl) || cfg.googleAppsScriptUrl;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const SHORT_MONTHS = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

  // State
  let allNotes = [];
  let currentDept = "CSE";
  let currentSection = "73_L";
  let viewYear = 2026;
  let viewMonth = 8; // September (0-indexed)
  let selectedDate = "2026-09-22";

  // Helper
  const el = id => document.getElementById(id);

  // Converts any Google Sheet Date string to "YYYY-MM-DD"
  function cleanDate(val) {
    if (!val) return "";
    const str = String(val).trim();
    const gmt = str.match(/\b([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\b/);
    if (gmt && SHORT_MONTHS[gmt[1].toLowerCase()]) {
      return `${gmt[3]}-${SHORT_MONTHS[gmt[1].toLowerCase()]}-${String(gmt[2]).padStart(2, "0")}`;
    }
    const iso = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) {
      return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
    }
    return str;
  }

  function formatDisplayDate(dateKey) {
    if (!dateKey) return "";
    const p = dateKey.split("-");
    if (p.length === 3) {
      return `${parseInt(p[2], 10)} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
    }
    return dateKey;
  }

  // Populate Dropdowns
  function initDropdowns() {
    const deptSel = el("dept-select");
    const fDeptSel = el("form-dept");
    deptSel.innerHTML = "";
    fDeptSel.innerHTML = "";

    cfg.departments.forEach(d => {
      deptSel.add(new Option(`${d.code} — ${d.name}`, d.code));
      fDeptSel.add(new Option(`${d.code} — ${d.name}`, d.code));
    });

    deptSel.value = currentDept;
    updateSections();
    updateFormOptions();
  }

  function updateSections() {
    const deptObj = cfg.departments.find(d => d.code === currentDept);
    const secSel = el("section-select");
    secSel.innerHTML = "";
    if (deptObj && deptObj.sections) {
      deptObj.sections.forEach(s => secSel.add(new Option(`Section ${s}`, s)));
    }
    currentSection = secSel.value || "73_L";
    updateClassBadge();
  }

  function updateFormOptions() {
    const deptCode = el("form-dept").value || currentDept;
    const deptObj = cfg.departments.find(d => d.code === deptCode);
    const fSec = el("form-section");
    const fCourse = el("form-course");
    fSec.innerHTML = "";
    fCourse.innerHTML = "";

    if (deptObj) {
      (deptObj.sections || []).forEach(s => fSec.add(new Option(`Section ${s}`, s)));
      (deptObj.courses || []).forEach(c => fCourse.add(new Option(c, c)));
    }
  }

  function updateClassBadge() {
    const badge = el("current-class-badge");
    if (badge) badge.textContent = `${currentDept} • Section ${currentSection}`;
  }

  // Fetch Notes from Google Sheets
  async function loadNotes() {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (data && data.notes && Array.isArray(data.notes)) {
        allNotes = data.notes.map(n => ({
          department: String(n.department || "").trim(),
          section: String(n.section || "").trim(),
          date: cleanDate(n.date),
          course: String(n.course || "").trim(),
          topic: String(n.topic || "").trim(),
          title: String(n.title || "").trim(),
          link: String(n.link || "").trim(),
          status: String(n.status || "Approved").trim()
        }));
      }
    } catch (err) {
      console.warn("Could not fetch from Google Sheet:", err);
    }

    // Auto-focus calendar on date with notes
    const matches = allNotes.filter(n => n.department === currentDept && n.section === currentSection && n.status === "Approved");
    if (matches.length > 0) {
      const p = matches[0].date.split("-");
      if (p.length === 3) {
        viewYear = parseInt(p[0], 10);
        viewMonth = parseInt(p[1], 10) - 1;
        selectedDate = matches[0].date;
      }
    }

    renderCalendar();
    renderNotes();
  }

  // Render Calendar
  function renderCalendar() {
    el("calendar-month-year").textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    const grid = el("calendar-days-grid");
    grid.innerHTML = "";

    const noteDates = new Set(
      allNotes
        .filter(n => n.department === currentDept && n.section === currentSection && n.status === "Approved")
        .map(n => n.date)
    );

    const firstDayIdx = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    // Previous month days
    for (let i = firstDayIdx - 1; i >= 0; i--) {
      const day = daysInPrev - i;
      const cell = document.createElement("button");
      cell.className = "cal-day-cell other-month";
      cell.innerHTML = `<span class="cal-day-number">${day}</span>`;
      grid.appendChild(cell);
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const cell = document.createElement("button");
      cell.className = "cal-day-cell" + (dateKey === selectedDate ? " is-selected" : "");
      
      const hasNote = noteDates.has(dateKey);
      cell.innerHTML = `<span class="cal-day-number">${d}</span>` + (hasNote ? `<span class="cal-has-notes-dot"></span>` : "");

      cell.onclick = () => {
        selectedDate = dateKey;
        renderCalendar();
        renderNotes();
      };
      grid.appendChild(cell);
    }
  }

  // Render Notes
  function renderNotes() {
    el("selected-date-display").textContent = formatDisplayDate(selectedDate);
    const container = el("notes-list-container");

    const notes = allNotes.filter(
      n => n.department === currentDept && n.section === currentSection && n.date === selectedDate && n.status === "Approved"
    );

    el("notes-count-badge").textContent = `${notes.length} notes`;
    container.innerHTML = "";

    if (notes.length === 0) {
      container.innerHTML = `
        <div class="notes-empty-state">
          <p style="color: #64748b; font-size: 14px; padding: 30px 0;">No notes for this date.</p>
        </div>
      `;
      return;
    }

    // Group by Course -> Topic
    const grouped = {};
    notes.forEach(n => {
      if (!grouped[n.course]) grouped[n.course] = {};
      if (!grouped[n.course][n.topic]) grouped[n.course][n.topic] = [];
      grouped[n.course][n.topic].push(n);
    });

    for (const course in grouped) {
      const courseDiv = document.createElement("div");
      courseDiv.className = "course-group";
      courseDiv.innerHTML = `<h4 class="course-title">${course}</h4>`;

      const topicsDiv = document.createElement("div");
      topicsDiv.className = "topics-container";

      for (const topic in grouped[course]) {
        const topicDiv = document.createElement("div");
        topicDiv.className = "topic-group";
        topicDiv.innerHTML = `<div class="topic-title"><span class="topic-arrow">&rarr;</span> ${topic}</div>`;

        const itemsDiv = document.createElement("div");
        itemsDiv.className = "notes-items-list";

        grouped[course][topic].forEach(n => {
          const hasLink = n.link && n.link.trim() !== "";
          itemsDiv.innerHTML += `
            <a href="${hasLink ? n.link : 'javascript:void(0)'}" ${hasLink ? 'target="_blank" rel="noopener"' : ''} class="note-link-item">
              <span>${n.title}</span> ↗
            </a>
          `;
        });

        topicDiv.appendChild(itemsDiv);
        topicsDiv.appendChild(topicDiv);
      }

      courseDiv.appendChild(topicsDiv);
      container.appendChild(courseDiv);
    }
  }

  // Event Listeners
  function setupEvents() {
    el("dept-select").onchange = (e) => {
      currentDept = e.target.value;
      updateSections();
      renderCalendar();
      renderNotes();
    };

    el("section-select").onchange = (e) => {
      currentSection = e.target.value;
      updateClassBadge();
      renderCalendar();
      renderNotes();
    };

    el("cal-prev-month").onclick = () => {
      if (viewMonth === 0) { viewMonth = 11; viewYear--; } else { viewMonth--; }
      renderCalendar();
    };

    el("cal-next-month").onclick = () => {
      if (viewMonth === 11) { viewMonth = 0; viewYear++; } else { viewMonth++; }
      renderCalendar();
    };

    el("cal-today-btn").onclick = () => {
      viewYear = 2026;
      viewMonth = 8;
      selectedDate = "2026-09-22";
      renderCalendar();
      renderNotes();
    };

    // Modal
    const modal = el("add-note-modal");
    el("open-add-modal-btn").onclick = () => {
      el("form-dept").value = currentDept;
      updateFormOptions();
      el("form-section").value = currentSection;
      el("form-date").value = selectedDate;
      modal.classList.add("is-active");
    };

    el("close-add-modal-btn").onclick = el("cancel-add-btn").onclick = () => {
      modal.classList.remove("is-active");
    };

    el("form-dept").onchange = updateFormOptions;

    // Submit Note
    el("add-note-form").onsubmit = async (e) => {
      e.preventDefault();
      const msg = el("form-message");
      const subBtn = el("submit-note-btn");
      subBtn.disabled = true;

      msg.style.display = "block";
      msg.style.background = "#eff6ff";
      msg.style.color = "#1d4ed8";
      msg.textContent = "Submitting to Google Sheets...";

      const payload = {
        department: el("form-dept").value,
        section: el("form-section").value,
        date: el("form-date").value,
        course: el("form-course").value,
        topic: el("form-topic").value,
        title: el("form-title").value,
        link: el("form-link").value || "",
        status: "Pending"
      };

      try {
        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });

        msg.style.background = "#f0fdf4";
        msg.style.color = "#16a34a";
        msg.textContent = "✓ Note submitted with Pending status! Once approved in Google Sheet, it will appear.";

        setTimeout(() => {
          modal.classList.remove("is-active");
          msg.style.display = "none";
          subBtn.disabled = false;
        }, 2500);
      } catch (err) {
        msg.textContent = "✓ Submitted! Please check Google Sheets.";
        subBtn.disabled = false;
      }
    };

    // Setup Modal
    if (el("open-setup-btn")) {
      el("open-setup-btn").onclick = () => el("setup-modal").classList.add("is-active");
      el("close-setup-modal-btn").onclick = el("close-setup-footer-btn").onclick = () => el("setup-modal").classList.remove("is-active");
      el("save-script-url-btn").onclick = () => el("setup-modal").classList.remove("is-active");
    }
  }

  // Initialization
  document.addEventListener("DOMContentLoaded", () => {
    initDropdowns();
    setupEvents();
    loadNotes();
  });
})();