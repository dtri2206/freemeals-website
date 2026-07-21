/**
 * FILE NÀY DÙNG ĐỂ DÁN VÀO GOOGLE APPS SCRIPT (script.google.com)
 * KHÔNG chạy file này trên máy tính của bạn — nó chỉ chạy trên Google Cloud.
 * Xem hướng dẫn chi tiết từng bước trong README.md, Phần 3.
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.fullName,     // Họ và Tên
      data.birthDate,    // Ngày tháng năm sinh
      data.phone,        // SĐT
      data.location,     // Quán ăn
      "Chưa xác minh",   // Trạng thái - tình nguyện viên cập nhật sau khi gọi điện
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
