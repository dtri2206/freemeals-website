// TAM THOI (khuyen mai dang ky) -- suat an vang lai cho khach dang ky Giai
// doan 1, doc tu bang casual_meal_signups (dong bo tu Google Sheet qua
// KhachVangLai.gs). Xoa file nay + component CasualMealsCard.tsx + vai dong
// goi no trong TrackingPanel.tsx + khoi TAM THOI trong app/api/report/route.ts
// khi het dot khuyen mai.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { serviceSelect } from "@/lib/supabaseServer";
import { vnStartOfTodayIso } from "@/lib/vnTime";

type CasualSignupRow = {
  full_name: string;
  phone: string | null;
  registered_at: string;
  locations?: { name: string } | null;
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ result: "error", message: "Chưa đăng nhập." }, { status: 401 });
  }

  // Admin co the chon xem 1 quan cu the (?location=MA_QUAN), giong /api/tracking.
  const requestedLocation = session.isAdmin
    ? new URL(request.url).searchParams.get("location")?.trim() || null
    : null;
  const locationFilter = session.isAdmin ? requestedLocation : session.code;

  // Tu 00:00 hom nay (gio VN), khong phai 24h truot -- xem lib/vnTime.ts.
  const since = vnStartOfTodayIso();
  const query = [
    session.isAdmin && !locationFilter
      ? "select=full_name,phone,registered_at,locations(name)"
      : "select=full_name,phone,registered_at",
    ...(locationFilter ? [`location_code=eq.${encodeURIComponent(locationFilter)}`] : []),
    `registered_at=gte.${encodeURIComponent(since)}`,
    "order=registered_at.desc",
    `limit=${session.isAdmin && !locationFilter ? 2000 : 500}`,
  ].join("&");

  try {
    const rawRows = await serviceSelect<CasualSignupRow[]>("casual_meal_signups", query);
    const rows = rawRows.map((r) => ({
      full_name: r.full_name,
      phone: r.phone,
      registered_at: r.registered_at,
      location_name: r.locations?.name ?? null,
    }));
    return NextResponse.json({ result: "success", rows, totalVisits: rows.length });
  } catch (err) {
    console.error("casual tracking error:", err);
    return NextResponse.json(
      { result: "error", message: "Không tải được dữ liệu, vui lòng thử lại." },
      { status: 500 }
    );
  }
}
