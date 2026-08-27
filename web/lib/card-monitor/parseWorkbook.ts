import * as XLSX from "xlsx";
import type { CardPolicy } from "@/lib/card-monitor/policies";
import { defaultPolicies } from "@/lib/card-monitor/policies";
import {
  mapHeaders,
  parseAmount,
  reviewRowsWithGuideline,
  summarizeKpiFromReviews,
  type ReviewResult,
} from "@/lib/card-monitor/reviewEngine";

export type ParsedRow = {
  raw: Record<string, unknown>;
  _amount: number;
  _merchant: string;
  _date: unknown;
  review: ReviewResult;
};

export function parseWorkbookBuffer(
  buffer: Buffer,
  filename = "",
  policies?: CardPolicy[],
): {
  sheetName: string;
  filename: string;
  headers: string[];
  rows: ParsedRow[];
  kpi: ReturnType<typeof summarizeKpiFromReviews>;
} {
  const policiesList = policies ?? defaultPolicies();

  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("시트가 없습니다.");
  }
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  }) as unknown[][];
  if (!rows.length) {
    return {
      sheetName,
      filename,
      headers: [],
      rows: [],
      kpi: { total: 0, reviewPending: 0, violation: 0, ok: 0 },
    };
  }

  const headers = rows[0].map((h, i) => {
    const t = String(h).trim();
    return t || `열${i + 1}`;
  });

  const colMap = mapHeaders(headers);
  const objects: ParsedRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const line = rows[r] as unknown[];
    let empty = true;
    for (let j = 0; j < line.length; j++) {
      if (line[j] !== "" && line[j] != null) {
        empty = false;
        break;
      }
    }
    if (empty) continue;

    const raw: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      raw[headers[c]] = line[c];
    }
    const amount =
      colMap.idxAmount >= 0 ? parseAmount(line[colMap.idxAmount]) : 0;
    const merchant =
      colMap.idxMerchant >= 0 ? String(line[colMap.idxMerchant] ?? "") : "";
    const dateVal = colMap.idxDate >= 0 ? line[colMap.idxDate] : "";

    objects.push({
      raw,
      _amount: amount,
      _merchant: merchant,
      _date: dateVal,
      review: null as unknown as ReviewResult,
    });
  }

  // 분할·중복 결제(제8조)는 행 전체를 봐야 하므로 일괄 검토한다.
  const reviews = reviewRowsWithGuideline(objects, policiesList);
  for (let i = 0; i < objects.length; i++) objects[i].review = reviews[i];

  const kpi = summarizeKpiFromReviews(reviews);

  return {
    sheetName,
    filename,
    headers,
    rows: objects,
    kpi,
  };
}
