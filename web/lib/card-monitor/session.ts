import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "card_monitor_session";

function getSecret(): Uint8Array {
  const s =
    process.env.NEXTAUTH_SECRET || process.env.CARD_MONITOR_SESSION_SECRET;
  if (!s || s.length < 8) {
    throw new Error("NEXTAUTH_SECRET(또는 CARD_MONITOR_SESSION_SECRET)이 필요합니다.");
  }
  return new TextEncoder().encode(s);
}

export async function setCardMonitorSessionCookie(): Promise<void> {
  const token = await new SignJWT({ role: "card-monitor-admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearCardMonitorSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getCardMonitorSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.role === "card-monitor-admin";
  } catch {
    return false;
  }
}
