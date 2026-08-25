function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getCachedRows(sheetName, cacheKey) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var rows = sheet.getDataRange().getValues();
  cache.put(cacheKey, JSON.stringify(rows), 60);
  return rows;
}

function findLocationByCode(code) {
  var rows = getCachedRows("Quán Ăn", "quanAnRows");

  for (var i = 1; i < rows.length; i++) {
    var rowCode = String(rows[i][0] || "").trim();
    if (rowCode && rowCode === code) {
      return {
        name: String(rows[i][1] || "").trim(),
        password: String(rows[i][3] || "").trim(),
        monthlyLimit: Number(rows[i][4]) || 0
      };
    }
  }
  return null;
}

function findLocationByPassword(password) {
  var rows = getCachedRows("Quán Ăn", "quanAnRows");

  for (var i = 1; i < rows.length; i++) {
    var rowPassword = String(rows[i][3] || "").trim();
    if (rowPassword && rowPassword === password) {
      return {
        code: String(rows[i][0] || "").trim(),
        name: String(rows[i][1] || "").trim(),
        monthlyLimit: Number(rows[i][4]) || 0
      };
    }
  }
  return null;
}

function findMemberByCode(code) {
  var rows = getCachedRows("Thành Viên", "thanhVienRows");

  for (var i = 1; i < rows.length; i++) {
    var rowCode = String(rows[i][0] || "").trim();
    if (rowCode && rowCode === code) {
      return {
        name: String(rows[i][1] || "").trim(),
        allowance: Number(rows[i][3]) || 0
      };
    }
  }
  return null;
}

function toDateSafe(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string" && value) {
    var parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function getThisMonthSum(matchColumnIndex, matchValue) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lịch Sử Ăn");
  var rows = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  var thisMonthStr = Utilities.formatDate(new Date(), tz, "yyyy-MM");
  var sum = 0;

  for (var i = 1; i < rows.length; i++) {
    var rowDate = toDateSafe(rows[i][0]);
    if (!rowDate) continue;
    if (Utilities.formatDate(rowDate, tz, "yyyy-MM") !== thisMonthStr) continue;
    if (String(rows[i][matchColumnIndex] || "").trim() === String(matchValue).trim()) {
      sum += Number(rows[i][5]) || 0;
    }
  }
  return sum;
}

function getThisMonthSumsForCheckin(memberCode, quanCode) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lịch Sử Ăn");
  var rows = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  var thisMonthStr = Utilities.formatDate(new Date(), tz, "yyyy-MM");
  var memberSum = 0;
  var quanSum = 0;

  for (var i = 1; i < rows.length; i++) {
    var rowDate = toDateSafe(rows[i][0]);
    if (!rowDate) continue;
    if (Utilities.formatDate(rowDate, tz, "yyyy-MM") !== thisMonthStr) continue;
    var suat = Number(rows[i][5]) || 0;
    if (String(rows[i][1] || "").trim() === memberCode) memberSum += suat;
    if (quanCode && String(rows[i][3] || "").trim() === quanCode) quanSum += suat;
  }

  return { memberSum: memberSum, quanSum: quanSum };
}

function doGet(e) {
  try {
    var action = e.parameter.action;

    if (action === "member") {
      return jsonResponse(getMemberInfo(e.parameter.code));
    }

    if (action === "history") {
      return jsonResponse({ result: "success", history: getMemberHistory(e.parameter.code) });
    }

    var rows = getCachedRows("Quán Ăn", "quanAnRows");
    var locations = [];

    for (var i = 1; i < rows.length; i++) {
      var code = String(rows[i][0] || "").trim();
      if (code) {
        locations.push({
          code: code,
          name: String(rows[i][1] || "").trim()
        });
      }
    }

    return jsonResponse({ result: "success", locations: locations });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });
  }
}

function getMemberHistory(code) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lịch Sử Ăn");
  var rows = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  var thisMonthStr = Utilities.formatDate(new Date(), tz, "yyyy-MM");
  var history = [];

  for (var i = 1; i < rows.length; i++) {
    var rowDate = toDateSafe(rows[i][0]);
    if (!rowDate) continue;
    if (Utilities.formatDate(rowDate, tz, "yyyy-MM") !== thisMonthStr) continue;
    if (String(rows[i][1] || "").trim() !== String(code).trim()) continue;

    history.push({
      timestamp: rowDate.getTime(),
      date: Utilities.formatDate(rowDate, tz, "dd/MM/yyyy HH:mm"),
      locationName: String(rows[i][4] || "").trim()
    });
  }

  history.sort(function (a, b) { return b.timestamp - a.timestamp; });

  return history.map(function (item) {
    return { date: item.date, locationName: item.locationName };
  });
}

