import type {
  PolicyRuleCondition,
  PolicyRuleException,
  PolicyRuleScope,
  PolicyRuleVersion,
  Role,
} from "@prisma/client";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { SandboxRule, SandboxTransaction } from "@/lib/policy-rules/engine";

export const canManagePolicy = (role: Role | undefined) => role === "ADMIN" || role === "ACCOUNTING";
export const canActivatePolicy = (role: Role | undefined) => role === "ADMIN";

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
export const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

export const requireSessionUser = (session: Session | null) => {
  if (!session?.user?.id) {
    return { ok: false as const, response: unauthorized() };
  }
  return { ok: true as const, userId: session.user.id, role: session.user.role };
};

const parseActionArray = (value: unknown): ("FLAG_ONLY" | "REQUIRE_REVIEW" | "AUTO_HOLD" | "AUTO_ESCALATE")[] => {
  if (!Array.isArray(value)) return ["FLAG_ONLY"];
  const allowed = new Set(["FLAG_ONLY", "REQUIRE_REVIEW", "AUTO_HOLD", "AUTO_ESCALATE"]);
  return value.filter((item): item is "FLAG_ONLY" | "REQUIRE_REVIEW" | "AUTO_HOLD" | "AUTO_ESCALATE" => typeof item === "string" && allowed.has(item));
};

export const toSandboxRule = (params: {
  ruleId: string;
  ruleName: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  actionsJson: unknown;
  conditions: PolicyRuleCondition[];
  scopes: PolicyRuleScope[];
  exceptions: PolicyRuleException[];
}): SandboxRule => ({
  id: params.ruleId,
  name: params.ruleName,
  severity: params.severity,
  actions: parseActionArray(params.actionsJson),
  conditions: params.conditions.map((c) => ({
    field: c.field,
    operator: c.operator,
    value: c.valueJson,
  })),
  scopes: params.scopes.map((s) => ({
    scopeUnitType: s.scopeUnitType,
    scopeUnitId: s.scopeUnitId,
  })),
  exceptions: params.exceptions.map((e) => ({
    targetType: e.targetType,
    targetId: e.targetId,
  })),
});

export const toVersionResponse = (
  version: PolicyRuleVersion & {
    conditions: PolicyRuleCondition[];
    scopes: PolicyRuleScope[];
    exceptions: PolicyRuleException[];
  },
) => ({
  id: version.id,
  versionNo: version.versionNo,
  approvalStatus: version.approvalStatus,
  isActive: version.isActive,
  severity: version.severity,
  actions: parseActionArray(version.actionsJson),
  changeSummary: version.changeSummary,
  changeReason: version.changeReason,
  createdByUserId: version.createdByUserId,
  approvedByUserId: version.approvedByUserId,
  createdAt: version.createdAt.toISOString(),
  approvedAt: version.approvedAt?.toISOString() ?? null,
  activatedAt: version.activatedAt?.toISOString() ?? null,
  deactivatedAt: version.deactivatedAt?.toISOString() ?? null,
  conditions: version.conditions.map((c) => ({
    id: c.id,
    conditionGroup: c.conditionGroup,
    logicalOp: c.logicalOp,
    field: c.field,
    operator: c.operator,
    valueType: c.valueType,
    value: c.valueJson,
    orderNo: c.orderNo,
  })),
  scopes: version.scopes.map((s) => ({
    id: s.id,
    scopeUnitType: s.scopeUnitType,
    scopeUnitId: s.scopeUnitId,
    country: s.country,
    currency: s.currency,
    effectiveFrom: s.effectiveFrom?.toISOString() ?? null,
    effectiveTo: s.effectiveTo?.toISOString() ?? null,
  })),
  exceptions: version.exceptions.map((e) => ({
    id: e.id,
    targetType: e.targetType,
    targetId: e.targetId,
    reason: e.reason,
    validFrom: e.validFrom?.toISOString() ?? null,
    validTo: e.validTo?.toISOString() ?? null,
    approvedByUserId: e.approvedByUserId,
    approvedAt: e.approvedAt?.toISOString() ?? null,
  })),
});

export const toSandboxTransactionsFromRows = (rows: Record<string, unknown>[]): SandboxTransaction[] =>
  rows.map((row) => ({
    transactionId: typeof row.transactionId === "string" ? row.transactionId : undefined,
    amount: Number(row.amount ?? 0),
    currency: typeof row.currency === "string" ? row.currency : "KRW",
    merchantName: typeof row.merchantName === "string" ? row.merchantName : null,
    category: typeof row.category === "string" ? row.category : null,
    userLabel: typeof row.userLabel === "string" ? row.userLabel : null,
    txnDate: typeof row.txnDate === "string" ? row.txnDate : new Date().toISOString(),
    departmentId: typeof row.departmentId === "string" ? row.departmentId : null,
    cardId: typeof row.cardId === "string" ? row.cardId : null,
    userId: typeof row.userId === "string" ? row.userId : null,
    projectId: typeof row.projectId === "string" ? row.projectId : null,
    hasReceipt: typeof row.hasReceipt === "boolean" ? row.hasReceipt : null,
  }));

