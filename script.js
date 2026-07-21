"use strict";

/* =====================================================
   CẤU HÌNH - THAY ĐỔI DÒNG NÀY SAU KHI TẠO GOOGLE APPS SCRIPT
   Xem hướng dẫn trong README.md, Phần 3.
   ===================================================== */
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySYWfz3_iIjoGyQylUkTS0MTKKxI2XSXW1KPUkxqv7cfYH_v1aWAs-PY2LLH9hX9bF/exec";

/* =====================================================
   DANH SÁCH QUÁN ĂN - MỖI QUÁN 1 MÃ RIÊNG DÙNG TRONG LINK QR
   Mỗi khi thêm quán mới, thêm 1 dòng vào đây với mã ngắn gọn,
   không dấu, không khoảng trắng (dùng làm giá trị ?location=...)
   Xem hướng dẫn tạo link/QR cho từng quán trong README.md, Phần 5.
   ===================================================== */
const LOCATION_MAP = {
  quan_1: "Quán Cơm Nụ Cười - Quận 1",
  quan_2: "Quán Cơm Nụ Cười - Quận 3",
  quan_3: "Quán Cơm Nụ Cười - Quận 4",
  quan_4: "Quán Cơm Nụ Cười - Quận 5",
  quan_5: "Quán Cơm Nụ Cười - Quận Bình Thạnh",
};

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
  birthDate: document.getElementById("birthDate"),
  phone: document.getElementById("phone"),
  location: document.getElementById("location"), // ô ẩn (hidden) chứa giá trị thật
};

/* ---------- ĐỌC QUÁN ĂN TỪ THAM SỐ TRÊN URL (MÃ QR) ---------- */

function resolveLocationFromURL() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("location"); // ví dụ: "quan_1"
  if (code && LOCATION_MAP[code]) {
    return LOCATION_MAP[code];
  }
  return null; // không có tham số, hoặc mã không tồn tại trong LOCATION_MAP
}

function initLocationField() {
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
  [fields.fullName, fields.birthDate, fields.phone].forEach(clearFieldError);
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

  // Ngày sinh: bắt buộc, phải là ngày trong quá khứ
  const birthValue = fields.birthDate.value;
  if (!birthValue) {
    showFieldError(fields.birthDate, "Vui lòng chọn ngày sinh.");
    isValid = false;
  } else {
    const birthDate = new Date(birthValue);
    const today = new Date();
    if (birthDate > today) {
      showFieldError(fields.birthDate, "Ngày sinh không hợp lệ.");
      isValid = false;
    }
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
    birthDate: fields.birthDate.value,
    phone: fields.phone.value.trim(),
    location: fields.location.value,
    submittedAt: new Date().toISOString(),
  };

  setLoading(true);

  try {
    await submitToGoogleSheets(data);
    showView("success");
    form.reset();
    initLocationField(); // form.reset() xóa ô quán ăn -> điền lại từ URL cho lần đăng ký tiếp theo
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
