export const CARD_MONITOR_ADMIN_USER =
  process.env.CARD_MONITOR_ADMIN_USER || "admin";

export function getCardMonitorAdminPassword(): string | null {
  const fromEnv = process.env.CARD_MONITOR_ADMIN_PASSWORD;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (process.env.NODE_ENV === "production") return null;
  console.warn(
    "[card-monitor] CARD_MONITOR_ADMIN_PASSWORD 미설정 — 개발용 기본 admin 비밀번호 사용",
  );
  return "admin";
}
