import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { mapCurrentAiAnalysis } from "@/lib/ai-layer/map-current-ai";
import { buildTransactionWhere, currentAnalysisInclude } from "@/lib/transactions/query";
import {
  getTransactionRowUiStatus,
  matchesStatusTierFilter,
  TRANSACTION_UI_STATUS_LABELS,
  type StatusTierFilter,
} from "@/lib/transaction-row-status";
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

const EXPORT_MAX = 10000;
const FETCH_CAP = 25000;

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
  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { txnDate: "desc" },
    take: FETCH_CAP,
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
  items = items.slice(0, EXPORT_MAX);

  const header = [
    "상태",
    "일시",
    "금액",
    "통화",
    "가맹점",
    "사용자",
    "리스크",
    "AI분류",
    "검토상태",
    "거래ID",
  ];
  const dataRows = items.map((t) => {
    const ui = getTransactionRowUiStatus(t.riskScore, t.reviewStatus);
    return [
      TRANSACTION_UI_STATUS_LABELS[ui],
      new Date(t.txnDate).toLocaleString("ko-KR"),
      Number(t.amount),
      t.currency,
      t.merchantName ?? "",
      t.userLabel ?? "",
      t.riskScore ?? "",
      t.violationCategory ?? "",
      t.reviewStatus,
      t.id,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "거래");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;

  const day = new Date().toISOString().slice(0, 10);
  const asciiName = `transactions-${day}.xlsx`;
  const utfName = `거래목록_${day}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utfName)}`,
    },
  });
}
