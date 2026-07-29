/**
 * FILE NÀY DÙNG ĐỂ DÁN VÀO GOOGLE APPS SCRIPT (script.google.com)
 * KHÔNG chạy file này trên máy tính của bạn — nó chỉ chạy trên Google Cloud.
 * Xem hướng dẫn chi tiết từng bước trong README.md, Phần 3.
 *
 * Yêu cầu: Google Sheet phải có đúng 2 tab (sheet con) với tên chính xác:
 *   - "DangKy"  -> nơi lưu thông tin người đăng ký (doPost ghi vào đây)
 *   - "DiaDiem" -> danh sách quán ăn, cột A: Mã quán, B: Tên quán + Địa chỉ, D: Mật khẩu
 */

// Tìm quán trong tab "DiaDiem" theo mã quán, trả về {name, password} hoặc null nếu không thấy
function findLocationByCode(code) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DiaDiem");
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) { // bỏ dòng 1 (tiêu đề)
    var rowCode = String(rows[i][0] || "").trim();
    if (rowCode && rowCode === code) {
      return {
        name: String(rows[i][1] || "").trim(),
        password: String(rows[i][3] || "").trim() // cột D
      };
    }
  }
  return null;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Nhận dữ liệu form đăng ký, kiểm tra mật khẩu quán rồi ghi vào tab "DangKy"
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Kiểm tra lại mật khẩu ở phía server (dù web đã kiểm tra rồi) để chặn
    // trường hợp ai đó cố gửi dữ liệu thẳng lên mà không qua giao diện web.
    var location = findLocationByCode(data.locationCode);
    if (!location) {
      return jsonResponse({ result: "error", message: "Khong tim thay quan an." });
    }
    if (!data.password || data.password !== location.password) {
      return jsonResponse({ result: "error", message: "Mat khau khong dung." });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DangKy");
    sheet.appendRow([
      data.fullName,     // Họ và Tên
      data.phone,        // SĐT
      data.location,     // Quán ăn
      "",                 // Trạng thái - để trống, tình nguyện viên tự điền sau khi gọi điện
      new Date()          // Thời gian nhận được (giờ server)
    ]);

    return jsonResponse({ result: "success" });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });
  }
}

// Trả về danh sách quán ăn (đọc từ tab "DiaDiem") dưới dạng JSON cho website đọc,
// bao gồm cả mật khẩu để trang web kiểm tra ngay khi chủ quán nhập (Bước 2 - kiểm tra ở trình duyệt).
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DiaDiem");
    var rows = sheet.getDataRange().getValues();
    var locations = [];

    for (var i = 1; i < rows.length; i++) { // bỏ dòng 1 (tiêu đề)
      var code = String(rows[i][0] || "").trim();
      var name = String(rows[i][1] || "").trim();
      var password = String(rows[i][3] || "").trim();
      if (code) {
        locations.push({ code: code, name: name, password: password });
      }
    }

    return jsonResponse({ result: "success", locations: locations });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });
  }
}
