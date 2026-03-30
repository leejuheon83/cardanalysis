import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { mapCurrentAiAnalysis } from "@/lib/ai-layer/map-current-ai";
import { buildTransactionWhere, currentAnalysisInclude } from "@/lib/transactions/query";
import { matchesStatusTierFilter, type StatusTierFilter } from "@/lib/transaction-row-status";
import { z } from "zod";

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  userLabel: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  statusTier: z
    .enum(["all", "normal", "suspicious", "violation", "attention"])
    .optional(),
});

const LIST_LIMIT = 200;
const FETCH_CAP = 8000;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  const tier: StatusTierFilter = q.statusTier ?? "all";

  const where = buildTransactionWhere(q);
  const rawTake = tier === "all" ? LIST_LIMIT : FETCH_CAP;

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { txnDate: "desc" },
    take: rawTake,
    include: {
      aiAnalysisResults: currentAnalysisInclude,
      review: true,
    },
  });

  let items = rows.map((t) => {
    const ai = mapCurrentAiAnalysis(t.aiAnalysisResults);
    return {
      id: t.id,
      amount: t.amount.toString(),
      currency: t.currency,
      merchantName: t.merchantName,
      category: t.category,
      userLabel: t.userLabel,
      txnDate: t.txnDate.toISOString(),
      riskScore: ai?.riskScore ?? null,
      violationCategory: ai?.violationCategory ?? null,
      reviewStatus: t.review?.status ?? "PENDING",
    };
  });

  if (tier !== "all") {
    items = items.filter((t) => matchesStatusTierFilter(t.riskScore, t.reviewStatus, tier));
  }
  items = items.slice(0, LIST_LIMIT);

  return NextResponse.json({ items });
}
