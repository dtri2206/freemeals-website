"use strict";

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySYWfz3_iIjoGyQylUkTS0MTKKxI2XSXW1KPUkxqv7cfYH_v1aWAs-PY2LLH9hX9bF/exec";

let LOCATION_MAP = {};
let currentLocationCode = null;

const LOADING_LOCATION_TEXT = "Đang tải thông tin quán ăn...";
const UNKNOWN_LOCATION_TEXT = "Chưa xác định điểm phát đồ ăn";

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
  location: document.getElementById("location"),
  staffPassword: document.getElementById("staffPassword"),
};

async function loadLocationMap() {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const result = await response.json();
    const map = {};
    (result.locations || []).forEach((item) => {
      if (item.code) {
        map[item.code] = { name: item.name };
      }
    });
    LOCATION_MAP = map;
  } catch (err) {
    console.error("Không tải được danh sách quán ăn:", err);
    LOCATION_MAP = {};
  }
}

function resolveLocationFromURL() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("location");
  if (code && LOCATION_MAP[code]) {
    return code;
  }
  return null;
}

function applyLocationToForm() {
  currentLocationCode = resolveLocationFromURL();

  if (currentLocationCode) {
    const info = LOCATION_MAP[currentLocationCode];
    locationDisplay.textContent = info.name;
    fields.location.value = info.name;
    locationDisplay.classList.remove("invalid");
    document.getElementById("locationError").textContent = "";
  } else {
    locationDisplay.textContent = UNKNOWN_LOCATION_TEXT;
    fields.location.value = "";
    locationDisplay.classList.add("invalid");
    document.getElementById("locationError").textContent =
      "Vui lòng nhờ tình nguyện viên quét lại mã QR tại quầy phát đồ ăn.";
  }
}

async function initLocationField() {
  locationDisplay.textContent = LOADING_LOCATION_TEXT;
  submitBtn.disabled = true;

  await loadLocationMap();

  submitBtn.disabled = false;
  applyLocationToForm();
}

initLocationField();

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
  [fields.fullName, fields.phone, fields.staffPassword].forEach(clearFieldError);
}

function validateForm() {
  clearAllErrors();
  let isValid = true;

  const nameValue = fields.fullName.value.trim();
  if (nameValue.length < 2) {
    showFieldError(fields.fullName, "Vui lòng nhập họ và tên đầy đủ.");
    isValid = false;
  }

  const phoneValue = fields.phone.value.trim();
  const phoneRegex = /^0\d{9}$/;
  if (!phoneRegex.test(phoneValue)) {
    showFieldError(fields.phone, "Số điện thoại phải có 10 số, bắt đầu bằng số 0.");
    isValid = false;
  }

  if (!fields.location.value) {
    locationDisplay.classList.add("invalid");
    document.getElementById("locationError").textContent =
      "Không xác định được điểm phát đồ ăn. Vui lòng nhờ tình nguyện viên quét lại mã QR.";
    isValid = false;
  } else {
    locationDisplay.classList.remove("invalid");
    document.getElementById("locationError").textContent = "";
  }

  if (!fields.staffPassword.value) {
    showFieldError(fields.staffPassword, "Chưa nhập mật khẩu.");
    isValid = false;
  }

  return isValid;
}

fields.phone.addEventListener("input", () => {
  fields.phone.value = fields.phone.value.replace(/\D/g, "");
});

const togglePasswordBtn = document.getElementById("togglePasswordBtn");
togglePasswordBtn.addEventListener("click", () => {
  const isHidden = fields.staffPassword.type === "password";
  fields.staffPassword.type = isHidden ? "text" : "password";
  togglePasswordBtn.textContent = isHidden ? "\u{1F513}" : "\u{1F512}";
  togglePasswordBtn.setAttribute("aria-label", isHidden ? "Ẩn mật khẩu" : "Hiện mật khẩu");
  togglePasswordBtn.setAttribute("aria-pressed", isHidden ? "true" : "false");
});

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
  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(data),
  });
  return response.json();
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
    locationCode: currentLocationCode,
    password: fields.staffPassword.value,
    submittedAt: new Date().toISOString(),
  };

  setLoading(true);

  try {
    const result = await submitToGoogleSheets(data);

    if (result.result === "success") {
      showView("success");
      form.reset();
      applyLocationToForm();
    } else {
      showFieldError(fields.staffPassword, result.message || "Có lỗi xảy ra, vui lòng thử lại.");
    }
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
