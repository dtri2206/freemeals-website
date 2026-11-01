// Chi admin dung: danh sach ma quan + ten quan de hien o o chon "Theo doi
// theo ngay, theo tung quan". Quan thuong khong goi API nay (khong can thay quan
// khac).
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { serviceSelect } from "@/lib/supabaseServer";

type LocationRow = {
  code: string;
  name: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ result: "error", message: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ result: "error", message: "Không có quyền." }, { status: 403 });
  }

  try {
    const rows = await serviceSelect<LocationRow[]>(
      "locations",
      "select=code,name&is_active=eq.true&order=name.asc"
    );
    return NextResponse.json({ result: "success", locations: rows });
  } catch (err) {
    console.error("locations list error:", err);
    return NextResponse.json(
      { result: "error", message: "Không tải được danh sách quán, vui lòng thử lại." },
      { status: 500 }
    );
  }
}
