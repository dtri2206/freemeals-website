// "misaigon" — JSON API cho app di động "Mì Sài Gòn".
//
// Đây chỉ là một lớp DỊCH mỏng: app gửi lên đúng khuôn dạng đã thống nhất
// (ma_kh, mat_khau_quan, so_suat...), hàm này gọi 3 RPC Postgres đã có sẵn
// từ trước (get_member_info / get_member_history / checkin — cùng 3 hàm mà
// quet.js trên website đang dùng), rồi đổi tên field sang tiếng Việt cho
// app dùng thẳng. KHÔNG có logic nghiệp vụ mới nào ở đây — toàn bộ luật
// (giới hạn suất ăn/tháng, hash mật khẩu, chống brute-force...) vẫn nằm
// trong database, một chỗ duy nhất, dùng chung cho cả web lẫn app.
//
// Auth: deploy với verify_jwt = true (mặc định an toàn, xem
// supabase/config.toml) — app phải gắn header
// `Authorization: Bearer <anon key>` (đúng cái anon key đã public sẵn
// trong quet.js, không phải bí mật). Việc này chỉ để chặn người ngoài gọi
// mà không có key nào cả; checkin() vẫn tự kiểm tra mật khẩu + chặn
// brute-force ở tầng database như cũ, không phụ thuộc cờ này.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MEMBER_QR_BASE = "https://dtri2206.github.io/freemeals-website/quet.html";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Gọi 1 RPC qua PostgREST — giống hệt cách callRpc() trong quet.js gọi
// (cùng URL dạng /rest/v1/rpc/<tên hàm>, cùng key anon). Vì lớp này đứng
// giữa app và Postgres, PostgREST sẽ thấy "người gọi" là edge function
// chứ không phải điện thoại của khách — nếu không forward lại IP thật,
// bộ đếm chống brute-force trong checkin() sẽ đếm nhầm tất cả lượt gọi
// (từ mọi quán, mọi máy) vào chung một IP (IP của edge function), rồi
// khoá lẫn nhau. `forwardIp` sửa đúng chỗ này: gắn IP thật của app (đọc từ
// header x-forwarded-for mà chính edge function nhận được) vào request đi
// tiếp tới PostgREST, để request.headers bên trong checkin() thấy đúng IP
// gốc.
async function callRpc(fn: string, args: Record<string, unknown>, forwardIp?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (forwardIp) headers["x-forwarded-for"] = forwardIp;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    throw new Error(`${fn} -> HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function fmtVnTime(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

// -----------------------------------------------------------------------
// API 1 — POST /misaigon/memberInfo   { ma_kh }
// -----------------------------------------------------------------------
async function handleMemberInfo(body: Record<string, unknown>) {
  const ma_kh = String(body?.ma_kh ?? "").trim();
  if (!ma_kh) {
    return json({ result: "error", code: "bad_request", message: "Thiếu mã khách." }, 400);
  }

  const rows = await callRpc("get_member_info", { p_code: ma_kh });
  if (!rows.length) {
    return json({ result: "error", code: "member_not_found", message: "Không tìm thấy mã khách này." });
  }
  const r = rows[0];
  return json({
    result: "success",
    ma_kh: r.code,
    ho_ten: r.name,
    so_dien_thoai: r.phone,
    suat_duoc_cap: r.allowance,
    suat_con_lai: r.remaining,
    // Link QR thẻ thành viên — chỉ là URL cố định theo mã khách (giống hệt
    // QR đang in trên thẻ giấy), không phải dữ liệu lưu riêng trong DB.
    qr_link: `${MEMBER_QR_BASE}?kh=${encodeURIComponent(r.code)}`,
  });
}

// -----------------------------------------------------------------------
// API 2 — POST /misaigon/mealHistory   { ma_kh }
// -----------------------------------------------------------------------
async function handleMealHistory(body: Record<string, unknown>) {
  const ma_kh = String(body?.ma_kh ?? "").trim();
  if (!ma_kh) {
    return json({ result: "error", code: "bad_request", message: "Thiếu mã khách." }, 400);
  }

  const rows = await callRpc("get_member_history", { p_code: ma_kh });
  return json({
    result: "success",
    ma_kh,
    lich_su: rows.map((r: { created_at: string; location_name: string; portions: number }) => ({
      thoi_gian: fmtVnTime(r.created_at),
      ten_quan: r.location_name,
      so_suat: r.portions,
    })),
  });
}

// -----------------------------------------------------------------------
// API 3 — POST /misaigon/checkin   { ma_kh, mat_khau_quan, so_suat? }
//
// Dùng mật khẩu quán để xác định quán, giống hệt cơ chế checkin() hiện có
// (không cần mã quán riêng — mật khẩu tự khớp đúng quán qua bcrypt hash).
// so_suat bỏ trống thì mặc định 1 suất (do chính checkin() quyết định).
// -----------------------------------------------------------------------
async function handleCheckin(body: Record<string, unknown>, forwardIp: string | null) {
  const ma_kh = String(body?.ma_kh ?? "").trim();
  const mat_khau_quan = String(body?.mat_khau_quan ?? "");
  if (!ma_kh || !mat_khau_quan) {
    return json(
      { result: "error", code: "bad_request", message: "Thiếu mã khách hoặc mật khẩu quán." },
      400,
    );
  }

  const args: Record<string, unknown> = { p_member_code: ma_kh, p_password: mat_khau_quan };
  const so_suat = Number(body?.so_suat);
  if (Number.isFinite(so_suat)) args.p_portions = so_suat;

  const r = await callRpc("checkin", args, forwardIp);
  if (r.result !== "success") return json(r);

  return json({
    result: "success",
    ma_kh: r.member_code,
    ho_ten: r.member_name,
    ten_quan: r.location_name,
    so_suat: r.portions,
    suat_con_lai: r.remaining,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return json({ result: "error", code: "method_not_allowed", message: "Chỉ hỗ trợ POST." }, 405);
  }

  const path = new URL(req.url).pathname;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // body rỗng/không phải JSON -- các handler bên dưới tự báo thiếu field
  }

  try {
    if (path.endsWith("/memberInfo")) return await handleMemberInfo(body);
    if (path.endsWith("/mealHistory")) return await handleMealHistory(body);
    if (path.endsWith("/checkin")) {
      return await handleCheckin(body, req.headers.get("x-forwarded-for"));
    }
    return json({ result: "error", code: "not_found", message: "Không tìm thấy API." }, 404);
  } catch (e) {
    console.error(e);
    return json({ result: "error", code: "server_error", message: "Lỗi hệ thống." }, 500);
  }
});
