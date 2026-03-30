export type PolicyRuleType =
  | "TIME_BASED"
  | "AMOUNT_BASED"
  | "MERCHANT_CATEGORY_BASED"
  | "DOCUMENT_BASED"
  | "PATTERN_BASED"
  | "ORGANIZATION_BASED";

export type PolicySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PolicyStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type PolicyAction = "FLAG_ONLY" | "REQUIRE_REVIEW" | "AUTO_HOLD" | "AUTO_ESCALATE";
export type PolicyApproval = "PENDING" | "APPROVED" | "REJECTED";
export type ConditionOperator =
  | "EQ"
  | "NE"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "IN"
  | "NOT_IN"
  | "EXISTS"
  | "REGEX";
export type ConditionValueType = "STRING" | "NUMBER" | "BOOLEAN" | "DATETIME" | "ARRAY" | "JSON";
export type ScopeUnitType = "COMPANY" | "DEPARTMENT" | "COST_CENTER" | "CARD_GROUP" | "USER_ROLE";
export type ExceptionTargetType = "USER" | "CARD" | "MERCHANT" | "PROJECT" | "TRANSACTION";

export type PolicyRuleConditionDto = {
  id?: string;
  conditionGroup: number;
  logicalOp: "AND" | "OR";
  field: string;
  operator: ConditionOperator;
  valueType: ConditionValueType;
  value: unknown;
  orderNo: number;
};

export type PolicyRuleScopeDto = {
  id?: string;
  scopeUnitType: ScopeUnitType;
  scopeUnitId: string;
  country: string | null;
  currency: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type PolicyRuleExceptionDto = {
  id?: string;
  targetType: ExceptionTargetType;
  targetId: string;
  reason: string;
  validFrom: string | null;
  validTo: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
};

export type PolicyRuleVersionDto = {
  id: string;
  versionNo: number;
  approvalStatus: PolicyApproval;
  isActive: boolean;
  severity: PolicySeverity;
  actions: PolicyAction[];
  changeSummary: string | null;
  changeReason: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  createdAt: string;
  approvedAt: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  conditions: PolicyRuleConditionDto[];
  scopes: PolicyRuleScopeDto[];
  exceptions: PolicyRuleExceptionDto[];
};

export type PolicyRuleListItem = {
  id: string;
  ruleCode: string;
  name: string;
  ruleType: PolicyRuleType;
  severity: PolicySeverity;
  status: PolicyStatus;
  priority: number;
  tags: unknown;
  updatedAt: string;
  currentVersion: PolicyRuleVersionDto | null;
};

export type PolicyRuleDetail = {
  id: string;
  ruleCode: string;
  name: string;
  description: string | null;
  ruleType: PolicyRuleType;
  severity: PolicySeverity;
  status: PolicyStatus;
  priority: number;
  tags: unknown;
  updatedAt: string;
  currentVersion: PolicyRuleVersionDto | null;
};

