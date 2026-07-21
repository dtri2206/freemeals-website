"use strict";

/* =====================================================
   CẤU HÌNH - THAY ĐỔI DÒNG NÀY SAU KHI TẠO GOOGLE APPS SCRIPT
   Xem hướng dẫn trong README.md, Phần 3.
   ===================================================== */
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySYWfz3_iIjoGyQylUkTS0MTKKxI2XSXW1KPUkxqv7cfYH_v1aWAs-PY2LLH9hX9bF/exec";

/* =====================================================
   DANH SÁCH QUÁN ĂN - LẤY TỰ ĐỘNG TỪ GOOGLE SHEET (tab "DiaDiem")
   Không cần sửa code khi thêm/đổi quán nữa - chỉ cần sửa trong Sheet.
   Xem hướng dẫn trong README.md, Phần 5.
   ===================================================== */
let LOCATION_MAP = {}; // sẽ được nạp từ Google Sheet lúc trang tải lên

const LOADING_LOCATION_TEXT = "Đang tải thông tin quán ăn...";
const UNKNOWN_LOCATION_TEXT = "Chưa xác định điểm phát đồ ăn";

/* ===================================================== */

const form = document.getElementById("registerForm");
const submitBtn = document.getElementById("submitBtn");
const submitBtnText = document.getElementById("submitBtnText");

const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");

const registerAgainBtn = document.getElementById("registerAgainBtn");
const tryAgainBtn = document.getElementById("tryAgainBtn");

const locationDisplay = document.getElementById("locationDisplay");

const fields = {
  fullName: document.getElementById("fullName"),
  phone: document.getElementById("phone"),
  location: document.getElementById("location"), // ô ẩn (hidden) chứa giá trị thật
};

/* ---------- TẢI DANH SÁCH QUÁN ĂN TỪ GOOGLE SHEET ---------- */

async function loadLocationMap() {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const result = await response.json();
    const map = {};
    (result.locations || []).forEach((item) => {
      if (item.code) map[item.code] = item.name;
    });
    LOCATION_MAP = map;
  } catch (err) {
    console.error("Không tải được danh sách quán ăn:", err);
    LOCATION_MAP = {};
  }
}

/* ---------- ĐỌC QUÁN ĂN TỪ THAM SỐ TRÊN URL (MÃ QR) ---------- */

function resolveLocationFromURL() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("location"); // ví dụ: "quan_1"
  if (code && LOCATION_MAP[code]) {
    return LOCATION_MAP[code];
  }
  return null; // không có tham số, hoặc mã không tồn tại trong LOCATION_MAP
}

function applyLocationToForm() {
  const resolvedName = resolveLocationFromURL();

  if (resolvedName) {
    locationDisplay.value = resolvedName;
    fields.location.value = resolvedName;
    locationDisplay.classList.remove("invalid");
    document.getElementById("locationError").textContent = "";
  } else {
    locationDisplay.value = UNKNOWN_LOCATION_TEXT;
    fields.location.value = "";
    locationDisplay.classList.add("invalid");
    document.getElementById("locationError").textContent =
      "Vui lòng nhờ tình nguyện viên quét lại mã QR tại quầy phát đồ ăn.";
  }
}

// Chạy 1 lần lúc trang vừa tải: hiện chữ "Đang tải...", gọi Google Sheet, rồi mới điền quán ăn
async function initLocationField() {
  locationDisplay.value = LOADING_LOCATION_TEXT;
  submitBtn.disabled = true;

  await loadLocationMap();

  submitBtn.disabled = false;
  applyLocationToForm();
}

initLocationField();

/* ---------- KIỂM TRA DỮ LIỆU (VALIDATION) ---------- */

function showFieldError(field, message) {
  field.classList.add("invalid");
  const errorEl = document.getElementById(field.id + "Error");
  if (errorEl) errorEl.textContent = message;
}

function clearFieldError(field) {
  field.classList.remove("invalid");
  const errorEl = document.getElementById(field.id + "Error");
  if (errorEl) errorEl.textContent = "";
}

function clearAllErrors() {
  [fields.fullName, fields.phone].forEach(clearFieldError);
}

function validateForm() {
  clearAllErrors();
  let isValid = true;

  // Họ và tên: bắt buộc, ít nhất 2 ký tự
  const nameValue = fields.fullName.value.trim();
  if (nameValue.length < 2) {
    showFieldError(fields.fullName, "Vui lòng nhập họ và tên đầy đủ.");
    isValid = false;
  }

  // Số điện thoại Việt Nam: 10 số, bắt đầu bằng 0
  const phoneValue = fields.phone.value.trim();
  const phoneRegex = /^0\d{9}$/;
  if (!phoneRegex.test(phoneValue)) {
    showFieldError(fields.phone, "Số điện thoại phải có 10 số, bắt đầu bằng số 0.");
    isValid = false;
  }

  // Quán ăn: phải được xác định tự động từ mã QR, không cho gửi nếu chưa rõ
  if (!fields.location.value) {
    locationDisplay.classList.add("invalid");
    document.getElementById("locationError").textContent =
      "Không xác định được điểm phát đồ ăn. Vui lòng nhờ tình nguyện viên quét lại mã QR.";
    isValid = false;
  } else {
    locationDisplay.classList.remove("invalid");
    document.getElementById("locationError").textContent = "";
  }

  return isValid;
}

// Chỉ cho phép nhập số vào ô điện thoại
fields.phone.addEventListener("input", () => {
  fields.phone.value = fields.phone.value.replace(/\D/g, "");
});

/* ---------- GỬI DỮ LIỆU LÊN GOOGLE SHEETS ---------- */

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtnText.innerHTML = isLoading
    ? '<span class="spinner"></span>Đang gửi...'
    : "GỬI THÔNG TIN";
}

function showView(view) {
  form.style.display = view === "form" ? "block" : "none";
  successMessage.style.display = view === "success" ? "block" : "none";
  errorMessage.style.display = view === "error" ? "block" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function submitToGoogleSheets(data) {
  // Dùng Content-Type: text/plain và mode: no-cors để tránh lỗi CORS
  // khi gọi Google Apps Script Web App từ trình duyệt.
  await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(data),
  });
  // Lưu ý: với mode "no-cors", trình duyệt không cho đọc nội dung phản hồi.
  // Nếu fetch không báo lỗi mạng, ta coi như đã gửi thành công.
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (GOOGLE_SCRIPT_URL.includes("DÁN_URL_WEB_APP")) {
    alert(
      "Bạn chưa cấu hình đường dẫn Google Apps Script.\n" +
      "Vui lòng mở file script.js và làm theo README.md, Phần 3."
    );
    return;
  }

  if (!validateForm()) return;

  const data = {
    fullName: fields.fullName.value.trim(),
    phone: fields.phone.value.trim(),
    location: fields.location.value,
    submittedAt: new Date().toISOString(),
  };

  setLoading(true);

  try {
    await submitToGoogleSheets(data);
    showView("success");
    form.reset();
    applyLocationToForm(); // form.reset() xóa ô quán ăn -> điền lại (không cần tải lại Sheet)
  } catch (err) {
    console.error("Lỗi khi gửi form:", err);
    showView("error");
  } finally {
    setLoading(false);
  }
});

registerAgainBtn.addEventListener("click", () => {
  showView("form");
});

tryAgainBtn.addEventListener("click", () => {
  showView("form");
});
