/**
 * ClassNotes - Google Apps Script Backend
 * Deploy as: Web App (Execute as: Me, Who has access: Anyone)
 */

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Notes") || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return jsonResponse({ success: true, count: 0, notes: [] });
    }

    const headers = data[0].map(h => String(h).trim().toLowerCase());

    const findCol = names => headers.findIndex(h => names.some(n => h.includes(n)));
    const deptIdx   = findCol(["dept", "department"]);
    const secIdx    = findCol(["sec", "section"]);
    const dateIdx   = findCol(["date"]);
    const courseIdx = findCol(["course"]);
    const topicIdx  = findCol(["topic"]);
    const titleIdx  = findCol(["title"]);
    const linkIdx   = findCol(["link", "url"]);
    const statusIdx = findCol(["status"]);

    const tz = ss.getSpreadsheetTimeZone() || "GMT+6";
    const notes = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = String(row[statusIdx] || "").trim();

      // Only return notes that are marked "Approved"
      if (status.toLowerCase() === "approved") {
        let rawDate = row[dateIdx];
        let dateStr = "";

        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            dateStr = Utilities.formatDate(d, tz, "yyyy-MM-dd");
          } else {
            dateStr = String(rawDate).trim();
          }
        }

        notes.push({
          department: String(row[deptIdx] || "").trim(),
          section:    String(row[secIdx] || "").trim(),
          date:       dateStr,
          course:     String(row[courseIdx] || "").trim(),
          topic:      String(row[topicIdx] || "").trim(),
          title:      String(row[titleIdx] || "").trim(),
          link:       String(row[linkIdx] || "").trim(),
          status:     "Approved"
        });
      }
    }

    return jsonResponse({ success: true, count: notes.length, notes: notes });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    let payload = null;
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter;
      }
    } else if (e.parameter) {
      payload = e.parameter;
    }

    if (!payload || !payload.department || !payload.section || !payload.date || !payload.course || !payload.topic || !payload.title) {
      return jsonResponse({ success: false, error: "Missing required fields" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Notes") || ss.getActiveSheet();

    // Appends: Department, Section, Date, Course, Topic, Title, Link, Status, SubmittedAt
    sheet.appendRow([
      String(payload.department).trim(),
      String(payload.section).trim(),
      String(payload.date).trim(),
      String(payload.course).trim(),
      String(payload.topic).trim(),
      String(payload.title).trim(),
      String(payload.link || "").trim(),
      "Pending",
      new Date()
    ]);

    return jsonResponse({ success: true, message: "Note submitted successfully with Pending status." });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}