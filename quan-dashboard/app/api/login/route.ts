import { NextRequest, NextResponse } from "next/server";
import { callAnonRpc, getClientIp } from "@/lib/supabaseServer";
import { createSessionCookie } from "@/lib/session";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { result: "error", message: "Yêu cầu không hợp lệ." },
      { status: 400 }
    );
  }

  const { code, password } = (body ?? {}) as { code?: unknown; password?: unknown };
  if (typeof code !== "string" || !code.trim() || typeof password !== "string" || !password) {
    return NextResponse.json(
      { result: "error", message: "Vui lòng nhập mã quán và mật khẩu." },
      { status: 400 }
    );
  }

  try {
    const rpcResult = await callAnonRpc<{ code: string; name: string; is_admin?: boolean }>(
      "quan_login",
      { p_code: code.trim(), p_password: password },
      getClientIp(request)
    );

    if (rpcResult.result !== "success") {
      return NextResponse.json(
        { result: "error", message: rpcResult.message ?? "Đăng nhập thất bại." },
        { status: 401 }
      );
    }

    const isAdmin = rpcResult.is_admin === true;
    await createSessionCookie({ code: rpcResult.code, name: rpcResult.name, isAdmin });
    return NextResponse.json({ result: "success", name: rpcResult.name, isAdmin });
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json(
      { result: "error", message: "Có lỗi xảy ra, vui lòng thử lại." },
      { status: 500 }
    );
  }
}
