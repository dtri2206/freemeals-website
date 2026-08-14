function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function findLocationByCode(code) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Quán Ăn");
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var rowCode = String(rows[i][0] || "").trim();
    if (rowCode && rowCode === code) {
      return {
        name: String(rows[i][1] || "").trim(),
        password: String(rows[i][3] || "").trim(),
        dailyLimit: Number(rows[i][4]) || 0
      };
    }
  }
  return null;
}

function findLocationByPassword(password) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Quán Ăn");
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var rowPassword = String(rows[i][3] || "").trim();
    if (rowPassword && rowPassword === password) {
      return {
        code: String(rows[i][0] || "").trim(),
        name: String(rows[i][1] || "").trim(),
        dailyLimit: Number(rows[i][4]) || 0
      };
    }
  }
  return null;
}

function findMemberByCode(code) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Thành Viên");
  var rows = sheet.getDataRange().getValues();

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

function getTodaySum(matchColumnIndex, matchValue) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lịch Sử Ăn");
  var rows = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  var todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  var sum = 0;

  for (var i = 1; i < rows.length; i++) {
    var rowDate = toDateSafe(rows[i][0]);
    if (!rowDate) continue;
    if (Utilities.formatDate(rowDate, tz, "yyyy-MM-dd") !== todayStr) continue;
    if (String(rows[i][matchColumnIndex] || "").trim() === String(matchValue).trim()) {
      sum += Number(rows[i][5]) || 0;
    }
  }
  return sum;
}

function doGet(e) {
  try {
    var action = e.parameter.action;

    if (action === "member") {
      return jsonResponse(getMemberInfo(e.parameter.code));
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Quán Ăn");
    var rows = sheet.getDataRange().getValues();
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

function getMemberInfo(code) {
  var member = findMemberByCode(code);
  if (!member) {
    return { result: "error", message: "Khong tim thay ma khach nay." };
  }
  var usedToday = getTodaySum(1, code);
  return {
    result: "success",
    member: {
      code: code,
      name: member.name,
      allowance: member.allowance,
      usedToday: usedToday,
      remaining: Math.max(0, member.allowance - usedToday)
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

    var portions = Number(data.portions);
    if (portions !== 1 && portions !== 2) {
      return jsonResponse({ result: "error", message: "So suat khong hop le." });
    }

    var memberUsedToday = getTodaySum(1, data.memberCode);
    if (memberUsedToday + portions > member.allowance) {
      return jsonResponse({
        result: "error",
        message: "Khach da dung " + memberUsedToday + "/" + member.allowance +
          " suat hom nay, khong the nhan them " + portions + " suat."
      });
    }

    if (location.dailyLimit > 0) {
      var quanUsedToday = getTodaySum(3, location.code);
      if (quanUsedToday + portions > location.dailyLimit) {
        return jsonResponse({
          result: "error",
          message: "Quan da ban " + quanUsedToday + "/" + location.dailyLimit +
            " suat hom nay, khong the ban them " + portions + " suat."
        });
      }
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
      memberRemaining: member.allowance - (memberUsedToday + portions)
    });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}
