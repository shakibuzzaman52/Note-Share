const UPLOAD_FOLDER_ID = "1Lc3PKMkTH10EuaZW6M8Z8KdL53BBEH2W";

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName("Notes") || ss.getSheets()[0];
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return jsonResponse({ success: true, count: 0, notes: [] });
    }

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
    const viewIdx   = findCol(["view"]);

    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "GMT+6";
    const notes = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = String(row[statusIdx] || "").trim().toLowerCase();

      if (status === "approved") {
        const rawDate = row[dateIdx];
        let dateStr = "";

        if (rawDate) {
          if (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) {
            dateStr = rawDate.trim();
          } else {
            const parsed = rawDate instanceof Date ? rawDate : new Date(rawDate);
            if (!isNaN(parsed.getTime())) {
              dateStr = Utilities.formatDate(parsed, tz, "yyyy-MM-dd");
            } else {
              dateStr = String(rawDate).trim().split("T")[0];
            }
          }
        }

        notes.push({
          row: i + 1,
          department:  deptIdx !== -1 ? String(row[deptIdx] || "").trim() : "",
          section:     secIdx !== -1 ? String(row[secIdx] || "").trim() : "",
          date:        dateStr,
          course:      courseIdx !== -1 ? String(row[courseIdx] || "").trim() : "",
          topic:       topicIdx !== -1 ? String(row[topicIdx] || "").trim() : "",
          title:       titleIdx !== -1 ? String(row[titleIdx] || "").trim() : "",
          link:        linkIdx !== -1 ? String(row[linkIdx] || "").trim() : "",
          status:      "Approved",
          reportCount: reportIdx !== -1 ? Number(row[reportIdx] || 0) : 0,
          viewCount:   viewIdx !== -1 ? Number(row[viewIdx] || 0) : 0
        });
      }
    }

    return jsonResponse({ success: true, count: notes.length, notes: notes });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  let hasLock = false;
  const lock = LockService.getScriptLock();
  try {
    hasLock = lock.tryLock(15000);
  } catch (err) {}

  try {
    let payload = null;
    try {
      if (e && e.postData && e.postData.contents) {
        payload = JSON.parse(e.postData.contents);
      } else if (e && e.parameter) {
        payload = e.parameter;
      }
    } catch (parseErr) {
      payload = e ? e.parameter : null;
    }

    if (!payload) {
      return jsonResponse({ success: false, error: "Empty request payload" });
    }

    const sheet = getSheet();
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());

    let reportIdx = headers.findIndex(h => h.includes("report"));
    if (reportIdx === -1) {
      reportIdx = headers.length;
      sheet.getRange(1, reportIdx + 1).setValue("ReportCount");
      headers.push("reportcount");
    }

    let viewIdx = headers.findIndex(h => h.includes("view"));
    if (viewIdx === -1) {
      viewIdx = headers.length;
      sheet.getRange(1, viewIdx + 1).setValue("ViewCount");
      headers.push("viewcount");
    }

    if (payload.type === "view" || payload.type === "report") {
      const colIdx = payload.type === "view" ? viewIdx : reportIdx;
      const rowNum = Number(payload.row);
      if (rowNum >= 2 && rowNum <= sheet.getLastRow()) {
        const cell = sheet.getRange(rowNum, colIdx + 1);
        const currentCount = Number(cell.getValue() || 0) + 1;
        cell.setValue(currentCount);
        return jsonResponse({ success: true, count: currentCount });
      }
      return jsonResponse({ success: false, error: "Invalid row" });
    }

    const dept   = String(payload.department || "").trim();
    const sec    = String(payload.section || "").trim();
    const date   = String(payload.date || "").trim();
    const course = String(payload.course || "").trim();
    const topic  = String(payload.topic || "").trim();
    const title  = String(payload.title || "").trim();

    if (!dept || !sec || !date || !course || !topic || !title) {
      return jsonResponse({ success: false, error: "All required fields must be filled." });
    }

    let fileUrl = "";

    if (payload.fileData) {
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      const ALLOWED_EXTS = ["pdf", "doc", "docx", "ppt", "pptx", "png", "jpg", "jpeg"];

      try {
        const decodedBytes = Utilities.base64Decode(payload.fileData);
        if (decodedBytes.length > MAX_FILE_SIZE) {
          return jsonResponse({ success: false, error: "File size exceeds 10MB limit." });
        }

        const rawFileName = String(payload.fileName || "").trim();
        const ext = rawFileName.split(".").pop().toLowerCase();
        if (!ALLOWED_EXTS.includes(ext)) {
          return jsonResponse({ success: false, error: "Unsupported file format." });
        }

        const baseName = rawFileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
        const safeFileName = (baseName || "lecture_note") + "_" + new Date().getTime() + "." + ext;

        const mimeType = payload.fileMimeType || "application/octet-stream";
        const blob = Utilities.newBlob(decodedBytes, mimeType, safeFileName);

        const targetFolder = DriveApp.getFolderById(UPLOAD_FOLDER_ID.trim());
        const createdFile = targetFolder.createFile(blob);

        try {
          createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {}

        fileUrl = createdFile.getUrl();
      } catch (uploadErr) {
        return jsonResponse({ success: false, error: "File upload failed: " + uploadErr.toString() });
      }
    } else if (payload.link) {
      fileUrl = String(payload.link).trim();
    } else {
      return jsonResponse({ success: false, error: "Either a lecture file or a resource URL must be provided." });
    }

    sheet.appendRow([
      dept,
      sec,
      date,
      course,
      topic,
      title,
      fileUrl,
      "Pending",
      0,
      new Date(),
      0
    ]);

    return jsonResponse({
      success: true,
      message: "Note submitted with Pending status.",
      fileUrl: fileUrl
    });

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (err) {}
    }
  }
}