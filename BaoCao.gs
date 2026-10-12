/* ============================================================
 * XUAT BAO CAO THEO QUAN (menu trong Google Sheet)
 * ------------------------------------------------------------
 * Menu "📊 Báo cáo quỹ" > "Xuất file theo quán…" mo hop thoai chon
 * khoang ngay + quan, roi tao MOI QUAN 1 Google Sheet rieng trong Drive
 * cua nguoi bam. Moi dong = 1 khach / 1 ngay, doc tu view
 * report_daily_member_detail tren Supabase bang service_role key da cau
 * hinh cho phan dong bo trong Code.gs (key khong bao gio ra toi trinh duyet).
 *
 * File nay nam RIENG trong project Apps Script (ten "BaoCao"), canh Code.gs,
 * de dan de Code.gs sau nay khong xoa mat phan bao cao. Dung chung
 * supabaseFetch_() dinh nghia trong Code.gs (cac file .gs cung project chia
 * se pham vi toan cuc). Can them file HTML ten "ExportDialog" (noi dung lay tu
 * ExportDialog.html trong repo). Khong can Deploy lai web app -- menu chay tu
 * ban code da luu, khong qua web app.
 * ============================================================ */

var REPORT_TZ = "Asia/Ho_Chi_Minh";
var REPORT_ROOT_FOLDER_NAME = "Báo cáo suất ăn theo quán";
var REPORT_PAGE_SIZE = 1000; // = max-rows mac dinh cua PostgREST tren Supabase

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📊 Báo cáo quỹ")
    .addItem("Xuất file theo quán…", "showExportDialog")
    .addToUi();
}

function showExportDialog() {
  var html = HtmlService.createHtmlOutputFromFile("ExportDialog")
    .setWidth(480)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, "Xuất báo cáo theo quán");
}

/** Du lieu khoi tao cho hop thoai: danh sach quan + ngay hom nay theo gio VN. */
function getExportInit() {
  var locations = supabaseFetch_(
    "GET",
    "/rest/v1/locations?select=code,name,is_active&order=is_active.desc,name.asc"
  ) || [];
  return {
    today: Utilities.formatDate(new Date(), REPORT_TZ, "yyyy-MM-dd"),
    locations: locations
  };
}

/**
 * Goi tu hop thoai. req = { from: "yyyy-MM-dd", to: "yyyy-MM-dd", codes: [ma quan] }.
 * Tao 1 thu muc con cho lan xuat nay, trong do moi quan co suat an = 1 file.
 * Quan khong co suat nao trong khoang ngay thi KHONG tao file (tranh 1 dong
 * file rong trong Drive), nhung van tra ve trong danh sach de hop thoai ghi ro
 * "khong co suat an" -- quy van biet quan do da duoc kiem tra.
 */
function exportReportsByLocation(req) {
  var from = String((req && req.from) || "");
  var to = String((req && req.to) || "");
  var codes = (req && req.codes) || [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Ngày không hợp lệ.");
  }
  if (from > to) throw new Error("\"Từ ngày\" phải trước hoặc bằng \"Đến ngày\".");
  if (codes.length === 0) throw new Error("Chưa chọn quán nào.");

  var nameByCode = {};
  (supabaseFetch_("GET", "/rest/v1/locations?select=code,name") || []).forEach(function (l) {
    nameByCode[l.code] = l.name;
  });

  var byLocation = {};
  codes.forEach(function (c) { byLocation[c] = []; });
  fetchDetailRows_(from, to, codes).forEach(function (r) {
    if (byLocation[r.location_code]) byLocation[r.location_code].push(r);
  });

  var stamp = Utilities.formatDate(new Date(), REPORT_TZ, "dd/MM/yyyy HH:mm");
  var folder = null; // chi tao khi co it nhat 1 quan co du lieu
  var files = codes.map(function (code) {
    var name = nameByCode[code] || code;
    if (byLocation[code].length === 0) {
      return { code: code, name: name, url: null, portions: 0, rows: 0, days: 0 };
    }
    folder = folder || getExportFolder_(from, to, stamp);
    return writeLocationReport_(folder, code, name, from, to, stamp, byLocation[code]);
  });

  return {
    folderName: folder ? folder.getName() : null,
    folderUrl: folder ? folder.getUrl() : null,
    files: files
  };
}

