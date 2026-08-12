"use strict";

/* =====================================================
   CẤU HÌNH - PHẢI DÙNG ĐÚNG URL GIỐNG HỆT TRONG script.js
   ===================================================== */
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySYWfz3_iIjoGyQylUkTS0MTKKxI2XSXW1KPUkxqv7cfYH_v1aWAs-PY2LLH9hX9bF/exec";

/* ---------- ĐỌC MÃ QUÁN TỪ URL (?quan=quan_1) ---------- */
const params = new URLSearchParams(window.location.search);
const quanCode = params.get("quan");

if (!quanCode) {
  document.body.innerHTML =
    '<main class="container"><div class="card error-card">' +
    "<h2>Thiếu Mã Quán</h2>" +
    "<p>Link này cần có dạng <code>quet.html?quan=ma_quan</code>. Vui lòng liên hệ quỹ để lấy đúng link riêng của quán.</p>" +
    "</div></main>";
  throw new Error("Missing quan code in URL");
}

const STORAGE_KEY = "quet_logged_in_" + quanCode;

/* ---------- ELEMENTS ---------- */
const quanNameHeader = document.getElementById("quanNameHeader");

const loginView = document.getElementById("loginView");
const scannerView = document.getElementById("scannerView");
const memberConfirmView = document.getElementById("memberConfirmView");
const resultSuccessView = document.getElementById("resultSuccessView");
const resultErrorView = document.getElementById("resultErrorView");

const loginPasswordInput = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginPasswordError = document.getElementById("loginPasswordError");
const toggleLoginPasswordBtn = document.getElementById("toggleLoginPasswordBtn");

const logoutBtn = document.getElementById("logoutBtn");
const startScanBtn = document.getElementById("startScanBtn");
const cancelScanBtn = document.getElementById("cancelScanBtn");
const scanError = document.getElementById("scanError");

const confirmDateTime = document.getElementById("confirmDateTime");
const confirmMemberName = document.getElementById("confirmMemberName");
const confirmQuanName = document.getElementById("confirmQuanName");
const confirmRemaining = document.getElementById("confirmRemaining");
const portionBtn1 = document.getElementById("portionBtn1");
const portionBtn2 = document.getElementById("portionBtn2");
const confirmSubmitBtn = document.getElementById("confirmSubmitBtn");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmError = document.getElementById("confirmError");

const resultSuccessText = document.getElementById("resultSuccessText");
const scanAgainBtn = document.getElementById("scanAgainBtn");
const resultErrorText = document.getElementById("resultErrorText");
const tryAgainScanBtn = document.getElementById("tryAgainScanBtn");

let quanInfo = null; // { code, name, password, dailyLimit }
let currentMember = null; // { code, name, allowance, usedToday, remaining }
let selectedPortions = null;
let html5QrCode = null;

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

