import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCardMonitorSession } from "@/lib/card-monitor/session";

export async function GET() {
  const authed = await getCardMonitorSession();
  if (!authed) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const rows = await prisma.cardImportBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      filename: true,
      sheetName: true,
      createdAt: true,
      rowCount: true,
      kpiTotal: true,
      kpiReview: true,
      kpiViolation: true,
      kpiOk: true,
    },
  });

  const batches = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    sheet_name: r.sheetName ?? "",
    created_at: r.createdAt.toISOString(),
    row_count: r.rowCount,
    kpi_total: r.kpiTotal,
    kpi_review: r.kpiReview,
    kpi_violation: r.kpiViolation,
    kpi_ok: r.kpiOk,
  }));

  return NextResponse.json({ batches });
}