function getMemberInfo(code) {
  var member = findMemberByCode(code);
  if (!member) {
    return { result: "error", message: "Khong tim thay ma khach nay." };
  }
  var usedThisMonth = getThisMonthSum(1, code);
  return {
    result: "success",
    member: {
      code: code,
      name: member.name,
      allowance: member.allowance,
      usedThisMonth: usedThisMonth,
      remaining: Math.max(0, member.allowance - usedThisMonth)
    }
  };
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (data.action === "checkin") {
    return handleCheckin(data);
  }
  return handleRegistration(data);
}

function handleRegistration(data) {
  try {
    var location = findLocationByCode(data.locationCode);
    if (!location) {
      return jsonResponse({ result: "error", message: "Khong tim thay quan an." });
    }
    if (!data.password || data.password !== location.password) {
      return jsonResponse({ result: "error", message: "Mat khau khong dung." });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Khách Ăn");
    sheet.appendRow([
      data.fullName,
      data.phone,
      data.location,
      "",
      new Date()
    ]);

    return jsonResponse({ result: "success" });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });
  }
}

function handleCheckin(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    return jsonResponse({ result: "error", message: "He thong dang ban, vui long thu lai sau vai giay." });
  }

  try {
    if (!data.password) {
      return jsonResponse({ result: "error", message: "Chua nhap mat khau." });
    }

    var location = findLocationByPassword(data.password);
    if (!location) {
      return jsonResponse({ result: "error", message: "Mat khau khong dung." });
    }

    var member = findMemberByCode(data.memberCode);
    if (!member) {
      return jsonResponse({ result: "error", message: "Khong tim thay ma khach nay." });
    }

    var portions = 1;

    var sums = getThisMonthSumsForCheckin(data.memberCode, location.code);

    if (sums.memberSum + portions > member.allowance) {
      return jsonResponse({
        result: "error",
        message: "Khach da dung " + sums.memberSum + "/" + member.allowance +
          " suat thang nay, khong the nhan them suat."
      });
    }

    if (location.monthlyLimit > 0 && sums.quanSum + portions > location.monthlyLimit) {
      return jsonResponse({
        result: "error",
        message: "Quan da ban " + sums.quanSum + "/" + location.monthlyLimit +
          " suat thang nay, khong the ban them suat."
      });
    }

    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lịch Sử Ăn");
    logSheet.appendRow([
      new Date(),
      data.memberCode,
      member.name,
      location.code,
      location.name,
      portions
    ]);

    return jsonResponse({
      result: "success",
      memberName: member.name,
      locationName: location.name,
      memberRemaining: member.allowance - (sums.memberSum + portions)
    });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function archiveAndResetMonthlyLog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var liveSheet = ss.getSheetByName("Lịch Sử Ăn");
  var allData = liveSheet.getDataRange().getValues();

  if (allData.length <= 1) {
    return "Khong co du lieu de luu tru.";
  }

  var header = allData[0];
  var dataRows = allData.slice(1);
  var tz = Session.getScriptTimeZone();
  var groupedByMonth = {};

  for (var i = 0; i < dataRows.length; i++) {
    var row = dataRows[i];
    var rowDate = toDateSafe(row[0]);
    var monthKey = rowDate ? Utilities.formatDate(rowDate, tz, "yyyy-MM") : "KhongXacDinhNgay";
    if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = [];
    groupedByMonth[monthKey].push(row);
  }

  for (var monthKey in groupedByMonth) {
    var archiveSheetName = "LuuTru_" + monthKey;
    var archiveSheet = ss.getSheetByName(archiveSheetName);
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet(archiveSheetName);
      archiveSheet.appendRow(header);
    }
    var rowsToArchive = groupedByMonth[monthKey];
    archiveSheet
      .getRange(archiveSheet.getLastRow() + 1, 1, rowsToArchive.length, header.length)
      .setValues(rowsToArchive);
  }

  if (liveSheet.getLastRow() > 1) {
    liveSheet
      .getRange(2, 1, liveSheet.getLastRow() - 1, liveSheet.getLastColumn())
      .clearContent();
  }

  return "Da luu tru " + dataRows.length + " dong vao " + Object.keys(groupedByMonth).length + " thang.";
}

function setupMonthlyArchiveTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "archiveAndResetMonthlyLog") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("archiveAndResetMonthlyLog")
    .timeBased()
    .onMonthDay(1)
    .atHour(0)
    .create();

  return "Da cai lich tu dong chay vao ngay 1 hang thang.";
}
