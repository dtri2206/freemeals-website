"use strict";

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySYWfz3_iIjoGyQylUkTS0MTKKxI2XSXW1KPUkxqv7cfYH_v1aWAs-PY2LLH9hX9bF/exec";

const PASSWORD_STORAGE_KEY = "quet_last_password";

const params = new URLSearchParams(window.location.search);
const memberCode = params.get("kh");

const memberConfirmView = document.getElementById("memberConfirmView");
const historyView = document.getElementById("historyView");
const loadErrorView = document.getElementById("loadErrorView");
const loadErrorText = document.getElementById("loadErrorText");
const resultSuccessView = document.getElementById("resultSuccessView");
const resultErrorView = document.getElementById("resultErrorView");

const remainingHero = document.getElementById("remainingHero");
const confirmRemaining = document.getElementById("confirmRemaining");

const viewHistoryBtn = document.getElementById("viewHistoryBtn");
const backFromHistoryBtn = document.getElementById("backFromHistoryBtn");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");

const quanPasswordInput = document.getElementById("quanPassword");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const passwordError = document.getElementById("passwordError");
const confirmSubmitBtn = document.getElementById("confirmSubmitBtn");

const resultSuccessText = document.getElementById("resultSuccessText");
const resultErrorText = document.getElementById("resultErrorText");
const tryAgainBtn = document.getElementById("tryAgainBtn");

let currentMember = null;

function showView(viewEl) {
  [memberConfirmView, historyView, loadErrorView, resultSuccessView, resultErrorView].forEach((v) => {
    v.style.display = v === viewEl ? "block" : "none";
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

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

async function init() {
  if (!memberCode) {
    loadErrorText.textContent = "Link này thiếu mã khách. Vui lòng nhờ khách đưa đúng thẻ QR để quét lại.";
    showView(loadErrorView);
    return;
  }

  try {
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

function showMemberConfirm() {
  confirmRemaining.textContent = currentMember.remaining;

  passwordError.textContent = "";

  if (currentMember.remaining < 1) {
    remainingHero.classList.add("empty");
    confirmSubmitBtn.disabled = true;
    passwordError.textContent = "Khách đã dùng hết suất ăn tháng này.";
  } else {
    remainingHero.classList.remove("empty");
    confirmSubmitBtn.disabled = false;
  }

  const savedPassword = localStorage.getItem(PASSWORD_STORAGE_KEY);
  if (savedPassword) {
    quanPasswordInput.value = savedPassword;
  }

  showView(memberConfirmView);
}

togglePasswordBtn.addEventListener("click", () => {
  const isHidden = quanPasswordInput.type === "password";
  quanPasswordInput.type = isHidden ? "text" : "password";
  togglePasswordBtn.textContent = isHidden ? "\u{1F513}" : "\u{1F512}";
});

viewHistoryBtn.addEventListener("click", async () => {
  historyList.innerHTML = "";
  historyEmpty.style.display = "none";
  showView(historyView);

  try {
    const url = GOOGLE_SCRIPT_URL + "?action=history&code=" + encodeURIComponent(currentMember.code) + "&_=" + Date.now();
    const response = await fetchWithRetry(url, { cache: "no-store" });
    const result = await response.json();

    if (result.result === "success" && result.history && result.history.length > 0) {
      result.history.forEach((item) => {
        const row = document.createElement("div");
        row.className = "history-item";

        const dateEl = document.createElement("div");
        dateEl.className = "history-date";
        dateEl.textContent = item.date;

        const locEl = document.createElement("div");
        locEl.className = "history-location";
        locEl.textContent = item.locationName;

        row.appendChild(dateEl);
        row.appendChild(locEl);
        historyList.appendChild(row);
      });
    } else {
      historyEmpty.textContent = "Chưa có lượt ăn nào trong tháng này.";
      historyEmpty.style.display = "block";
    }
  } catch (err) {
    console.error(err);
    historyEmpty.textContent = "Lỗi kết nối mạng, vui lòng thử lại.";
    historyEmpty.style.display = "block";
  }
});

backFromHistoryBtn.addEventListener("click", () => {
  showView(memberConfirmView);
});

confirmSubmitBtn.addEventListener("click", async () => {
  passwordError.textContent = "";

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
        portions: 1,
        password: password,
      }),
    });
    const result = await response.json();

    if (result.result === "success") {
      localStorage.setItem(PASSWORD_STORAGE_KEY, password);
      resultSuccessText.textContent =
        "Đã ghi nhận 1 suất ăn cho khách hàng " + result.memberName +
        " tại quán " + result.locationName + ".";
      showView(resultSuccessView);
    } else {
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
