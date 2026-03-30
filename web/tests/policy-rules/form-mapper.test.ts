import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRulePayload,
  initRuleFormDraft,
  parseTypedValue,
  type RuleFormDraft,
} from "@/lib/policy-rules/form-mapper";

test("parseTypedValue는 NUMBER/BOOLEAN/ARRAY를 올바르게 변환한다", () => {
  assert.equal(parseTypedValue("NUMBER", "12345"), 12345);
  assert.equal(parseTypedValue("BOOLEAN", "true"), true);
  assert.deepEqual(parseTypedValue("ARRAY", "[\"A\",\"B\"]"), ["A", "B"]);
});

test("buildRulePayload는 드래프트를 API payload 구조로 변환한다", () => {
  const draft: RuleFormDraft = {
    conditions: [
      {
        conditionGroup: 1,
        logicalOp: "AND",
        field: "amount",
        operator: "GT",
        valueType: "NUMBER",
        valueText: "300000",
        orderNo: 1,
      },
    ],
    scopes: [
      {
        scopeUnitType: "DEPARTMENT",
        scopeUnitId: "FIN",
        country: "",
        currency: "KRW",
        effectiveFrom: "",
        effectiveTo: "",
      },
    ],
    exceptions: [
      {
        targetType: "CARD",
        targetId: "card-001",
        reason: "임원 카드 예외",
        validFrom: "",
        validTo: "",
      },
    ],
  };

  const payload = buildRulePayload({
    ruleCode: "PR-001",
    name: "고액 결제 규칙",
    description: "고액 결제 탐지",
    ruleType: "AMOUNT_BASED",
    severity: "HIGH",
    priority: 100,
    tags: ["expense"],
    changeSummary: "initial",
    changeReason: "policy",
    actions: ["FLAG_ONLY"],
    draft,
  });

  assert.equal(payload.conditions.length, 1);
  assert.equal(payload.conditions[0]?.value, 300000);
  assert.equal(payload.scopes[0]?.scopeUnitType, "DEPARTMENT");
  assert.equal(payload.exceptions[0]?.targetType, "CARD");
});

test("잘못된 JSON ARRAY 입력이면 예외를 던진다", () => {
  assert.throws(() => parseTypedValue("ARRAY", "[invalid"), /JSON/);
});

test("initRuleFormDraft는 기본 구조를 반환한다", () => {
  const draft = initRuleFormDraft(null);
  assert.equal(draft.conditions.length, 1);
  assert.equal(draft.scopes.length, 0);
  assert.equal(draft.exceptions.length, 0);
});

