import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { serviceSelect } from "@/lib/supabaseServer";

type ReportRow = {
  day: string;
  member_code: string;
  member_name: string;
  portions: number;
  check_in_times: string;
  location_name?: string | null;
};

function vnParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  return Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>;
}

function vnDay(iso: string): string {
  const p = vnParts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

function vnDateTime(iso: string): string {
  const p = vnParts(iso);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

type MealLogJoinRow = {
  created_at: string;
  portions: number;
  member_code: string;
  location_code?: string;
  members?: { name: string } | null;
  locations?: { name: string } | null;
};

/**
 * Doc truc tiep tu meal_log (khong qua view report_daily_member_detail nua)
 * de loc duoc theo KHOANG THOI GIAN CHINH XAC (ca gio/phut), khong chi theo
 * ngay lich nhu truoc -- vd "tu 14:00 10/10 den 03:00 19/10". Tu gom nhom lai
 * theo (ngay VN, ma khach [, ma quan neu admin xem tat ca]) giong nhu view
 * cu tung lam, nhung tren dung khoang thoi gian nguoi dung chon.
 *
 * locationCode = null khi admin xem tat ca quan (khong loc location_code,
 * embed them locations(name) de phan biet quan).
 */
async function fetchMemberRows(
  locationCode: string | null,
  fromIso: string,
  toIso: string
): Promise<ReportRow[]> {
  const query = [
    locationCode
      ? "select=created_at,portions,member_code,members(name)"
      : "select=created_at,portions,member_code,location_code,members(name),locations(name)",
    ...(locationCode ? [`location_code=eq.${encodeURIComponent(locationCode)}`] : []),
    `created_at=gte.${encodeURIComponent(fromIso)}`,
    `created_at=lte.${encodeURIComponent(toIso)}`,
    "order=created_at.asc",
    "limit=20000",
  ].join("&");

  const rows = await serviceSelect<MealLogJoinRow[]>("meal_log", query);

  const groups = new Map<
    string,
    { member_code: string; member_name: string; portions: number; times: string[]; location_name?: string | null }
  >();

  for (const r of rows) {
    const day = vnDay(r.created_at);
    const key = locationCode ? `${day}|${r.member_code}` : `${day}|${r.member_code}|${r.location_code}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        member_code: r.member_code,
        member_name: r.members?.name ?? r.member_code,
        portions: 0,
        times: [],
        location_name: r.locations?.name ?? null,
      };
      groups.set(key, g);
    }
    g.portions += r.portions;
    g.times.push(vnDateTime(r.created_at));
  }

  return Array.from(groups.entries()).map(([key, g]) => ({
    day: key.split("|")[0],
    member_code: g.member_code,
    member_name: g.member_name,
    portions: g.portions,
    check_in_times: g.times.join(", "),
    location_name: g.location_name,
  }));
}

// TAM THOI (khuyen mai dang ky) -- suat an vang lai gop vao bao cao xuat theo
// ngay. Xoa ca khoi nay (type CasualSignupRow + ham fetchCasualRows + doan
// goi/merge trong GET ben duoi) khi het dot khuyen mai.
type CasualSignupRow = {
  full_name: string;
  phone: string | null;
  registered_at: string;
  locations?: { name: string } | null;
};

/**
 * Suat an vang lai trong dung khoang [fromIso, toIso] (cung mot khoang thoi
 * gian chinh xac nguoi dung chon cho bao cao thanh vien ben tren, khong rieng
 * theo ngay lich). Ghep vao bang bao cao duoi dang 1 dong = 1 suat, "Ma khach"
 * ghi "Vang lai" de phan biet voi khach Thanh Vien thuc.
 */
async function fetchCasualRows(
  locationCode: string | null,
  fromIso: string,
  toIso: string
): Promise<ReportRow[]> {
  const query = [
    locationCode ? "select=full_name,phone,registered_at" : "select=full_name,phone,registered_at,locations(name)",
    ...(locationCode ? [`location_code=eq.${encodeURIComponent(locationCode)}`] : []),
    `registered_at=gte.${encodeURIComponent(fromIso)}`,
    `registered_at=lte.${encodeURIComponent(toIso)}`,
    "order=registered_at.asc",
    "limit=10000",
  ].join("&");

  const rows = await serviceSelect<CasualSignupRow[]>("casual_meal_signups", query);
  return rows.map((r) => ({
    day: vnDay(r.registered_at),
    member_code: "Vãng lai",
    member_name: r.phone ? `${r.full_name} (${r.phone})` : r.full_name,
    portions: 1,
    check_in_times: vnDateTime(r.registered_at),
    location_name: r.locations?.name ?? null,
  }));
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ result: "error", message: "Chưa đăng nhập." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const fromTimeRaw = searchParams.get("fromTime") ?? "";
  const toTimeRaw = searchParams.get("toTime") ?? "";
  const fromTime = TIME_RE.test(fromTimeRaw) ? fromTimeRaw : "00:00";
  const toTime = TIME_RE.test(toTimeRaw) ? toTimeRaw : "23:59";

  if (!DAY_RE.test(from) || !DAY_RE.test(to)) {
    return NextResponse.json({ result: "error", message: "Ngày không hợp lệ." }, { status: 400 });
  }

  // Khoang thoi gian CHINH XAC theo gio Viet Nam (+07:00), vd 14:00 10/10
  // den 03:00 19/10 -- khong con bi gioi han trong tung ngay rieng le.
  const fromIso = `${from}T${fromTime}:00+07:00`;
  const toIso = `${to}T${toTime}:59+07:00`;

  if (new Date(fromIso) > new Date(toIso)) {
    return NextResponse.json(
      { result: "error", message: '"Từ" phải trước hoặc bằng "Đến".' },
      { status: 400 }
    );
  }

  const locationCode = session.isAdmin ? null : session.code;

  try {
    const memberRows = await fetchMemberRows(locationCode, fromIso, toIso);

    // TAM THOI (khuyen mai dang ky): gop them suat an vang lai vao bao cao.
    // Loi fetch casual KHONG duoc lam hong ca bao cao thanh vien -- bat loi
    // rieng, log lai, van tra ve rows cua thanh vien binh thuong.
    let rows = memberRows;
    try {
      const casualRows = await fetchCasualRows(locationCode, fromIso, toIso);
      rows = [...memberRows, ...casualRows].sort(
        (a, b) => a.day.localeCompare(b.day) || a.member_name.localeCompare(b.member_name, "vi")
      );
    } catch (casualErr) {
      console.error("report casual merge error:", casualErr);
    }

    return NextResponse.json({ result: "success", rows, from, to, fromTime, toTime });
  } catch (err) {
    console.error("report error:", err);
    return NextResponse.json(
      { result: "error", message: "Không tạo được báo cáo, vui lòng thử lại." },
      { status: 500 }
    );
  }
}
