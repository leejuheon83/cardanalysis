import test from "node:test";
import assert from "node:assert/strict";
import {
  detectRuleConflicts,
  runRuleTestSandbox,
  type SandboxRule,
  type SandboxTransaction,
} from "@/lib/policy-rules/engine";

test("동일 조건/스코프에서 액션이 다르면 충돌로 감지한다", () => {
  const rules: SandboxRule[] = [
    {
      id: "r1",
      name: "고액 결제 차단",
      severity: "HIGH",
      actions: ["AUTO_HOLD"],
      conditions: [{ field: "amount", operator: "GT", value: 300000 }],
      scopes: [{ scopeUnitType: "DEPARTMENT", scopeUnitId: "FIN" }],
    },
    {
      id: "r2",
      name: "고액 결제 플래그",
      severity: "MEDIUM",
      actions: ["FLAG_ONLY"],
      conditions: [{ field: "amount", operator: "GT", value: 300000 }],
      scopes: [{ scopeUnitType: "DEPARTMENT", scopeUnitId: "FIN" }],
    },
  ];

  const conflicts = detectRuleConflicts(rules);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.leftRuleId, "r1");
  assert.equal(conflicts[0]?.rightRuleId, "r2");
});

test("예외 대상 거래는 샌드박스에서 미매칭 처리한다", () => {
  const rule: SandboxRule = {
    id: "r3",
    name: "주말 결제 리뷰",
    severity: "LOW",
    actions: ["REQUIRE_REVIEW"],
    conditions: [{ field: "dayOfWeek", operator: "IN", value: [0, 6] }],
    scopes: [{ scopeUnitType: "COMPANY", scopeUnitId: "ALL" }],
    exceptions: [{ targetType: "CARD", targetId: "card-123" }],
  };

  const tx: SandboxTransaction = {
    amount: 10000,
    currency: "KRW",
    merchantName: "Coffee",
    category: "MEAL",
    userLabel: null,
    txnDate: "2026-03-29T10:00:00.000Z",
    departmentId: "FIN",
    cardId: "card-123",
    hasReceipt: true,
  };

  const result = runRuleTestSandbox(rule, [tx]);
  assert.equal(result.matchedCount, 0);
  assert.equal(result.samples[0]?.matched, false);
});

