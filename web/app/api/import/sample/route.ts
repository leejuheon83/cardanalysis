import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCardMonitorSession } from "@/lib/card-monitor/session";
import { parseWorkbookBuffer } from "@/lib/card-monitor/parseWorkbook";
import { parsePoliciesJson } from "@/lib/card-monitor/policies";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROW_INSERT_CHUNK = 250;

export async function POST(req: Request) {
  const authed = await getCardMonitorSession();
  if (!authed) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let policiesList = parsePoliciesJson(undefined);
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = (await req.json()) as { policies?: unknown };
      policiesList = parsePoliciesJson(body.policies);
    }
  } catch {
    policiesList = parsePoliciesJson(undefined);
  }

  try {
    const ws = XLSX.utils.aoa_to_sheet([
      ["거래일시", "가맹점명", "이용금액", "비고"],
      ["2025-03-26 12:30", "○○식당", 35000, ""],
      ["2025-03-26 14:00", "△△유흥주점", 120000, ""],
      ["2025-03-25 09:00", "□□전자", 1250000, "고액"],
      ["2025-03-24 18:00", "◇◇마트", 89000, ""],
      ["2025-03-23 22:00", "Night BAR Seoul", 450000, ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "거래내역");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const parsed = parseWorkbookBuffer(buf, "sample.xlsx", policiesList);
    const id = randomUUID();

    await prisma.$transaction(
      async (tx) => {
        await tx.cardImportBatch.create({
          data: {
            id,
            filename: "sample.xlsx",
            sheetName: parsed.sheetName || "",
            headersJson: JSON.stringify(parsed.headers),
            rowCount: parsed.rows.length,
            kpiTotal: parsed.kpi.total,
            kpiReview: parsed.kpi.reviewPending,
            kpiViolation: parsed.kpi.violation,
            kpiOk: parsed.kpi.ok,
          },
        });

        for (let i = 0; i < parsed.rows.length; i += ROW_INSERT_CHUNK) {
          const slice = parsed.rows.slice(i, i + ROW_INSERT_CHUNK);
          await tx.cardImportRow.createMany({
            data: slice.map((r, j) => ({
              batchId: id,
              rowIndex: i + j,
              rawJson: JSON.stringify(r.raw),
              riskScore: r.review.risk,
              reviewStatus: r.review.status,
              badgeClass: r.review.badge,
              reason: r.review.reason,
            })),
          });
        }
      },
      { maxWait: 15_000, timeout: 55_000 },
    );

    return NextResponse.json(
      {
        batchId: id,
        sheetName: parsed.sheetName,
        filename: "sample.xlsx",
        kpi: parsed.kpi,
        headers: parsed.headers,
        rows: parsed.rows.map((r) => ({
          raw: r.raw,
          risk_score: r.review.risk,
          review_status: r.review.status,
          badge_class: r.review.badge,
          row_class: r.review.rowClass || "",
          reason: r.review.reason,
        })),
      },
      { status: 201 },
    );
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "서버 처리 중 오류가 발생했습니다.";
    console.error("[api/import/sample]", e);
    return NextResponse.json(
      { error: msg || "서버 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
