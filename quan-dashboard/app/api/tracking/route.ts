import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { serviceSelect } from "@/lib/supabaseServer";
import { vnDayRange } from "@/lib/vnTime";

type MealLogRow = {
  id: number;
  member_code: string;
  member_name: string;
  portions: number;
  created_at: string;
  location_code?: string;
  locations?: { name: string } | null;
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ result: "error", message: "Chưa đăng nhập." }, { status: 401 });
  }

  // Admin co the chon xem 1 quan cu the (?location=MA_QUAN) hoac bo trong de
  // xem TAT CA quan gop lai. Quan thuong KHONG duoc tu chon -- luon bi ep ve
  // chinh ma quan cua minh, bo qua moi gia tri client gui len.
  const requestedLocation = session.isAdmin
    ? new URL(request.url).searchParams.get("location")?.trim() || null
    : null;
  const locationFilter = session.isAdmin ? requestedLocation : session.code;

  // 1 ngay tron 00:00 -> 24:00 gio VN (?date=yyyy-MM-dd, bo trong = hom nay),
  // khong phai 24h truot -- xem lib/vnTime.ts.
  const { day, fromIso, toIso } = vnDayRange(new URL(request.url).searchParams.get("date"));

  // Che do "tat ca quan" (admin, khong chon quan cu the): embed them ten
  // quan (locations(name)) de phan biet dong nao cua quan nao.
  const query = [
    session.isAdmin && !locationFilter
      ? "select=id,member_code,member_name,portions,created_at,location_code,locations(name)"
      : "select=id,member_code,member_name,portions,created_at",
    ...(locationFilter ? [`location_code=eq.${encodeURIComponent(locationFilter)}`] : []),
    `created_at=gte.${encodeURIComponent(fromIso)}`,
    `created_at=lt.${encodeURIComponent(toIso)}`,
    "order=created_at.desc",
    `limit=${session.isAdmin && !locationFilter ? 2000 : 500}`,
  ].join("&");

  try {
    const rawRows = await serviceSelect<MealLogRow[]>("meal_log", query);
    const rows = rawRows.map((r) => ({
      id: r.id,
      member_code: r.member_code,
      member_name: r.member_name,
      portions: r.portions,
      created_at: r.created_at,
      location_name: r.locations?.name ?? null,
    }));
    const totalPortions = rows.reduce((sum, r) => sum + r.portions, 0);
    return NextResponse.json({
      result: "success",
      day,
      rows,
      totalPortions,
      totalVisits: rows.length,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("tracking error:", err);
    return NextResponse.json(
      { result: "error", message: "Không tải được dữ liệu, vui lòng thử lại." },
      { status: 500 }
    );
  }
}
