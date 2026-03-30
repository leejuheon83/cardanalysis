import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { rollbackSchema } from "@/lib/policy-rules/contracts";
import { badRequest, canActivatePolicy, forbidden, requireSessionUser } from "@/lib/policy-rules/service";

export async function POST(req: Request, { params }: { params: { ruleId: string } }) {
  const session = await getServerSession(authOptions);
  const auth = requireSessionUser(session);
  if (!auth.ok) return auth.response;
  if (!canActivatePolicy(auth.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = rollbackSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const target = await prisma.policyRuleVersion.findFirst({
    where: { id: parsed.data.targetVersionId, policyRuleId: params.ruleId },
  });
  if (!target) return NextResponse.json({ error: "Target version not found" }, { status: 404 });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.policyRuleVersion.updateMany({
      where: { policyRuleId: params.ruleId, isActive: true },
      data: { isActive: false, deactivatedAt: now },
    });
    await tx.policyRuleVersion.update({
      where: { id: target.id },
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
        currentVersionId: target.id,
        updatedByUserId: auth.userId,
      },
    });
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: "policy_rule.rollback",
    entityType: "PolicyRule",
    entityId: params.ruleId,
    payload: {
      targetVersionId: target.id,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({
    ruleId: params.ruleId,
    activeVersionId: target.id,
    rolledBackAt: now.toISOString(),
  });
}

