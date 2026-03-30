export type PolicySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PolicyAction = "FLAG_ONLY" | "REQUIRE_REVIEW" | "AUTO_HOLD" | "AUTO_ESCALATE";
export type ScopeUnitType = "COMPANY" | "DEPARTMENT" | "COST_CENTER" | "CARD_GROUP" | "USER_ROLE";
export type ExceptionTargetType = "USER" | "CARD" | "MERCHANT" | "PROJECT" | "TRANSACTION";
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

export type SandboxCondition = {
  field: string;
  operator: ConditionOperator;
  value: unknown;
};

export type SandboxScope = {
  scopeUnitType: ScopeUnitType;
  scopeUnitId: string;
};

export type SandboxException = {
  targetType: ExceptionTargetType;
  targetId: string;
};

export type SandboxRule = {
  id: string;
  name: string;
  severity: PolicySeverity;
  actions: PolicyAction[];
  conditions: SandboxCondition[];
  scopes: SandboxScope[];
  exceptions?: SandboxException[];
};

export type SandboxTransaction = {
  transactionId?: string;
  amount: number;
  currency?: string;
  merchantName?: string | null;
  category?: string | null;
  userLabel?: string | null;
  txnDate: string;
  departmentId?: string | null;
  cardId?: string | null;
  userId?: string | null;
  projectId?: string | null;
  hasReceipt?: boolean | null;
};

export type Conflict = {
  leftRuleId: string;
  rightRuleId: string;
  reason: string;
};

const getComparableValue = (tx: SandboxTransaction, field: string): unknown => {
  switch (field) {
    case "amount":
      return tx.amount;
    case "currency":
      return tx.currency;
    case "merchantName":
      return tx.merchantName;
    case "category":
      return tx.category;
    case "userLabel":
      return tx.userLabel;
    case "dayOfWeek":
      return new Date(tx.txnDate).getUTCDay();
    case "hourOfDay":
      return new Date(tx.txnDate).getUTCHours();
    case "hasReceipt":
      return tx.hasReceipt ?? false;
    default:
      return undefined;
  }
};

const evaluateCondition = (tx: SandboxTransaction, condition: SandboxCondition): boolean => {
  const left = getComparableValue(tx, condition.field);
  const right = condition.value;
  switch (condition.operator) {
    case "EQ":
      return left === right;
    case "NE":
      return left !== right;
    case "GT":
      return Number(left) > Number(right);
    case "GTE":
      return Number(left) >= Number(right);
    case "LT":
      return Number(left) < Number(right);
    case "LTE":
      return Number(left) <= Number(right);
    case "IN":
      return Array.isArray(right) ? right.includes(left as never) : false;
    case "NOT_IN":
      return Array.isArray(right) ? !right.includes(left as never) : false;
    case "EXISTS":
      return left !== undefined && left !== null;
    case "REGEX":
      return typeof left === "string" && typeof right === "string" ? new RegExp(right).test(left) : false;
    default:
      return false;
  }
};

const isExceptionTarget = (tx: SandboxTransaction, exception: SandboxException): boolean => {
  switch (exception.targetType) {
    case "CARD":
      return tx.cardId === exception.targetId;
    case "USER":
      return tx.userId === exception.targetId;
    case "PROJECT":
      return tx.projectId === exception.targetId;
    case "MERCHANT":
      return tx.merchantName === exception.targetId;
    case "TRANSACTION":
      return tx.transactionId === exception.targetId;
    default:
      return false;
  }
};

export const runRuleTestSandbox = (rule: SandboxRule, txs: SandboxTransaction[]) => {
  const samples = txs.map((tx) => {
    const excepted = (rule.exceptions ?? []).some((e) => isExceptionTarget(tx, e));
    const matched = !excepted && rule.conditions.every((c) => evaluateCondition(tx, c));
    return {
      transactionId: tx.transactionId ?? null,
      matched,
      triggeredConditions: matched ? rule.conditions.map((c) => c.field) : [],
      appliedActions: matched ? rule.actions : [],
      explanation: matched ? `${rule.name} 규칙 조건에 일치합니다.` : "규칙 조건 미일치 또는 예외 처리되었습니다.",
    };
  });

  const matchedCount = samples.filter((s) => s.matched).length;
  return {
    matchedCount,
    unmatchedCount: samples.length - matchedCount,
    conflictWarnings: [] as string[],
    samples,
  };
};

const signature = (rule: SandboxRule) =>
  JSON.stringify({
    scopes: [...rule.scopes].sort((a, b) => `${a.scopeUnitType}:${a.scopeUnitId}`.localeCompare(`${b.scopeUnitType}:${b.scopeUnitId}`)),
    conditions: [...rule.conditions].sort((a, b) => `${a.field}:${a.operator}`.localeCompare(`${b.field}:${b.operator}`)),
  });

export const detectRuleConflicts = (rules: SandboxRule[]): Conflict[] => {
  const out: Conflict[] = [];
  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      const left = rules[i];
      const right = rules[j];
      if (!left || !right) continue;

      const sameSignature = signature(left) === signature(right);
      const sameActions = JSON.stringify([...left.actions].sort()) === JSON.stringify([...right.actions].sort());
      if (sameSignature && !sameActions) {
        out.push({
          leftRuleId: left.id,
          rightRuleId: right.id,
          reason: "동일 조건/스코프에서 상이한 액션이 설정되어 있습니다.",
        });
      }
    }
  }
  return out;
};

