/**
 * ClassNotes — Ultra Simple Row-Based Backend (Code.gs)
 */

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Notes") || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return jsonResponse({ success: true, count: 0, notes: [] });

    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const findCol = names => headers.findIndex(h => names.some(n => h.includes(n)));

    const deptIdx   = findCol(["dept", "depart"]);
    const secIdx    = findCol(["sec"]);
    const dateIdx   = findCol(["date"]);
    const courseIdx = findCol(["course"]);
    const topicIdx  = findCol(["topic"]);
    const titleIdx  = findCol(["title"]);
    const linkIdx   = findCol(["link", "url", "drive"]);
    const statusIdx = findCol(["status"]);
    const reportIdx = findCol(["report"]);

    const tz = ss.getSpreadsheetTimeZone() || "GMT+6";
    const notes = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = String(row[statusIdx] || "").trim().toLowerCase();

      if (status === "approved") {
        let rawDate = row[dateIdx];
        let dateStr = "";

        if (rawDate) {
          const d = new Date(rawDate);
          dateStr = !isNaN(d.getTime()) ? Utilities.formatDate(d, tz, "yyyy-MM-dd") : String(rawDate).trim();
        }

        notes.push({
          row:         i + 1, // শিটের হুবহু লাইন নম্বর (Row ID)
          department:  deptIdx !== -1 ? String(row[deptIdx] || "").trim() : "",
          section:     secIdx !== -1 ? String(row[secIdx] || "").trim() : "",
          date:        dateStr,
          course:      courseIdx !== -1 ? String(row[courseIdx] || "").trim() : "",
          topic:       topicIdx !== -1 ? String(row[topicIdx] || "").trim() : "",
          title:       titleIdx !== -1 ? String(row[titleIdx] || "").trim() : "",
          link:        linkIdx !== -1 ? String(row[linkIdx] || "").trim() : "",
          status:      "Approved",
          reportCount: reportIdx !== -1 ? Number(row[reportIdx] || 0) : 0
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
    try {
      payload = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : e.parameter;
    } catch(p) {
      payload = e.parameter;
    }

    if (!payload) return jsonResponse({ success: false, error: "Empty payload" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Notes") || ss.getActiveSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
    
    let reportIdx = headers.findIndex(h => h.includes("report"));
    if (reportIdx === -1) {
      sheet.getRange(1, headers.length + 1).setValue("ReportCount");
      reportIdx = headers.length;
    }

    // ১. অতি সহজ রিপোর্ট: সরাসরি লাইন নম্বরে গিয়ে ১ বাড়িয়ে দেওয়া
    if (payload.type === "report") {
      const rowNum = Number(payload.row);
      if (rowNum >= 2 && rowNum <= sheet.getLastRow()) {
        const cell = sheet.getRange(rowNum, reportIdx + 1);
        const currentCount = Number(cell.getValue() || 0);
        cell.setValue(currentCount + 1);
        return jsonResponse({ success: true, count: currentCount + 1 });
      }
      return jsonResponse({ success: false, error: "Invalid row" });
    }

    // ২. নতুন নোট সাবমিশন
    if (!payload.department || !payload.section || !payload.date || !payload.course || !payload.title) {
      return jsonResponse({ success: false, error: "Missing fields" });
    }

    sheet.appendRow([
      String(payload.department).trim(),
      String(payload.section).trim(),
      String(payload.date).trim(),
      String(payload.course).trim(),
      String(payload.topic || "").trim(),
      String(payload.title).trim(),
      String(payload.link || "").trim(),
      "Pending",
      0, // শুরুতে ReportCount = 0
      new Date()
    ]);

    return jsonResponse({ success: true, message: "Note submitted with Pending status." });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}