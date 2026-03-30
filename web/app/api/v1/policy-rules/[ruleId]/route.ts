import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { updateRuleSchema } from "@/lib/policy-rules/contracts";
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

  const rule = await prisma.policyRule.findFirst({
    where: { id: params.ruleId, deletedAt: null },
    include: {
      currentVersion: { include: { conditions: true, scopes: true, exceptions: true } },
    },
  });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  return NextResponse.json({
    id: rule.id,
    ruleCode: rule.ruleCode,
    name: rule.name,
    description: rule.description,
    ruleType: rule.ruleType,
    severity: rule.severity,
    status: rule.status,
    priority: rule.priority,
    tags: rule.tagsJson ?? [],
    currentVersion: rule.currentVersion ? toVersionResponse(rule.currentVersion) : null,
    updatedAt: rule.updatedAt.toISOString(),
  });
}

export async function PATCH(req: Request, { params }: { params: { ruleId: string } }) {
  const session = await getServerSession(authOptions);
  const auth = requireSessionUser(session);
  if (!auth.ok) return auth.response;
  if (!canManagePolicy(auth.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = updateRuleSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const rule = await prisma.policyRule.findFirst({ where: { id: params.ruleId, deletedAt: null } });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  const updated = await prisma.policyRule.update({
    where: { id: rule.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      severity: parsed.data.severity,
      status: parsed.data.status,
      priority: parsed.data.priority,
      tagsJson: parsed.data.tags,
      updatedByUserId: auth.userId,
    },
    include: {
      currentVersion: { include: { conditions: true, scopes: true, exceptions: true } },
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: "policy_rule.update",
    entityType: "PolicyRule",
    entityId: updated.id,
    payload: parsed.data,
  });

  return NextResponse.json({
    id: updated.id,
    ruleCode: updated.ruleCode,
    name: updated.name,
    description: updated.description,
    ruleType: updated.ruleType,
    severity: updated.severity,
    status: updated.status,
    priority: updated.priority,
    tags: updated.tagsJson ?? [],
    currentVersion: updated.currentVersion ? toVersionResponse(updated.currentVersion) : null,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

