import { NextResponse } from "next/server";
import {
  getFallbackAdminCredentials,
  getRuntimeMode,
  setupRequiredMessage,
} from "@/lib/runtime-config";

export async function GET() {
  const mode = getRuntimeMode();
  return NextResponse.json({
    mode,
    hasFallbackAuth: !!getFallbackAdminCredentials(),
    message: mode === "setup-required" ? setupRequiredMessage() : null,
  });
}
