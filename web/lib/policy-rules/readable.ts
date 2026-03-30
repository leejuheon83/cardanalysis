import {
  exceptionTargetLabel,
  logicalOpLabel,
  operatorLabel,
  scopeUnitLabel,
  valueTypeLabel,
} from "@/lib/policy-rules/labels";
import type {
  PolicyRuleConditionDto,
  PolicyRuleExceptionDto,
  PolicyRuleScopeDto,
} from "@/types/policy-rules";

const fieldLabel: Record<string, string> = {
  amount: "거래 금액",
  merchantName: "가맹점명",
  category: "카테고리",
  userLabel: "사용자 라벨",
  dayOfWeek: "요일",
  hourOfDay: "거래 시각",
  hasReceipt: "증빙 첨부 여부",
};

const valueToText = (value: unknown) => {
  if (value == null) return "없음";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toLocaleString("ko-KR");
  if (typeof value === "boolean") return value ? "참" : "거짓";
  return JSON.stringify(value);
};

const postposition = (word: string, josaBatchim: string, josaNoBatchim: string) => {
  if (!word) return josaNoBatchim;
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return josaNoBatchim;
  const hasBatchim = (last - 0xac00) % 28 !== 0;
  return hasBatchim ? josaBatchim : josaNoBatchim;
};

export const formatConditionSentence = (condition: {
  field: string;
  operator: keyof typeof operatorLabel;
  valueType: keyof typeof valueTypeLabel;
  value: unknown;
  logicalOp: "AND" | "OR";
  conditionGroup: number;
  orderNo: number;
}) => {
  const field = fieldLabel[condition.field] ?? condition.field;
  const type = valueTypeLabel[condition.valueType];
  const value = valueToText(condition.value);
  const fieldJosa = postposition(field, "이", "가");

  const predicateMap: Record<keyof typeof operatorLabel, string> = {
    EQ: `${value}${postposition(String(value), "과", "와")} 같습니다`,
    NE: `${value}${postposition(String(value), "과", "와")} 다릅니다`,
    GT: `${value}보다 큽니다`,
    GTE: `${value} 이상입니다`,
    LT: `${value}보다 작습니다`,
    LTE: `${value} 이하입니다`,
    IN: `${value} 목록에 포함됩니다`,
    NOT_IN: `${value} 목록에 포함되지 않습니다`,
    EXISTS: "값이 존재합니다",
    REGEX: `${value} 패턴과 일치합니다`,
  };

  const logicalPrefix =
    condition.orderNo > 1
      ? `이전 조건과 ${condition.logicalOp === "AND" ? "모두 만족하고," : "하나 이상 만족하며,"} `
      : "";
  const groupPrefix = condition.conditionGroup > 1 ? `그룹 ${condition.conditionGroup}에서 ` : "";
  return `${groupPrefix}${logicalPrefix}${field}${fieldJosa} ${predicateMap[condition.operator]} (${type})`;
};

export const formatScopeSentence = (scope: {
  scopeUnitType: keyof typeof scopeUnitLabel;
  scopeUnitId: string;
  country: string | null;
  currency: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}) => {
  const unit = scopeUnitLabel[scope.scopeUnitType];
  const parts = [`적용 대상은 ${unit} ${scope.scopeUnitId}`];
  if (scope.country) parts.push(`국가는 ${scope.country}`);
  if (scope.currency) parts.push(`통화는 ${scope.currency}`);
  if (scope.effectiveFrom || scope.effectiveTo) {
    parts.push(`유효기간은 ${scope.effectiveFrom ?? "시작 무제한"}부터 ${scope.effectiveTo ?? "종료 무제한"}까지`);
  }
  return parts.join(", ");
};

export const formatExceptionSentence = (ex: {
  targetType: keyof typeof exceptionTargetLabel;
  targetId: string;
  reason: string;
  validFrom: string | null;
  validTo: string | null;
}) => {
  const target = exceptionTargetLabel[ex.targetType];
  const parts = [`예외 대상은 ${target} ${ex.targetId}`, `사유는 "${ex.reason}"`];
  if (ex.validFrom || ex.validTo) {
    parts.push(`유효기간은 ${ex.validFrom ?? "시작 무제한"}부터 ${ex.validTo ?? "종료 무제한"}까지`);
  }
  return parts.join(", ");
};

export const formatConditionFromDto = (c: PolicyRuleConditionDto) =>
  formatConditionSentence({
    field: c.field,
    operator: c.operator,
    valueType: c.valueType,
    value: c.value,
    logicalOp: c.logicalOp,
    conditionGroup: c.conditionGroup,
    orderNo: c.orderNo,
  });

export const formatScopeFromDto = (s: PolicyRuleScopeDto) =>
  formatScopeSentence({
    scopeUnitType: s.scopeUnitType,
    scopeUnitId: s.scopeUnitId,
    country: s.country,
    currency: s.currency,
    effectiveFrom: s.effectiveFrom,
    effectiveTo: s.effectiveTo,
  });

export const formatExceptionFromDto = (e: PolicyRuleExceptionDto) =>
  formatExceptionSentence({
    targetType: e.targetType,
    targetId: e.targetId,
    reason: e.reason,
    validFrom: e.validFrom,
    validTo: e.validTo,
  });