/* ---------- CHUYỂN MÀN HÌNH ---------- */
function showView(viewEl) {
  [loginView, scannerView, memberConfirmView, resultSuccessView, resultErrorView].forEach((v) => {
    v.style.display = v === viewEl ? "block" : "none";
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- TẢI THÔNG TIN QUÁN LÚC MỞ TRANG ---------- */
async function loadQuanInfo() {
  const response = await fetchWithRetry(GOOGLE_SCRIPT_URL);
  const result = await response.json();
  const found = (result.locations || []).find((loc) => loc.code === quanCode);
  if (!found) {
    throw new Error("Không tìm thấy quán với mã: " + quanCode);
  }
  return found;
}

async function init() {
  try {
    quanInfo = await loadQuanInfo();
    quanNameHeader.textContent = quanInfo.name;

    const loggedIn = localStorage.getItem(STORAGE_KEY) === "true";
    showView(loggedIn ? scannerView : loginView);
  } catch (err) {
    console.error(err);
    document.body.innerHTML =
      '<main class="container"><div class="card error-card">' +
      "<h2>Không Tải Được Thông Tin Quán</h2>" +
      "<p>Vui lòng kiểm tra kết nối mạng rồi tải lại trang. Nếu vẫn lỗi, liên hệ quỹ để kiểm tra lại mã quán.</p>" +
      "</div></main>";
  }
}

init();

/* ---------- ĐĂNG NHẬP ---------- */
toggleLoginPasswordBtn.addEventListener("click", () => {
  const isHidden = loginPasswordInput.type === "password";
  loginPasswordInput.type = isHidden ? "text" : "password";
  toggleLoginPasswordBtn.textContent = isHidden ? "\u{1F513}" : "\u{1F512}"; // 🔓 : 🔒
});

loginBtn.addEventListener("click", () => {
  loginPasswordError.textContent = "";
  const value = loginPasswordInput.value;

  if (!value) {
    loginPasswordError.textContent = "Chưa nhập mật khẩu.";
    return;
  }
  if (value !== quanInfo.password) {
    loginPasswordError.textContent = "Mật khẩu không đúng.";
    return;
  }

  localStorage.setItem(STORAGE_KEY, "true");
  loginPasswordInput.value = "";
  showView(scannerView);
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  showView(loginView);
});

/* ---------- QUÉT MÃ QR ---------- */
startScanBtn.addEventListener("click", startScanning);
cancelScanBtn.addEventListener("click", stopScanning);

function startScanning() {
  scanError.textContent = "";
  startScanBtn.style.display = "none";
  cancelScanBtn.style.display = "block";

  html5QrCode = new Html5Qrcode("qrReader");
  html5QrCode
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      onScanSuccess,
      () => {} // lỗi từng khung hình quét trượt - bỏ qua, không cần báo mỗi lần
    )
    .catch((err) => {
      console.error(err);
      scanError.textContent = "Không mở được camera. Vui lòng cấp quyền camera cho trình duyệt rồi thử lại.";
      stopScanning();
    });
}

function stopScanning() {
  startScanBtn.style.display = "block";
  cancelScanBtn.style.display = "none";
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
    html5QrCode = null;
  }
}

async function onScanSuccess(decodedText) {
  stopScanning();

  let memberCode;
  try {
    const url = new URL(decodedText);
    memberCode = url.searchParams.get("kh");
  } catch (e) {
    memberCode = decodedText.trim(); // QR chỉ chứa mã thô, không phải link đầy đủ
  }

  if (!memberCode) {
    scanError.textContent = "Mã QR không hợp lệ. Vui lòng quét đúng thẻ khách ăn.";
    return;
  }

  await lookupMember(memberCode);
}

async function lookupMember(code) {
  scanError.textContent = "Đang tra cứu...";
  try {
    const response = await fetchWithRetry(GOOGLE_SCRIPT_URL + "?action=member&code=" + encodeURIComponent(code));
    const result = await response.json();

    if (result.result !== "success") {
      scanError.textContent = result.message || "Không tìm thấy khách này.";
      return;
    }

    scanError.textContent = "";
    currentMember = result.member;
    showMemberConfirm();
  } catch (err) {
    console.error(err);
    scanError.textContent = "Lỗi kết nối, vui lòng thử lại.";
  }
}

/* ---------- MÀN HÌNH XÁC NHẬN + CHỌN SUẤT ---------- */
function showMemberConfirm() {
  confirmDateTime.textContent = new Date().toLocaleString("vi-VN");
  confirmMemberName.textContent = currentMember.name;
  confirmQuanName.textContent = quanInfo.name;
  confirmRemaining.textContent = currentMember.remaining + " suất";

  selectedPortions = null;
  portionBtn1.classList.remove("selected");
  portionBtn2.classList.remove("selected");
  portionBtn1.disabled = currentMember.remaining < 1;
  portionBtn2.disabled = currentMember.remaining < 2;
  confirmSubmitBtn.disabled = true;
  confirmError.textContent = "";

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

confirmCancelBtn.addEventListener("click", () => {
  currentMember = null;
  showView(scannerView);
});

/* ---------- NỘP THÔNG TIN LÊN GOOGLE SHEET ---------- */
confirmSubmitBtn.addEventListener("click", async () => {
  if (!selectedPortions) return;

  confirmSubmitBtn.disabled = true;
  confirmError.textContent = "";

  try {
    const response = await fetchWithRetry(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "checkin",
        locationCode: quanCode,
        locationPassword: quanInfo.password,
        memberCode: currentMember.code,
        portions: selectedPortions,
      }),
    });
    const result = await response.json();

    if (result.result === "success") {
      resultSuccessText.textContent =
        "Đã ghi nhận " + selectedPortions + " suất cho " + result.memberName +
        ". Khách còn lại " + result.memberRemaining + " suất hôm nay.";
      showView(resultSuccessView);
    } else {
      resultErrorText.textContent = result.message || "Có lỗi xảy ra, vui lòng thử lại.";
      showView(resultErrorView);
    }
  } catch (err) {
    console.error(err);
    resultErrorText.textContent = "Lỗi kết nối mạng. Vui lòng kiểm tra và thử lại.";
    showView(resultErrorView);
  } finally {
    confirmSubmitBtn.disabled = false;
  }
});

scanAgainBtn.addEventListener("click", () => {
  currentMember = null;
  showView(scannerView);
});

tryAgainScanBtn.addEventListener("click", () => {
  currentMember = null;
  showView(scannerView);
});
