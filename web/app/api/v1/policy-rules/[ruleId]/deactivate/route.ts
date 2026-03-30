import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { deactivateSchema } from "@/lib/policy-rules/contracts";
import { badRequest, canActivatePolicy, forbidden, requireSessionUser } from "@/lib/policy-rules/service";

export async function POST(req: Request, { params }: { params: { ruleId: string } }) {
  const session = await getServerSession(authOptions);
  const auth = requireSessionUser(session);
  if (!auth.ok) return auth.response;
  if (!canActivatePolicy(auth.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = deactivateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const rule = await prisma.policyRule.findFirst({ where: { id: params.ruleId, deletedAt: null } });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.policyRuleVersion.updateMany({
      where: { policyRuleId: params.ruleId, isActive: true },
      data: { isActive: false, deactivatedAt: now },
    });
    await tx.policyRule.update({
      where: { id: params.ruleId },
      data: { status: "INACTIVE", updatedByUserId: auth.userId },
    });
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: "policy_rule.deactivate",
    entityType: "PolicyRule",
    entityId: params.ruleId,
    payload: { reason: parsed.data.reason },
  });

  return NextResponse.json({ id: params.ruleId, status: "INACTIVE" });
}

