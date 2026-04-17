import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCardMonitorSession } from "@/lib/card-monitor/session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await getCardMonitorSession();
  if (!authed) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "잘못된 배치 ID입니다." }, { status: 400 });
  }

  const batch = await prisma.cardImportBatch.findUnique({
    where: { id },
    include: {
      rows: { orderBy: { rowIndex: "asc" } },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "배치를 찾을 수 없습니다." }, { status: 404 });
  }

  const headers = JSON.parse(batch.headersJson) as string[];

  return NextResponse.json({
    batch: {
      id: batch.id,
      filename: batch.filename,
      sheet_name: batch.sheetName ?? "",
      created_at: batch.createdAt.toISOString(),
      row_count: batch.rowCount,
      kpi: {
        total: batch.kpiTotal,
        reviewPending: batch.kpiReview,
        violation: batch.kpiViolation,
        ok: batch.kpiOk,
      },
    },
    headers,
    rows: batch.rows.map((r) => ({
      raw: JSON.parse(r.rawJson) as Record<string, unknown>,
      risk_score: r.riskScore,
      review_status: r.reviewStatus,
      badge_class: r.badgeClass,
      reason: r.reason,
    })),
  });
}
