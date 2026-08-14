"use strict";

/* =====================================================
   CẤU HÌNH - PHẢI DÙNG ĐÚNG URL GIỐNG HỆT TRONG script.js
   ===================================================== */
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySYWfz3_iIjoGyQylUkTS0MTKKxI2XSXW1KPUkxqv7cfYH_v1aWAs-PY2LLH9hX9bF/exec";

// Chỉ để tự điền sẵn mật khẩu lần gõ gần nhất cho đỡ phải gõ lại - KHÔNG phải phiên đăng nhập,
// chủ quán vẫn phải tự xác nhận (bấm nộp) ở mỗi lượt.
const PASSWORD_STORAGE_KEY = "quet_last_password";

/* ---------- ĐỌC MÃ KHÁCH TỪ URL (?kh=kh_0001) ---------- */
const params = new URLSearchParams(window.location.search);
const memberCode = params.get("kh");

/* ---------- ELEMENTS ---------- */
const memberConfirmView = document.getElementById("memberConfirmView");
const loadErrorView = document.getElementById("loadErrorView");
const loadErrorText = document.getElementById("loadErrorText");
const resultSuccessView = document.getElementById("resultSuccessView");
const resultErrorView = document.getElementById("resultErrorView");

const confirmDateTime = document.getElementById("confirmDateTime");
const confirmMemberName = document.getElementById("confirmMemberName");
const confirmRemaining = document.getElementById("confirmRemaining");
const portionBtn1 = document.getElementById("portionBtn1");
const portionBtn2 = document.getElementById("portionBtn2");

const quanPasswordInput = document.getElementById("quanPassword");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const passwordError = document.getElementById("passwordError");
const confirmSubmitBtn = document.getElementById("confirmSubmitBtn");

const resultSuccessText = document.getElementById("resultSuccessText");
const resultErrorText = document.getElementById("resultErrorText");
const tryAgainBtn = document.getElementById("tryAgainBtn");

let currentMember = null; // { code, name, allowance, usedToday, remaining }
let selectedPortions = null;

/* ---------- CHUYỂN MÀN HÌNH ---------- */
function showView(viewEl) {
  [memberConfirmView, loadErrorView, resultSuccessView, resultErrorView].forEach((v) => {
    v.style.display = v === viewEl ? "block" : "none";
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- GỌI MẠNG CÓ TỰ THỬ LẠI (mạng ở quán hay chập chờn) ---------- */
async function fetchWithRetry(url, options, retries = 3, delayMs = 1500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/* ---------- TẢI THÔNG TIN KHÁCH LÚC VỪA MỞ TRANG ---------- */
async function init() {
  if (!memberCode) {
    loadErrorText.textContent = "Link này thiếu mã khách. Vui lòng nhờ khách đưa đúng thẻ QR để quét lại.";
    showView(loadErrorView);
    return;
  }

  try {
    // Thêm "&_=..." để trình duyệt không lấy kết quả cũ từ cache
    const url = GOOGLE_SCRIPT_URL + "?action=member&code=" + encodeURIComponent(memberCode) + "&_=" + Date.now();
    const response = await fetchWithRetry(url, { cache: "no-store" });
    const result = await response.json();

    if (result.result !== "success") {
      loadErrorText.textContent = result.message || "Không tìm thấy khách này.";
      showView(loadErrorView);
      return;
    }

    currentMember = result.member;
    showMemberConfirm();
  } catch (err) {
    console.error(err);
    loadErrorText.textContent = "Lỗi kết nối mạng. Vui lòng tải lại trang để thử lại.";
    showView(loadErrorView);
  }
}

init();

/* ---------- MÀN HÌNH XÁC NHẬN + CHỌN SUẤT ---------- */
function showMemberConfirm() {
  confirmDateTime.textContent = new Date().toLocaleString("vi-VN");
  confirmMemberName.textContent = currentMember.name;
  confirmRemaining.textContent = currentMember.remaining + " suất";

  selectedPortions = null;
  portionBtn1.classList.remove("selected");
  portionBtn2.classList.remove("selected");
  portionBtn1.disabled = currentMember.remaining < 1;
  portionBtn2.disabled = currentMember.remaining < 2;
  confirmSubmitBtn.disabled = true;
  passwordError.textContent = "";

  const savedPassword = localStorage.getItem(PASSWORD_STORAGE_KEY);
  if (savedPassword) {
    quanPasswordInput.value = savedPassword;
  }

  showView(memberConfirmView);
}

function selectPortions(n) {
  selectedPortions = n;
  portionBtn1.classList.toggle("selected", n === 1);
  portionBtn2.classList.toggle("selected", n === 2);
  confirmSubmitBtn.disabled = false;
}

portionBtn1.addEventListener("click", () => selectPortions(1));
portionBtn2.addEventListener("click", () => selectPortions(2));

togglePasswordBtn.addEventListener("click", () => {
  const isHidden = quanPasswordInput.type === "password";
  quanPasswordInput.type = isHidden ? "text" : "password";
  togglePasswordBtn.textContent = isHidden ? "\u{1F513}" : "\u{1F512}"; // 🔓 : 🔒
});

/* ---------- NỘP THÔNG TIN LÊN GOOGLE SHEET ---------- */
confirmSubmitBtn.addEventListener("click", async () => {
  passwordError.textContent = "";

  if (!selectedPortions) return;

  const password = quanPasswordInput.value;
  if (!password) {
    passwordError.textContent = "Chưa nhập mật khẩu.";
    return;
  }

  confirmSubmitBtn.disabled = true;

  try {
    const response = await fetchWithRetry(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "checkin",
        memberCode: currentMember.code,
        portions: selectedPortions,
        password: password,
      }),
    });
    const result = await response.json();

    if (result.result === "success") {
      localStorage.setItem(PASSWORD_STORAGE_KEY, password);
      resultSuccessText.textContent =
        "Đã ghi nhận " + selectedPortions + " suất ăn cho khách hàng " + result.memberName +
        " tại quán " + result.locationName + ".";
      showView(resultSuccessView);
    } else {
      // Lỗi mật khẩu/hạn mức - hiện ngay tại chỗ để chủ quán sửa và nộp lại, không cần tải lại trang
      passwordError.textContent = result.message || "Có lỗi xảy ra, vui lòng thử lại.";
      confirmSubmitBtn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    resultErrorText.textContent = "Lỗi kết nối mạng. Vui lòng tải lại trang và thử lại.";
    showView(resultErrorView);
  }
});

tryAgainBtn.addEventListener("click", () => {
  window.location.reload();
});
