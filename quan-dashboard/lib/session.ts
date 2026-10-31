import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "quan_session";
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12h — quán nhân viên đăng nhập lại mỗi ca

export type QuanSession = {
  code: string;
  name: string;
  isAdmin: boolean;
};

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Thiếu SESSION_SECRET trong biến môi trường.");
  return new TextEncoder().encode(secret);
}

export async function createSessionCookie(session: QuanSession) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Đọc + verify session từ cookie hiện tại. null nếu chưa đăng nhập / token hỏng / hết hạn. */
export async function getSession(): Promise<QuanSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.code !== "string" || typeof payload.name !== "string") {
      return null;
    }
    return { code: payload.code, name: payload.name, isAdmin: payload.isAdmin === true };
  } catch {
    return null;
  }
}
