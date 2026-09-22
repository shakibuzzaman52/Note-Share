/**
 * ClassNotes - Google Apps Script Backend (Google Sheets)
 * 
 * Column Structure in Google Sheet ("Notes" tab):
 * Col A: Department
 * Col B: Section
 * Col C: Date
 * Col D: Course Name
 * Col E: Topic Name
 * Col F: Note Title
 * Col G: Note Link
 * Col H: Status (Pending, Approved, Rejected)
 * Col I: Submitted At
 */

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Notes") || ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return jsonResponse({ success: true, notes: [] });
    }

    const headers = data[0].map(function(h) {
      return String(h).trim().toLowerCase();
    });

    const deptIdx = headers.indexOf("department");
    const secIdx = headers.indexOf("section");
    const dateIdx = headers.indexOf("date");
    const courseIdx = headers.indexOf("course name");
    const topicIdx = headers.indexOf("topic name");
    const titleIdx = headers.indexOf("note title");
    const linkIdx = headers.indexOf("note link");
    const statusIdx = headers.indexOf("status");

    const notes = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = String(row[statusIdx] || "").trim();

      // Core Requirement: ONLY Approved notes appear publicly
      if (status.toLowerCase() === "approved") {
        let dateVal = row[dateIdx];
        let dateStr = "";

        if (dateVal instanceof Date) {
          const y = dateVal.getFullYear();
          const m = String(dateVal.getMonth() + 1).padStart(2, "0");
          const d = String(dateVal.getDate()).padStart(2, "0");
          dateStr = y + "-" + m + "-" + d;
        } else {
          dateStr = String(dateVal).trim();
        }

        notes.push({
          department: String(row[deptIdx] || "").trim(),
          section: String(row[secIdx] || "").trim(),
          date: dateStr,
          course: String(row[courseIdx] || "").trim(),
          topic: String(row[topicIdx] || "").trim(),
          title: String(row[titleIdx] || "").trim(),
          link: String(row[linkIdx] || "").trim(),
          status: "Approved"
        });
      }
    }

    return jsonResponse({
      success: true,
      count: notes.length,
      notes: notes
    });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function doPost(e) {
  try {
    let payload = null;

    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter;
      }
    } else if (e.parameter) {
      payload = e.parameter;
    }

    if (!payload) {
      return jsonResponse({ success: false, error: "No payload received" });
    }

    const department = String(payload.department || "").trim();
    const section = String(payload.section || "").trim();
    const date = String(payload.date || "").trim();
    const course = String(payload.course || "").trim();
    const topic = String(payload.topic || "").trim();
    const title = String(payload.title || "").trim();
    const link = String(payload.link || "").trim();

    if (!department || !section || !date || !course || !topic || !title || !link) {
      return jsonResponse({
        success: false,
        error: "All fields are required."
      });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Notes") || ss.getActiveSheet();

    // Core Requirement: New submissions are ALWAYS set to 'Pending' status
    const status = "Pending";
    const timestamp = new Date();

    sheet.appendRow([
      department,
      section,
      date,
      course,
      topic,
      title,
      link,
      status,
      timestamp
    ]);

    return jsonResponse({
      success: true,
      message: "Note submitted successfully. Status is Pending approval."
    });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}