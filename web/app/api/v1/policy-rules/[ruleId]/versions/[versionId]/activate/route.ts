import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { activateSchema } from "@/lib/policy-rules/contracts";
import { detectRuleConflicts } from "@/lib/policy-rules/engine";
import {
  badRequest,
  canActivatePolicy,
  forbidden,
  requireSessionUser,
  toSandboxRule,
} from "@/lib/policy-rules/service";

export async function POST(
  req: Request,
  { params }: { params: { ruleId: string; versionId: string } },
) {
  const session = await getServerSession(authOptions);
  const auth = requireSessionUser(session);
  if (!auth.ok) return auth.response;
  if (!canActivatePolicy(auth.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = activateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const version = await prisma.policyRuleVersion.findFirst({
    where: { id: params.versionId, policyRuleId: params.ruleId },
    include: { policyRule: true, conditions: true, scopes: true, exceptions: true },
  });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  if (parsed.data.requireConflictCheck) {
    const activeVersions = await prisma.policyRuleVersion.findMany({
      where: { isActive: true, policyRuleId: { not: params.ruleId } },
      include: { policyRule: true, conditions: true, scopes: true, exceptions: true },
    });
    const conflicts = detectRuleConflicts([
      toSandboxRule({
        ruleId: version.policyRuleId,
        ruleName: version.policyRule.name,
        severity: version.severity,
        actionsJson: version.actionsJson,
        conditions: version.conditions,
        scopes: version.scopes,
        exceptions: version.exceptions,
      }),
      ...activeVersions.map((v) =>
        toSandboxRule({
          ruleId: v.policyRuleId,
          ruleName: v.policyRule.name,
          severity: v.severity,
          actionsJson: v.actionsJson,
          conditions: v.conditions,
          scopes: v.scopes,
          exceptions: v.exceptions,
        }),
      ),
    ]);
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: "Rule conflicts found",
          conflicts,
        },
        { status: 409 },
      );
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.policyRuleVersion.updateMany({
      where: { policyRuleId: params.ruleId, isActive: true },
      data: { isActive: false, deactivatedAt: now },
    });

    await tx.policyRuleVersion.update({
      where: { id: params.versionId },
      data: {
        isActive: true,
        approvalStatus: "APPROVED",
        approvedByUserId: auth.userId,
        approvedAt: now,
        activatedAt: now,
      },
    });

    await tx.policyRule.update({
      where: { id: params.ruleId },
      data: {
        status: "ACTIVE",
        currentVersionId: params.versionId,
        updatedByUserId: auth.userId,
      },
    });
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: "policy_rule.activate",
    entityType: "PolicyRuleVersion",
    entityId: params.versionId,
    payload: {
      ruleId: params.ruleId,
      confirmationNote: parsed.data.confirmationNote,
    },
  });

  return NextResponse.json({
    ruleId: params.ruleId,
    activeVersionId: params.versionId,
    activatedAt: now.toISOString(),
  });
}

