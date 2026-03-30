import test from "node:test";
import assert from "node:assert/strict";
import {
  formatConditionSentence,
  formatExceptionSentence,
  formatScopeSentence,
} from "@/lib/policy-rules/readable";

test("조건 문장을 한국어로 생성한다", () => {
  const text = formatConditionSentence({
    field: "amount",
    operator: "GT",
    valueType: "NUMBER",
    value: 300000,
    logicalOp: "AND",
    conditionGroup: 1,
    orderNo: 1,
  });
  assert.match(text, /거래 금액/);
  assert.match(text, /보다 큽니다|초과/);
});

test("스코프 문장을 한국어로 생성한다", () => {
  const text = formatScopeSentence({
    scopeUnitType: "DEPARTMENT",
    scopeUnitId: "FIN",
    country: "KR",
    currency: "KRW",
    effectiveFrom: null,
    effectiveTo: null,
  });
  assert.match(text, /부서/);
  assert.match(text, /FIN/);
});

test("예외 문장을 한국어로 생성한다", () => {
  const text = formatExceptionSentence({
    targetType: "CARD",
    targetId: "card-001",
    reason: "임원 예외",
    validFrom: null,
    validTo: null,
  });
  assert.match(text, /카드/);
  assert.match(text, /임원 예외/);
});

