import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { createVersionSchema } from "@/lib/policy-rules/contracts";
import {
  badRequest,
  canManagePolicy,
  forbidden,
  requireSessionUser,
  toVersionResponse,
} from "@/lib/policy-rules/service";

export async function GET(_req: Request, { params }: { params: { ruleId: string } }) {
  const session = await getServerSession(authOptions);
  const auth = requireSessionUser(session);
  if (!auth.ok) return auth.response;

  const versions = await prisma.policyRuleVersion.findMany({
    where: { policyRuleId: params.ruleId },
    include: { conditions: true, scopes: true, exceptions: true },
    orderBy: { versionNo: "desc" },
  });

  return NextResponse.json({ items: versions.map(toVersionResponse) });
}

export async function POST(req: Request, { params }: { params: { ruleId: string } }) {
  const session = await getServerSession(authOptions);
  const auth = requireSessionUser(session);
  if (!auth.ok) return auth.response;
  if (!canManagePolicy(auth.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = createVersionSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const rule = await prisma.policyRule.findFirst({ where: { id: params.ruleId, deletedAt: null } });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  const latest = await prisma.policyRuleVersion.findFirst({
    where: { policyRuleId: rule.id },
    orderBy: { versionNo: "desc" },
  });
  const nextVersionNo = (latest?.versionNo ?? 0) + 1;

  const version = await prisma.policyRuleVersion.create({
    data: {
      policyRuleId: rule.id,
      versionNo: nextVersionNo,
      severity: parsed.data.severity,
      actionsJson: parsed.data.actions,
      changeSummary: parsed.data.changeSummary,
      changeReason: parsed.data.changeReason,
      createdByUserId: auth.userId,
      conditions: {
        create: parsed.data.conditions.map((c) => ({
          conditionGroup: c.conditionGroup,
          logicalOp: c.logicalOp,
          field: c.field,
          operator: c.operator,
          valueType: c.valueType,
          valueJson: c.value as Prisma.InputJsonValue,
          orderNo: c.orderNo,
        })),
      },
      scopes: {
        create: parsed.data.scopes.map((s) => ({
          scopeUnitType: s.scopeUnitType,
          scopeUnitId: s.scopeUnitId,
          country: s.country ?? null,
          currency: s.currency ?? null,
          effectiveFrom: s.effectiveFrom ? new Date(s.effectiveFrom) : null,
          effectiveTo: s.effectiveTo ? new Date(s.effectiveTo) : null,
        })),
      },
      exceptions: {
        create: parsed.data.exceptions.map((e) => ({
          targetType: e.targetType,
          targetId: e.targetId,
          reason: e.reason,
          validFrom: e.validFrom ? new Date(e.validFrom) : null,
          validTo: e.validTo ? new Date(e.validTo) : null,
        })),
      },
    },
    include: { conditions: true, scopes: true, exceptions: true },
  });

  await prisma.policyRule.update({
    where: { id: rule.id },
    data: { updatedByUserId: auth.userId, severity: parsed.data.severity, status: "DRAFT" },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: "policy_rule_version.create",
    entityType: "PolicyRuleVersion",
    entityId: version.id,
    payload: { ruleId: rule.id, versionNo: version.versionNo },
  });

  const versionForResponse = await prisma.policyRuleVersion.findUnique({
    where: { id: version.id },
    include: { conditions: true, scopes: true, exceptions: true },
  });
  if (!versionForResponse) {
    return NextResponse.json({ error: "Created version not found" }, { status: 500 });
  }

  return NextResponse.json(toVersionResponse(versionForResponse), { status: 201 });
}

