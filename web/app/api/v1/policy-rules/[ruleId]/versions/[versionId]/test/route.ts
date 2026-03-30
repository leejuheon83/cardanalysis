import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { testSchema } from "@/lib/policy-rules/contracts";
import { detectRuleConflicts, runRuleTestSandbox } from "@/lib/policy-rules/engine";
import {
  badRequest,
  canManagePolicy,
  forbidden,
  requireSessionUser,
  toSandboxRule,
  toSandboxTransactionsFromRows,
} from "@/lib/policy-rules/service";

export async function POST(
  req: Request,
  { params }: { params: { ruleId: string; versionId: string } },
) {
  const session = await getServerSession(authOptions);
  const auth = requireSessionUser(session);
  if (!auth.ok) return auth.response;
  if (!canManagePolicy(auth.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const version = await prisma.policyRuleVersion.findFirst({
    where: { id: params.versionId, policyRuleId: params.ruleId },
    include: {
      policyRule: true,
      conditions: true,
      scopes: true,
      exceptions: true,
    },
  });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  let txRows: Record<string, unknown>[] = [];
  if (parsed.data.inputType === "SINGLE_TRANSACTION") {
    if (!parsed.data.transaction) return badRequest("transaction is required");
    txRows = [parsed.data.transaction];
  } else if (parsed.data.inputType === "CSV_ROWS") {
    txRows = parsed.data.csvRows ?? [];
  } else {
    const days = parsed.data.lastDays ?? 30;
    const from = new Date();
    from.setDate(from.getDate() - days);

    const rows = await prisma.transaction.findMany({
      where: { txnDate: { gte: from } },
      orderBy: { txnDate: "desc" },
      take: 200,
    });
    txRows = rows.map((r) => ({
      transactionId: r.id,
      amount: Number(r.amount),
      currency: r.currency,
      merchantName: r.merchantName,
      category: r.category,
      userLabel: r.userLabel,
      txnDate: r.txnDate.toISOString(),
      hasReceipt: Boolean(r.rawMetadata && typeof r.rawMetadata === "object" && "hasReceipt" in r.rawMetadata ? (r.rawMetadata as { hasReceipt?: boolean }).hasReceipt : false),
    }));
  }

  const sandboxRule = toSandboxRule({
    ruleId: version.policyRuleId,
    ruleName: version.policyRule.name,
    severity: version.severity,
    actionsJson: version.actionsJson,
    conditions: version.conditions,
    scopes: version.scopes,
    exceptions: version.exceptions,
  });

  const activeVersions = await prisma.policyRuleVersion.findMany({
    where: {
      isActive: true,
      policyRuleId: { not: version.policyRuleId },
    },
    include: {
      policyRule: true,
      conditions: true,
      scopes: true,
      exceptions: true,
    },
    take: 100,
  });

  const conflicts = detectRuleConflicts([
    sandboxRule,
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

  const result = runRuleTestSandbox(sandboxRule, toSandboxTransactionsFromRows(txRows));
  return NextResponse.json({
    ...result,
    conflictWarnings: conflicts.map((c) => `${c.leftRuleId} vs ${c.rightRuleId}: ${c.reason}`),
  });
}

