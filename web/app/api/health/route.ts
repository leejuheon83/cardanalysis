import { NextResponse } from "next/server";

export async function GET() {
  const body: Record<string, unknown> = {
    ok: true,
    database: "postgresql",
  };
  if (process.env.NODE_ENV !== "production") {
    body.service = "card-compliance-web";
  }
  return NextResponse.json(body);
}
