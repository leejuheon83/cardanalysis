import crypto from "node:crypto";

type EnvShape = NodeJS.ProcessEnv & {
  DATABASE_URL?: string;
  FALLBACK_ADMIN_EMAIL?: string;
  FALLBACK_ADMIN_PASSWORD?: string;
};

export type RuntimeMode = "database" | "fallback-auth" | "setup-required";

export function hasConfiguredDatabase(env: EnvShape = process.env) {
  return /^(postgresql|postgres):\/\//i.test(env.DATABASE_URL ?? "");
}

export function getFallbackAdminCredentials(env: EnvShape = process.env) {
  const email = env.FALLBACK_ADMIN_EMAIL?.trim();
  const password = env.FALLBACK_ADMIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export function getRuntimeMode(env: EnvShape = process.env): RuntimeMode {
  if (hasConfiguredDatabase(env)) return "database";
  if (getFallbackAdminCredentials(env)) return "fallback-auth";
  return "setup-required";
}

export function setupRequiredMessage() {
  return "운영 데이터베이스가 아직 연결되지 않았습니다. Vercel 환경 변수 DATABASE_URL을 설정하세요.";
}

export function safeEqualText(a: string, b: string) {
  const size = 256;
  if (!a || !b || a.length > size || b.length > size) return false;
  const aa = Buffer.alloc(size, 0);
  const bb = Buffer.alloc(size, 0);
  Buffer.from(a, "utf8").copy(aa);
  Buffer.from(b, "utf8").copy(bb);
  return crypto.timingSafeEqual(aa, bb);
}

export async function authFailureDelay() {
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 120));
}
