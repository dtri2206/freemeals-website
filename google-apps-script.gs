var TIMEZONE = "Asia/Ho_Chi_Minh";

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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

function toTimestamp(value) {
  var d = toDateSafe(value);
  return d ? d.getTime() : null;
}

function getMonthTimeRange() {
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
  var end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
  return { start: start, end: end };
}

function cachePutSafe(cache, key, obj) {
  try {
    var str = JSON.stringify(obj);
    var byteLength = Utilities.newBlob(str).getBytes().length;
    if (byteLength < 90000) {
      cache.put(key, str, 60);
    }
  } catch (e) {
    // Bo qua loi cache, lan doc sau se doc lai tu Sheet
  }
}

function getLocationsData() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("locations_data_v2");
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Quán Ăn");
  var rows = sheet.getDataRange().getValues();

  var byCode = {};
  var byPassword = {};
  var list = [];

  for (var i = 1; i < rows.length; i++) {
    var code = String(rows[i][0] || "").trim();
    if (!code) continue;

    var item = {
      code: code,
      name: String(rows[i][1] || "").trim(),
      password: String(rows[i][3] || "").trim(),
      monthlyLimit: Number(rows[i][4]) || 0
    };

    byCode[code] = item;
    if (item.password) byPassword[item.password] = item;
    list.push({ code: item.code, name: item.name });
  }

  var data = { byCode: byCode, byPassword: byPassword, list: list };
  cachePutSafe(cache, "locations_data_v2", data);
  return data;
}

function getMembersMap() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("members_map_v2");
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Thành Viên");
  var rows = sheet.getDataRange().getValues();
  var byCode = {};

  for (var i = 1; i < rows.length; i++) {
    var code = String(rows[i][0] || "").trim();
    if (!code) continue;
    byCode[code] = {
      name: String(rows[i][1] || "").trim(),
      allowance: Number(rows[i][3]) || 0
    };
  }

  cachePutSafe(cache, "members_map_v2", byCode);
  return byCode;
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

    var locations = getLocationsData();
    return jsonResponse({ result: "success", locations: locations.list });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });
  }
}

function getMemberInfo(code) {
  var members = getMembersMap();
  var member = members[code];
  if (!member) {
    return { result: "error", message: "Khong tim thay ma khach nay." };
  }

  var range = getMonthTimeRange();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lịch Sử Ăn");
  var rows = sheet.getDataRange().getValues();
  var usedThisMonth = 0;

  for (var i = 1; i < rows.length; i++) {
    var t = toTimestamp(rows[i][0]);
    if (t === null || t < range.start || t >= range.end) continue;
    if (String(rows[i][1] || "").trim() === code) {
      usedThisMonth += Number(rows[i][5]) || 0;
    }
  }

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

function getMemberHistory(code) {
  var range = getMonthTimeRange();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lịch Sử Ăn");
  var rows = sheet.getDataRange().getValues();
  var history = [];

  for (var i = 1; i < rows.length; i++) {
    var t = toTimestamp(rows[i][0]);
    if (t === null || t < range.start || t >= range.end) continue;
    if (String(rows[i][1] || "").trim() !== String(code).trim()) continue;

    history.push({
      timestamp: t,
      locationName: String(rows[i][4] || "").trim()
    });
  }

  history.sort(function (a, b) { return b.timestamp - a.timestamp; });

  return history.map(function (item) {
    return {
      date: Utilities.formatDate(new Date(item.timestamp), TIMEZONE, "dd/MM/yyyy HH:mm"),
      locationName: item.locationName
    };
  });
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
    var locations = getLocationsData();
    var location = locations.byCode[data.locationCode];
    if (!location) {
      return jsonResponse({ result: "error", message: "Khong tim thay quan an." });
    }

    var password = String(data.password || "").trim();
    if (!password || password !== location.password) {
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
  var password = String(data.password || "").trim();
  if (!password) {
    return jsonResponse({ result: "error", message: "Chua nhap mat khau." });
  }

  var locations = getLocationsData();
  var location = locations.byPassword[password];
  if (!location) {
    return jsonResponse({ result: "error", message: "Mat khau khong dung." });
  }

  var members = getMembersMap();
  var member = members[data.memberCode];
  if (!member) {
    return jsonResponse({ result: "error", message: "Khong tim thay ma khach nay." });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    return jsonResponse({ result: "error", message: "He thong dang ban, vui long thu lai sau vai giay." });
  }

  try {
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lịch Sử Ăn");
    var rows = logSheet.getDataRange().getValues();
    var range = getMonthTimeRange();
    var memberSum = 0;
    var quanSum = 0;
    var portions = 1;

    for (var i = 1; i < rows.length; i++) {
      var t = toTimestamp(rows[i][0]);
      if (t === null || t < range.start || t >= range.end) continue;
      var suat = Number(rows[i][5]) || 0;
      if (String(rows[i][1] || "").trim() === data.memberCode) memberSum += suat;
      if (String(rows[i][3] || "").trim() === location.code) quanSum += suat;
    }

    if (memberSum + portions > member.allowance) {
      return jsonResponse({
        result: "error",
        message: "Khach da dung " + memberSum + "/" + member.allowance +
          " suat thang nay, khong the nhan them suat."
      });
    }

    if (location.monthlyLimit > 0 && quanSum + portions > location.monthlyLimit) {
      return jsonResponse({
        result: "error",
        message: "Quan da ban " + quanSum + "/" + location.monthlyLimit +
          " suat thang nay, khong the ban them suat."
      });
    }

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
      memberRemaining: member.allowance - (memberSum + portions)
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
