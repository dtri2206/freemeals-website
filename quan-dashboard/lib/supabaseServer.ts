// Mọi gọi tới Supabase từ server Next.js này đi qua 2 đường:
//  - anon key + RPC quan_login(): dùng để verify mã quán + mật khẩu (xem
//    migration quan_login_rpc.sql) — RPC tự rate-limit theo IP, giống checkin().
//  - service_role key (biến môi trường, không bao giờ gửi ra browser): dùng
//    để đọc dữ liệu (theo dõi theo ngày, báo cáo) SAU KHI đã xác thực qua cookie
//    session — luôn tự lọc theo session.code ở phía server, không bao giờ
//    tin mã quán do client gửi lên cho các API này.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name}.`);
  return value;
}

export function getClientIp(request: Request): string | null {
  // Vercel đặt x-forwarded-for ở edge với IP thật của client ở vị trí đầu
  // tiên; không tin bất kỳ giá trị nào client tự gửi thêm vào vì Vercel
  // ghi đè header này trước khi request tới hàm serverless.
  const header = request.headers.get("x-forwarded-for");
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first || null;
}

type RpcResult<T> = { result: "success"; [key: string]: unknown } & T;
type RpcError = { result: "error"; code: string; message: string };

export async function callAnonRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  clientIp: string | null
): Promise<RpcResult<T> | RpcError> {
  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
  if (clientIp) headers["x-forwarded-for"] = clientIp;

  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`${fn} -> HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** GET qua PostgREST bằng service_role key. query là phần sau "?" (đã encode). */
export async function serviceSelect<T>(path: string, query: string): Promise<T> {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const res = await fetch(`${url}/rest/v1/${path}?${query}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GET ${path} -> HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