/** Doc view chi tiet trong khoang ngay, lat trang theo REPORT_PAGE_SIZE. */
function fetchDetailRows_(from, to, codes) {
  var inList = codes.map(function (c) { return '"' + String(c).replace(/"/g, "") + '"'; }).join(",");
  var base = "/rest/v1/report_daily_member_detail"
    + "?select=day,member_code,member_name,location_code,portions,check_in_times"
    + "&day=gte." + from + "&day=lte." + to
    + "&location_code=in.(" + encodeURIComponent(inList) + ")"
    + "&order=day.asc,member_name.asc";

  var out = [];
  for (var offset = 0; ; offset += REPORT_PAGE_SIZE) {
    var page = supabaseFetch_("GET", base + "&limit=" + REPORT_PAGE_SIZE + "&offset=" + offset) || [];
    out = out.concat(page);
    if (page.length < REPORT_PAGE_SIZE) break;
  }
  return out;
}

/**
 * Thu muc goc "Bao cao suat an theo quan" (tao 1 lan, nho ID theo tung nguoi
 * dung -- UserProperties, vi moi nguoi bam co Drive rieng), ben trong moi lan
 * xuat la 1 thu muc con de khong ghi de file cua lan truoc.
 */
function getExportFolder_(from, to, stamp) {
  var props = PropertiesService.getUserProperties();
  var root = null;
  var rootId = props.getProperty("REPORT_ROOT_FOLDER_ID");
  if (rootId) {
    try {
      root = DriveApp.getFolderById(rootId);
      if (root.isTrashed()) root = null;
    } catch (e) {
      root = null; // thu muc da bi xoa han hoac mat quyen -> tao lai
    }
  }
  if (!root) {
    root = DriveApp.createFolder(REPORT_ROOT_FOLDER_NAME);
    props.setProperty("REPORT_ROOT_FOLDER_ID", root.getId());
  }
  return root.createFolder(vnDate_(from) + " → " + vnDate_(to) + " (xuất " + stamp + ")");
}

/** Tao file Google Sheet cho 1 quan (rows khong rong). Tra ve tom tat de hop thoai hien link. */
function writeLocationReport_(folder, code, name, from, to, stamp, rows) {
  var ss = SpreadsheetApp.create(name + " — " + vnDate_(from) + " đến " + vnDate_(to));
  ss.setSpreadsheetTimeZone(REPORT_TZ);
  ss.setSpreadsheetLocale("vi_VN");
  DriveApp.getFileById(ss.getId()).moveTo(folder);

  var sheet = ss.getSheets()[0];
  sheet.setName("Suất ăn");

  var header = ["Ngày", "Tên khách", "Mã khách", "Số suất trong ngày", "Giờ quét"];
  var total = 0;
  var days = {};
  var body = rows.map(function (r) {
    var portions = Number(r.portions) || 0;
    total += portions;
    days[r.day] = true;
    return [
      // Ghi Date that (khong ghi chuoi "01/09/2026"): Sheet locale en_US se
      // hieu nham chuoi do thanh 9 thang 1.
      Utilities.parseDate(r.day, REPORT_TZ, "yyyy-MM-dd"),
      r.member_name,
      r.member_code,
      portions,
      timesOnly_(r.check_in_times)
    ];
  });

  sheet.getRange(1, 1).setValue("Báo cáo suất ăn — " + name).setFontWeight("bold").setFontSize(14);
  sheet.getRange(2, 1).setValue(
    "Từ " + vnDate_(from) + " đến " + vnDate_(to) + "  ·  Mã quán: " + code + "  ·  Xuất lúc " + stamp
  ).setFontColor("#5f6368");

  sheet.getRange(4, 1, 1, header.length).setValues([header])
    .setFontWeight("bold").setBackground("#E3F2FD");

  var firstDataRow = 5;
  // Cot Ten / Ma / Gio de dang chu thuan, khong cho Sheet tu doi "19:27" thanh gio.
  sheet.getRange(firstDataRow, 2, body.length, 2).setNumberFormat("@");
  sheet.getRange(firstDataRow, 5, body.length, 1).setNumberFormat("@");
  sheet.getRange(firstDataRow, 1, body.length, 1).setNumberFormat("dd/mm/yyyy");
  sheet.getRange(firstDataRow, 1, body.length, header.length).setValues(body);

  var totalRow = firstDataRow + body.length + 1;
  sheet.getRange(totalRow, 3).setValue("Tổng cộng").setFontWeight("bold");
  sheet.getRange(totalRow, 4).setValue(total).setFontWeight("bold");

  sheet.setFrozenRows(4);
  // Dat do rong co dinh: autoResizeColumns se tinh ca tieu de dai o A1/A2 va
  // keo cot "Ngay" rong bang ca ten quan.
  [100, 220, 100, 140, 200].forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });

  return {
    code: code,
    name: name,
    url: ss.getUrl(),
    portions: total,
    rows: body.length,
    days: Object.keys(days).length
  };
}

/** "2026-09-01" -> "01/09/2026" */
function vnDate_(isoDay) {
  var p = String(isoDay).split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

/** "23/09/2026 11:05:12, 23/09/2026 18:40:03" -> "11:05, 18:40" */
function timesOnly_(checkInTimes) {
  return String(checkInTimes || "").split(", ").map(function (t) {
    return (t.split(" ")[1] || "").slice(0, 5);
  }).filter(function (t) { return t; }).join(", ");
}
