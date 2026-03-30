import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { createRuleSchema } from "@/lib/policy-rules/contracts";
import {
  badRequest,
  canManagePolicy,
  forbidden,
  requireSessionUser,
  toVersionResponse,
} from "@/lib/policy-rules/service";

const querySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  ruleType: z
    .enum(["TIME_BASED", "AMOUNT_BASED", "MERCHANT_CATEGORY_BASED", "DOCUMENT_BASED", "PATTERN_BASED", "ORGANIZATION_BASED"])
    .optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const auth = requireSessionUser(session);
  if (!auth.ok) return auth.response;

  const parsedQuery = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsedQuery.success) return badRequest("Invalid query");

  const q = parsedQuery.data;
  const rules = await prisma.policyRule.findMany({
    where: {
      deletedAt: null,
      status: q.status,
      ruleType: q.ruleType,
      severity: q.severity,
      ...(q.q
        ? {
            OR: [{ name: { contains: q.q } }, { ruleCode: { contains: q.q } }],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      currentVersion: {
        include: { conditions: true, scopes: true, exceptions: true },
      },
    },
    take: 100,
  });

  return NextResponse.json({
    items: rules.map((rule) => ({
      id: rule.id,
      ruleCode: rule.ruleCode,
      name: rule.name,
      ruleType: rule.ruleType,
      severity: rule.severity,
      status: rule.status,
      priority: rule.priority,
      tags: rule.tagsJson ?? [],
      updatedAt: rule.updatedAt.toISOString(),
      currentVersion: rule.currentVersion ? toVersionResponse(rule.currentVersion) : null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const auth = requireSessionUser(session);
  if (!auth.ok) return auth.response;
  if (!canManagePolicy(auth.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = createRuleSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const data = parsed.data;
  const exists = await prisma.policyRule.findUnique({ where: { ruleCode: data.ruleCode } });
  if (exists) return NextResponse.json({ error: "Duplicated ruleCode" }, { status: 409 });

  const created = await prisma.$transaction(async (tx) => {
    const rule = await tx.policyRule.create({
      data: {
        ruleCode: data.ruleCode,
        name: data.name,
        description: data.description ?? null,
        ruleType: data.ruleType,
        severity: data.severity,
        status: "DRAFT",
        priority: data.priority,
        tagsJson: data.tags,
        createdByUserId: auth.userId,
        updatedByUserId: auth.userId,
      },
    });

    const version = await tx.policyRuleVersion.create({
      data: {
        policyRuleId: rule.id,
        versionNo: 1,
        severity: data.severity,
        actionsJson: data.actions,
        changeSummary: data.changeSummary,
        changeReason: data.changeReason,
        createdByUserId: auth.userId,
        conditions: {
          create: data.conditions.map((c) => ({
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
          create: data.scopes.map((s) => ({
            scopeUnitType: s.scopeUnitType,
            scopeUnitId: s.scopeUnitId,
            country: s.country ?? null,
            currency: s.currency ?? null,
            effectiveFrom: s.effectiveFrom ? new Date(s.effectiveFrom) : null,
            effectiveTo: s.effectiveTo ? new Date(s.effectiveTo) : null,
          })),
        },
        exceptions: {
          create: data.exceptions.map((e) => ({
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

    await tx.policyRule.update({
      where: { id: rule.id },
      data: { currentVersionId: version.id },
    });

    return { rule, version };
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: "policy_rule.create",
    entityType: "PolicyRule",
    entityId: created.rule.id,
    payload: {
      ruleCode: created.rule.ruleCode,
      versionNo: created.version.versionNo,
    },
  });

  const versionForResponse = await prisma.policyRuleVersion.findUnique({
    where: { id: created.version.id },
    include: { conditions: true, scopes: true, exceptions: true },
  });
  if (!versionForResponse) {
    return NextResponse.json({ error: "Created version not found" }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: created.rule.id,
      ruleCode: created.rule.ruleCode,
      name: created.rule.name,
      status: created.rule.status,
      currentVersion: toVersionResponse(versionForResponse),
    },
    { status: 201 },
  );
}

