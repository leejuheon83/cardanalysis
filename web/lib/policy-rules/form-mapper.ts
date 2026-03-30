import type {
  ConditionOperator,
  ConditionValueType,
  ExceptionTargetType,
  PolicyAction,
  PolicyRuleDetail,
  PolicyRuleType,
  PolicySeverity,
  ScopeUnitType,
} from "@/types/policy-rules";

export type RuleConditionDraft = {
  conditionGroup: number;
  logicalOp: "AND" | "OR";
  field: string;
  operator: ConditionOperator;
  valueType: ConditionValueType;
  valueText: string;
  orderNo: number;
};

export type RuleScopeDraft = {
  scopeUnitType: ScopeUnitType;
  scopeUnitId: string;
  country: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string;
};

export type RuleExceptionDraft = {
  targetType: ExceptionTargetType;
  targetId: string;
  reason: string;
  validFrom: string;
  validTo: string;
};

export type RuleFormDraft = {
  conditions: RuleConditionDraft[];
  scopes: RuleScopeDraft[];
  exceptions: RuleExceptionDraft[];
};

const stringifyValue = (value: unknown) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

export const initRuleFormDraft = (initial: PolicyRuleDetail | null): RuleFormDraft => {
  if (!initial?.currentVersion) {
    return {
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
      scopes: [],
      exceptions: [],
    };
  }

  return {
    conditions: initial.currentVersion.conditions.map((c) => ({
      conditionGroup: c.conditionGroup,
      logicalOp: c.logicalOp,
      field: c.field,
      operator: c.operator,
      valueType: c.valueType,
      valueText: stringifyValue(c.value),
      orderNo: c.orderNo,
    })),
    scopes: initial.currentVersion.scopes.map((s) => ({
      scopeUnitType: s.scopeUnitType,
      scopeUnitId: s.scopeUnitId,
      country: s.country ?? "",
      currency: s.currency ?? "",
      effectiveFrom: s.effectiveFrom ?? "",
      effectiveTo: s.effectiveTo ?? "",
    })),
    exceptions: initial.currentVersion.exceptions.map((e) => ({
      targetType: e.targetType,
      targetId: e.targetId,
      reason: e.reason,
      validFrom: e.validFrom ?? "",
      validTo: e.validTo ?? "",
    })),
  };
};

export const parseTypedValue = (valueType: ConditionValueType, valueText: string): unknown => {
  switch (valueType) {
    case "NUMBER":
      return Number(valueText);
    case "BOOLEAN":
      return valueText.trim().toLowerCase() === "true";
    case "ARRAY":
    case "JSON":
      try {
        return JSON.parse(valueText);
      } catch {
        throw new Error(`${valueType} value must be valid JSON`);
      }
    case "DATETIME":
    case "STRING":
    default:
      return valueText;
  }
};

export const buildRulePayload = (params: {
  ruleCode: string;
  name: string;
  description: string;
  ruleType: PolicyRuleType;
  severity: PolicySeverity;
  priority: number;
  tags: string[];
  changeSummary: string;
  changeReason: string;
  actions: PolicyAction[];
  draft: RuleFormDraft;
}) => ({
  ruleCode: params.ruleCode,
  name: params.name,
  description: params.description || null,
  ruleType: params.ruleType,
  severity: params.severity,
  priority: Number(params.priority),
  tags: params.tags,
  changeSummary: params.changeSummary,
  changeReason: params.changeReason,
  actions: params.actions,
  conditions: params.draft.conditions
    .filter((c) => c.field.trim())
    .map((c) => ({
      conditionGroup: c.conditionGroup,
      logicalOp: c.logicalOp,
      field: c.field,
      operator: c.operator,
      valueType: c.valueType,
      value: parseTypedValue(c.valueType, c.valueText),
      orderNo: c.orderNo,
    })),
  scopes: params.draft.scopes
    .filter((s) => s.scopeUnitId.trim())
    .map((s) => ({
      scopeUnitType: s.scopeUnitType,
      scopeUnitId: s.scopeUnitId,
      country: s.country || null,
      currency: s.currency || null,
      effectiveFrom: s.effectiveFrom || null,
      effectiveTo: s.effectiveTo || null,
    })),
  exceptions: params.draft.exceptions
    .filter((e) => e.targetId.trim() && e.reason.trim())
    .map((e) => ({
      targetType: e.targetType,
      targetId: e.targetId,
      reason: e.reason,
      validFrom: e.validFrom || null,
      validTo: e.validTo || null,
    })),
});

