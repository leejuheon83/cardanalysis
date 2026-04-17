import { NextResponse } from "next/server";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCardMonitorSession } from "@/lib/card-monitor/session";
import { assertAllowedUploadFile } from "@/lib/card-monitor/upload-assert";
import { parseWorkbookBuffer } from "@/lib/card-monitor/parseWorkbook";
import { parsePoliciesFormField } from "@/lib/card-monitor/policies";

export const runtime = "nodejs";
/** Vercel 등에서 대용량 단일 INSERT 타임아웃 완화 */
export const maxDuration = 60;

const ROW_INSERT_CHUNK = 250;

export async function POST(req: Request) {
  const authed = await getCardMonitorSession();
  if (!authed) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart 요청이 필요합니다." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file 필드가 필요합니다." }, { status: 400 });
  }

  try {
    assertAllowedUploadFile(file);
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    if (code === "ALLOWED_FILE_TYPES" || code === "MIME_NOT_ALLOWED") {
      return NextResponse.json(
        { error: "허용되지 않는 파일 형식입니다." },
        { status: 400 },
      );
    }
    throw e;
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const filename = path.basename(file.name || "upload");
    const policiesList = parsePoliciesFormField(form.get("policies"));

    const parsed = parseWorkbookBuffer(buf, filename, policiesList);
    if (!parsed.rows.length) {
      return NextResponse.json(
        { error: "데이터 행이 없습니다. 첫 행을 헤더로 두세요." },
        { status: 400 },
      );
    }

    const id = randomUUID();

    await prisma.$transaction(
      async (tx) => {
        await tx.cardImportBatch.create({
          data: {
            id,
            filename,
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
        filename,
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
    console.error("[api/import/upload]", e);
    return NextResponse.json(
      { error: msg || "서버 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
