import test from "node:test";
import assert from "node:assert/strict";
import {
  getTransactionRowUiStatus,
  matchesStatusTierFilter,
} from "@/lib/transaction-row-status";

test("검토대기라도 리스크 40 미만이면 정상으로 표시한다", () => {
  assert.equal(getTransactionRowUiStatus(12, "PENDING"), "normal");
  assert.equal(getTransactionRowUiStatus(26, "PENDING"), "normal");
});

test("리스크 40 이상 70 미만은 의심(검토대기 포함)", () => {
  assert.equal(getTransactionRowUiStatus(40, "PENDING"), "suspicious");
  assert.equal(getTransactionRowUiStatus(52, "PENDING"), "suspicious");
});

test("리스크 70 이상 또는 위반 확정은 위반", () => {
  assert.equal(getTransactionRowUiStatus(70, "PENDING"), "violation");
  assert.equal(getTransactionRowUiStatus(72, "PENDING"), "violation");
  assert.equal(getTransactionRowUiStatus(10, "VIOLATION"), "violation");
});

test("승인·기각은 정상", () => {
  assert.equal(getTransactionRowUiStatus(80, "APPROVED"), "normal");
  assert.equal(getTransactionRowUiStatus(80, "DISMISSED"), "normal");
});

test("attention 필터는 의심·위반만 포함", () => {
  assert.equal(matchesStatusTierFilter(12, "PENDING", "attention"), false);
  assert.equal(matchesStatusTierFilter(45, "PENDING", "attention"), true);
  assert.equal(matchesStatusTierFilter(72, "PENDING", "attention"), true);
});
