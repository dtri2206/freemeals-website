/**
 * FILE NÀY DÙNG ĐỂ DÁN VÀO GOOGLE APPS SCRIPT (script.google.com)
 * KHÔNG chạy file này trên máy tính của bạn — nó chỉ chạy trên Google Cloud.
 * Xem hướng dẫn chi tiết từng bước trong README.md, Phần 3.
 *
 * Yêu cầu: Google Sheet phải có đúng 2 tab (sheet con) với tên chính xác:
 *   - "DangKy"  -> nơi lưu thông tin người đăng ký (doPost ghi vào đây)
 *   - "DiaDiem" -> danh sách quán ăn, cột A: Mã quán, cột B: Tên quán + Địa chỉ
 */

// Nhận dữ liệu form đăng ký, ghi vào tab "DangKy"
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DangKy");
    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.fullName,     // Họ và Tên
      data.phone,        // SĐT
      data.location,     // Quán ăn
      "",                 // Trạng thái - để trống, tình nguyện viên tự điền sau khi gọi điện
      new Date()          // Thời gian nhận được (giờ server)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Trả về danh sách quán ăn (đọc từ tab "DiaDiem") dưới dạng JSON cho website đọc
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DiaDiem");
    var rows = sheet.getDataRange().getValues();
    var locations = [];

    for (var i = 1; i < rows.length; i++) { // bỏ dòng 1 (tiêu đề)
      var code = String(rows[i][0] || "").trim();
      var name = String(rows[i][1] || "").trim();
      if (code) {
        locations.push({ code: code, name: name });
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", locations: locations }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
