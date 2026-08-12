/**
 * FILE NÀY DÙNG ĐỂ DÁN VÀO GOOGLE APPS SCRIPT (script.google.com)
 * KHÔNG chạy file này trên máy tính của bạn — nó chỉ chạy trên Google Cloud.
 * Xem hướng dẫn chi tiết từng bước trong README.md.
 *
 * Cần đúng 4 tab (sheet con), tên phải chính xác từng chữ:
 *   - "Khách Ăn"    -> Giai đoạn 1: người đăng ký mới từ index.html (doPost ghi vào đây)
 *       A: Họ và Tên, B: SĐT, C: Quán ăn, D: Trạng thái, E: Thời gian
 *   - "Quán Ăn"   -> danh sách quán ăn
 *       A: Mã quán, B: Tên quán + Địa chỉ, C: Link QR (công thức), D: Mật khẩu, E: Giới hạn suất/ngày
 *   - "Thành Viên" -> Giai đoạn 2: khách đã được quỹ xác minh qua điện thoại
 *       A: Mã khách, B: Họ và tên, C: SĐT, D: Bữa/ngày được cấp, E: Link QR (công thức)
 *   - "Lịch Sử Ăn"  -> Giai đoạn 2: nhật ký từng lượt ăn (append-only, KHÔNG sửa tay)
 *       A: Thời gian, B: Mã khách, C: Tên khách, D: Mã quán, E: Tên quán, F: Số suất
 *
 * QUAN TRỌNG: Vào File → Project Settings (Cài đặt dự án) trong Apps Script,
 * kiểm tra "Time zone" đang để đúng "(GMT+07:00) Vietnam Time" — nếu sai múi giờ,
 * việc tính hạn mức "hôm nay" sẽ bị lệch giờ.
 */

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ==================== DÙNG CHUNG CHO CẢ 2 GIAI ĐOẠN ==================== */

// Tìm quán trong tab "Quán Ăn" theo mã quán
function findLocationByCode(code) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Quán Ăn");
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) { // bỏ dòng 1 (tiêu đề)
    var rowCode = String(rows[i][0] || "").trim();
    if (rowCode && rowCode === code) {
      return {
        name: String(rows[i][1] || "").trim(),
        password: String(rows[i][3] || "").trim(),      // cột D
        dailyLimit: Number(rows[i][4]) || 0              // cột E, 0 = không giới hạn
      };
    }
  }
  return null;
}

// Tìm khách trong tab "Thành Viên" theo mã khách
function findMemberByCode(code) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Thành Viên");
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var rowCode = String(rows[i][0] || "").trim();
    if (rowCode && rowCode === code) {
      return {
        name: String(rows[i][1] || "").trim(),
        allowance: Number(rows[i][3]) || 0 // cột D: Bữa/ngày được cấp
      };
    }
  }
  return null;
}

// Cộng tổng số suất đã ghi nhận HÔM NAY trong tab "Lịch Sử Ăn", theo 1 cột chỉ định
// (dùng chung để tính cho cả khách và quán)
function getTodaySum(matchColumnIndex, matchValue) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lịch Sử Ăn");
  var rows = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  var todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  var sum = 0;

  for (var i = 1; i < rows.length; i++) {
    var rowDate = rows[i][0];
    if (!(rowDate instanceof Date)) continue;
    if (Utilities.formatDate(rowDate, tz, "yyyy-MM-dd") !== todayStr) continue;
    if (String(rows[i][matchColumnIndex] || "").trim() === matchValue) {
      sum += Number(rows[i][5]) || 0; // cột F: Số suất
    }
  }
  return sum;
}

/* ==================== doGet ==================== */

function doGet(e) {
  try {
    var action = e.parameter.action;

    if (action === "member") {
      return jsonResponse(getMemberInfo(e.parameter.code));
    }

    // Mặc định: trả về danh sách quán ăn - dùng cho cả index.html (Giai đoạn 1)
    // và quet.html (Giai đoạn 2, để lấy tên quán + mật khẩu + hạn mức)
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Quán Ăn");
    var rows = sheet.getDataRange().getValues();
    var locations = [];

    for (var i = 1; i < rows.length; i++) {
      var code = String(rows[i][0] || "").trim();
      if (code) {
        locations.push({
          code: code,
          name: String(rows[i][1] || "").trim(),
          password: String(rows[i][3] || "").trim(),
          dailyLimit: Number(rows[i][4]) || 0
        });
      }
    }

    return jsonResponse({ result: "success", locations: locations });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });
  }
}

// Tra cứu 1 khách theo mã, kèm số suất đã dùng hôm nay - cho màn hình xác nhận ở quet.html
function getMemberInfo(code) {
  var member = findMemberByCode(code);
  if (!member) {
    return { result: "error", message: "Khong tim thay ma khach nay." };
  }
  var usedToday = getTodaySum(1, code); // cột B trong Lịch Sử Ăn = Mã khách
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

/* ==================== doPost ==================== */

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (data.action === "checkin") {
    return handleCheckin(data);
  }
  return handleRegistration(data);
}

// Giai đoạn 1: người dùng tự đăng ký từ index.html
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

// Giai đoạn 2: chủ quán quét QR khách, chọn số suất, xác nhận -> ghi vào "Lịch Sử Ăn"
function handleCheckin(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    return jsonResponse({ result: "error", message: "He thong dang ban, vui long thu lai sau vai giay." });
  }

  try {
    var location = findLocationByCode(data.locationCode);
    if (!location) {
      return jsonResponse({ result: "error", message: "Khong tim thay quan an." });
    }
    if (!data.locationPassword || data.locationPassword !== location.password) {
      return jsonResponse({ result: "error", message: "Mat khau quan khong dung." });
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
      var quanUsedToday = getTodaySum(3, data.locationCode); // cột D trong Lịch Sử Ăn = Mã quán
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
      data.locationCode,
      location.name,
      portions
    ]);

    return jsonResponse({
      result: "success",
      memberName: member.name,
      memberRemaining: member.allowance - (memberUsedToday + portions)
    });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}
