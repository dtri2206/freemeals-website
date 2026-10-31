import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ result: "error", message: "Chưa đăng nhập." }, { status: 401 });
  }
  return NextResponse.json({
    result: "success",
    code: session.code,
    name: session.name,
    isAdmin: session.isAdmin,
  });
}
