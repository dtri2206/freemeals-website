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

/* ============================================================
 * DONG BO SANG SUPABASE (Giai doan 3)
 * ------------------------------------------------------------
 * Day tab "Thanh Vien" + "Quan An" tu Google Sheet sang Supabase
 * (mot chieu Sheet -> Supabase). Trang quet quet.html doc/ghi
 * truc tiep tren Supabase; Sheet van la noi admin quan ly thu cong.
 *
 * Cau hinh 1 lan: Project Settings > Script properties
 *   SUPABASE_URL         = https://dqgjnqeqwsijnsphpzqt.supabase.co
 *   SUPABASE_SERVICE_KEY = <service_role key>   (KHONG bao gio dua vao code/website)
 *
 * Chay:
 *   - setupSupabaseSyncTrigger()  -> cai trigger tu chay moi 10 phut (chay 1 lan)
 *   - syncToSupabase()            -> chay tay bat cu luc nao
 * ============================================================ */

var SUPABASE_MEMBERS_TABLE = "members";
var SUPABASE_LOCATIONS_TABLE = "locations";

function getSupabaseConfig_() {
  var props = PropertiesService.getScriptProperties();
  var url = String(props.getProperty("SUPABASE_URL") || "").replace(/\/+$/, "");
  var key = String(props.getProperty("SUPABASE_SERVICE_KEY") || "");
  if (!url || !key) {
    throw new Error("Chua cau hinh SUPABASE_URL / SUPABASE_SERVICE_KEY trong Script properties.");
  }
  return { url: url, key: key };
}

function supabaseFetch_(method, path, payload, extraHeaders) {
  var cfg = getSupabaseConfig_();
  var headers = {
    "apikey": cfg.key,
    "Authorization": "Bearer " + cfg.key,
    "Content-Type": "application/json"
  };
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function (k) { headers[k] = extraHeaders[k]; });
  }

  var options = { method: method, headers: headers, muteHttpExceptions: true };
  if (payload !== undefined && payload !== null) {
    options.payload = JSON.stringify(payload);
  }

  var res = UrlFetchApp.fetch(cfg.url + path, options);
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Supabase " + method + " " + path + " -> HTTP " + code + ": " + body);
  }
  return body ? JSON.parse(body) : null;
}

/** Doc cac hang co du lieu cua 1 tab (bo hang tieu de, bo hang trong theo cot A). */
function readSheetRows_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Khong tim thay tab "' + sheetName + '".');
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === "") continue;
    out.push(values[i]);
  }
  return out;
}

/**
 * Upsert theo khoa "code", roi dat is_active=false cho moi dong con is_active
 * tren Supabase nhung khong con trong Sheet (xoa mem, giu nguyen lich su an).
 */
function syncTableToSupabase_(table, records) {
  if (records.length === 0) {
    // Sheet rong -> khong lam gi, tranh vo tinh khoa toan bo du lieu.
    return { table: table, upserted: 0, deactivated: 0, note: "sheet trong, bo qua" };
  }

  // 1) Upsert (chen moi + cap nhat) tat ca dong dang co trong Sheet.
  supabaseFetch_(
    "POST",
    "/rest/v1/" + table + "?on_conflict=code",
    records,
    { "Prefer": "resolution=merge-duplicates,return=minimal" }
  );

  // 2) Lay danh sach code dang active tren Supabase de tim dong da bi xoa khoi Sheet.
  var activeRows = supabaseFetch_("GET", "/rest/v1/" + table + "?select=code&is_active=eq.true");
  var sheetCodes = {};
  records.forEach(function (r) { sheetCodes[r.code] = true; });

  var deactivated = 0;
  (activeRows || []).forEach(function (row) {
    if (!sheetCodes[row.code]) {
      supabaseFetch_(
        "PATCH",
        "/rest/v1/" + table + "?code=eq." + encodeURIComponent(row.code),
        { is_active: false },
        { "Prefer": "return=minimal" }
      );
      deactivated++;
    }
  });

  return { table: table, upserted: records.length, deactivated: deactivated };
}

/** Tab "Thanh Vien": A=Ma khach, B=Ho ten, C=SDT, D=So suat/thang. */
function syncMembers_() {
  var records = readSheetRows_("Thành Viên").map(function (r) {
    return {
      code: String(r[0]).trim(),
      name: String(r[1] || "").trim(),
      phone: String(r[2] || "").trim() || null,
      monthly_allowance: Number(r[3]) || 0,
      is_active: true
    };
  });
  return syncTableToSupabase_(SUPABASE_MEMBERS_TABLE, records);
}

/** Tab "Quan An": A=Ma quan, B=Ten quan, D=Mat khau, E=Gioi han suat/thang. */
function syncLocations_() {
  var records = readSheetRows_("Quán Ăn").map(function (r) {
    return {
      code: String(r[0]).trim(),
      name: String(r[1] || "").trim(),
      password: String(r[3] || "").trim(),
      monthly_limit: Number(r[4]) || 0,
      is_active: true
    };
  });
  return syncTableToSupabase_(SUPABASE_LOCATIONS_TABLE, records);
}

/** Ham chinh: goi tay hoac gan trigger thoi gian. */
function syncToSupabase() {
  var result = {
    locations: syncLocations_(),
    members: syncMembers_(),
    at: new Date().toISOString()
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/** Chay 1 lan de cai trigger tu dong dong bo moi 10 phut. */
function setupSupabaseSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncToSupabase") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("syncToSupabase")
    .timeBased()
    .everyMinutes(10)
    .create();

  return "Da cai trigger dong bo Supabase moi 10 phut.";
}
