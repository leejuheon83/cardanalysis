import test from "node:test";
import assert from "node:assert/strict";
import {
  getFallbackAdminCredentials,
  getRuntimeMode,
  hasConfiguredDatabase,
  safeEqualText,
} from "@/lib/runtime-config";

test("DATABASE_URL이 postgres면 DB 구성 완료로 본다", () => {
  assert.equal(
    hasConfiguredDatabase({ DATABASE_URL: "postgresql://user:pass@host:5432/db" }),
    true,
  );
  assert.equal(hasConfiguredDatabase({ DATABASE_URL: "" }), false);
});

test("폴백 관리자 계정이 둘 다 있어야 사용한다", () => {
  assert.deepEqual(
    getFallbackAdminCredentials({
      FALLBACK_ADMIN_EMAIL: "admin@example.com",
      FALLBACK_ADMIN_PASSWORD: "secret",
    }),
    { email: "admin@example.com", password: "secret" },
  );
  assert.equal(getFallbackAdminCredentials({ FALLBACK_ADMIN_EMAIL: "admin@example.com" }), null);
});

test("런타임 모드를 올바르게 판별한다", () => {
  assert.equal(getRuntimeMode({ DATABASE_URL: "postgresql://x:y@z/db" }), "database");
  assert.equal(
    getRuntimeMode({
      FALLBACK_ADMIN_EMAIL: "admin@example.com",
      FALLBACK_ADMIN_PASSWORD: "secret",
    }),
    "fallback-auth",
  );
  assert.equal(getRuntimeMode({}), "setup-required");
});

test("safeEqualText는 동일 문자열만 true", () => {
  assert.equal(safeEqualText("abc", "abc"), true);
  assert.equal(safeEqualText("abc", "abcd"), false);
});
