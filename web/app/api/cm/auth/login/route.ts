import { NextResponse } from "next/server";
import {
  getCardMonitorAdminPassword,
  CARD_MONITOR_ADMIN_USER,
} from "@/lib/card-monitor/password";
import { timingSafeStringEqual } from "@/lib/card-monitor/timing-equal";
import { setCardMonitorSessionCookie } from "@/lib/card-monitor/session";
import { delayJitter } from "@/lib/card-monitor/delay-jitter";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const expectedPassword = getCardMonitorAdminPassword();
  const okUser =
    typeof body.username === "string" &&
    timingSafeStringEqual(body.username, CARD_MONITOR_ADMIN_USER);

  const okPass =
    !!expectedPassword &&
    typeof body.password === "string" &&
    timingSafeStringEqual(body.password, expectedPassword);

  if (okUser && okPass) {
    await setCardMonitorSessionCookie();
    return NextResponse.json({ ok: true, user: "admin" });
  }

  await delayJitter();
  return NextResponse.json(
    { ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." },
    { status: 401 },
  );
}
