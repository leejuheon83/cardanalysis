import { NextResponse } from "next/server";
import { clearCardMonitorSessionCookie } from "@/lib/card-monitor/session";

export async function POST() {
  await clearCardMonitorSessionCookie();
  return NextResponse.json({ ok: true });
}
