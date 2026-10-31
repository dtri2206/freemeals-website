/* ============================================================
 * TAM THOI (khuyen mai dang ky) -- SUAT AN VANG LAI
 * ------------------------------------------------------------
 * Quan dang promote chuong trinh: ai dang ky Giai doan 1 (duoc them vao tab
 * "Khach An" boi index.html/script.js) thi duoc tinh ngay 1 suat an vang lai,
 * khong can qua cot "Trang thai" duyet, khong lien quan gi den Thanh Vien
 * chinh thuc (members/meal_log). Dashboard quan (quan-dashboard/) doc bang
 * nay de hien 1 bang rieng + cong vao so "Luot quet"/"Suat an" trong tab
 * Theo doi 24h.
 *
 * File nay va trigger cua no CO CHU DICH tach rieng khoi Code.gs/BaoCao.gs:
 * het dot khuyen mai chi can xoa file nay + xoa trigger (chay
 * removeCasualSyncTrigger() mot lan) + xoa bang casual_meal_signups ben
 * Supabase -- khong dong gi den phan Thanh Vien dang chay that.
 *
 * Dung chung getLocationsData()/supabaseFetch_()/readSheetRows_() da dinh
 * nghia trong Code.gs (cac file .gs cung project chia se pham vi toan cuc).
 *
 * Cai dat 1 lan: chay setupCasualSyncTrigger() -> tu dong quet lai moi 10 phut.
 * ============================================================ */

var CASUAL_SIGNUPS_TABLE = "casual_meal_signups";

/**
 * Tab "Khach An": A=Ho ten, B=SDT, C=Ten quan, D=Trang thai (bo qua), E=Thoi gian.
 * Khong co "_" cuoi ten de con chay tay tu danh sach ham trong trinh soan thao.
 */
function syncCasualMealSignups() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Khách Ăn");
  if (!sheet) throw new Error('Khong tim thay tab "Khách Ăn".');
  var values = sheet.getDataRange().getValues();

  var codeByName = {};
  readSheetRows_("Quán Ăn").forEach(function (r) {
    codeByName[String(r[1] || "").trim()] = String(r[0]).trim();
  });

  var records = [];
  var skippedNoLocation = [];
  var skippedBadTime = [];
  var skippedNoPhone = [];

  for (var i = 1; i < values.length; i++) {
    var fullName = String(values[i][0] || "").trim();
    if (!fullName) continue;

    var locationName = String(values[i][2] || "").trim();
    var code = codeByName[locationName];
    if (!code) {
      skippedNoLocation.push({ row: i + 1, location: locationName });
      continue;
    }

    // "Thoi gian" trong Sheet trong/sai dinh dang se lam new Date() ra
    // Invalid Date -- toISOString() tren gia tri do nem loi va lam hong ca
    // lot dong bo, nen phai kiem tra truoc va bo qua rieng dong do.
    var registeredAt = new Date(values[i][4]);
    if (isNaN(registeredAt.getTime())) {
      skippedBadTime.push({ row: i + 1 });
      continue;
    }

    var phone = String(values[i][1] || "").trim();
    if (!phone) {
      skippedNoPhone.push({ row: i + 1 });
      continue;
    }

    records.push({
      // Ben quy yeu cau KHONG check trung nguoi dang ky nua: 1 nguoi dang ky
      // nhieu lan (ke ca o quan khac) van duoc tinh nhieu suat vang lai.
      // Khoa nay (sdt + gio dang ky chinh xac) chi de tranh dong CHINH dong
      // do bi gui lap lai moi lan quet sheet (10 phut/lan), khong phai de
      // chong trung nguoi -- 2 lan dang ky khac thoi diem se co 2 khoa khac
      // nhau nen van duoc tinh rieng.
      signup_key: phone + "|" + registeredAt.toISOString(),
      full_name: fullName,
      phone: phone,
      location_code: code,
      registered_at: registeredAt.toISOString()
    });
  }

  if (records.length > 0) {
    supabaseFetch_(
      "POST",
      "/rest/v1/" + CASUAL_SIGNUPS_TABLE + "?on_conflict=signup_key",
      records,
      { "Prefer": "resolution=ignore-duplicates,return=minimal" }
    );
  }

  var result = {
    synced: records.length,
    skippedNoLocation: skippedNoLocation,
    skippedBadTime: skippedBadTime,
    skippedNoPhone: skippedNoPhone
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/** Chay 1 lan de cai trigger tu dong quet lai moi 10 phut. */
function setupCasualSyncTrigger() {
  removeCasualSyncTrigger();
  ScriptApp.newTrigger("syncCasualMealSignups")
    .timeBased()
    .everyMinutes(10)
    .create();
  return "Da cai trigger quet suat an vang lai moi 10 phut.";
}

/** Goi khi go bo tinh nang (het dot khuyen mai). */
function removeCasualSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "syncCasualMealSignups") {
      ScriptApp.deleteTrigger(t);
    }
  });
}
