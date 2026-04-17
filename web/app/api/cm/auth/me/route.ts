import { NextResponse } from "next/server";
import { getCardMonitorSession } from "@/lib/card-monitor/session";

export async function GET() {
  const ok = await getCardMonitorSession();
  if (ok) {
    return NextResponse.json({ ok: true, user: "admin" });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
