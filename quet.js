"use strict";

// ===== Supabase (Giai đoạn 3 — trang quét đọc/ghi trực tiếp trên Supabase) =====
// URL + anon key là công khai, an toàn khi để lộ trong file này (giống GOOGLE_SCRIPT_URL trước đây).
// Mọi thao tác đi qua 3 RPC: get_member_info, get_member_history, checkin.
const SUPABASE_URL = "https://dqgjnqeqwsijnsphpzqt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2pucWVxd3Npam5zcGhwenF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjUzNTEsImV4cCI6MjEwMzUwMTM1MX0.eJpR_qUIGLfZHylI5yoIngAtUr0qYpKLpHH9oKPIhZ4";

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

/**
 * Gọi 1 RPC Supabase qua PostgREST. Trả về JSON đã parse.
 * Ném lỗi khi mạng hỏng hoặc HTTP != 2xx (để nhánh catch xử lý).
 */
async function callRpc(fnName, args) {
  const response = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args || {}),
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const msg = (data && (data.message || data.hint)) || `Lỗi máy chủ (${response.status}).`;
    throw new Error(msg);
  }
  return data;
}

/** ISO timestamp -> "dd/MM/yyyy HH:mm" theo giờ Việt Nam. */
function formatDateTimeVN(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

async function init() {
  if (!memberCode) {
    loadErrorText.textContent = "Link này thiếu mã khách. Vui lòng nhờ khách đưa đúng thẻ QR để quét lại.";
    showView(loadErrorView);
    return;
  }

  try {
    // get_member_info trả về mảng: [] nếu không có/đã ngưng, hoặc [{ code, name, allowance, used_this_month, remaining }]
    const rows = await callRpc("get_member_info", { p_code: memberCode });

    if (!Array.isArray(rows) || rows.length === 0) {
      loadErrorText.textContent = "Không tìm thấy khách này (hoặc thẻ đã ngưng sử dụng).";
      showView(loadErrorView);
      return;
    }

    currentMember = rows[0];
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
    // get_member_history trả về mảng [{ id, location_name, portions, created_at }]
    const rows = await callRpc("get_member_history", { p_code: currentMember.code });

    if (Array.isArray(rows) && rows.length > 0) {
      rows.forEach((item) => {
        const row = document.createElement("div");
        row.className = "history-item";

        const dateEl = document.createElement("div");
        dateEl.className = "history-date";
        dateEl.textContent = formatDateTimeVN(item.created_at);

        const locEl = document.createElement("div");
        locEl.className = "history-location";
        locEl.textContent =
          item.portions > 1 ? `${item.location_name} (${item.portions} suất)` : item.location_name;

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
    // checkin trả về object { result: 'success' | 'error', ... }
    const result = await callRpc("checkin", {
      p_member_code: currentMember.code,
      p_password: password,
      p_portions: 1,
    });

    if (result && result.result === "success") {
      localStorage.setItem(PASSWORD_STORAGE_KEY, password);
      resultSuccessText.textContent =
        "Đã ghi nhận " + result.portions + " suất ăn cho khách hàng " + result.member_name +
        " tại quán " + result.location_name + ".";
      showView(resultSuccessView);
    } else {
      passwordError.textContent = (result && result.message) || "Có lỗi xảy ra, vui lòng thử lại.";
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
