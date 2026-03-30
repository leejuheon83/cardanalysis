import * as XLSX from "xlsx";

export type ParsedRow = Record<string, string>;

function normCell(s: string) {
  return s.replace(/\s/g, "").toLowerCase();
}

/** 제목 행 아래에 헤더가 있는 엑셀(1~2행 머리글 등) 대응 */
const HEADER_HINTS = [
  "총금액",
  "이용금액",
  "승인금액",
  "승인일",
  "승인일자",
  "승인시각",
  "승인시간",
  "승인일시",
  "거래일시",
  "일시",
  "가맹점",
  "가맹점명",
  "업체명",
  "사용자",
  "카드",
];

function headerRowScore(cells: string[]): number {
  let score = 0;
  for (const cell of cells) {
    const n = normCell(cell);
    if (!n) continue;
    for (const hint of HEADER_HINTS) {
      if (n.includes(normCell(hint))) {
        score += 1;
        break;
      }
    }
  }
  return score;
}

function pickHeaderRowIndex(data: string[][], maxScan = 20): number {
  let bestIdx = 0;
  let best = -1;
  const limit = Math.min(maxScan, data.length);
  for (let r = 0; r < limit; r++) {
    const row = data[r] ?? [];
    const cells = row.map((c) => (c != null ? String(c) : ""));
    const sc = headerRowScore(cells);
    if (sc > best) {
      best = sc;
      bestIdx = r;
    }
  }
  return best >= 2 ? bestIdx : 0;
}

export function parseExcelBuffer(buffer: ArrayBuffer): { headers: string[]; rows: ParsedRow[] } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  }) as string[][];

  if (!data.length) return { headers: [], rows: [] };
  const headerIdx = pickHeaderRowIndex(data);
  const headerLine = data[headerIdx] ?? [];
  const headers = headerLine.map((h, i) => String(h).trim() || `col_${i}`);

  const rows: ParsedRow[] = [];
  for (let r = headerIdx + 1; r < data.length; r++) {
    const line = data[r];
    const obj: ParsedRow = {};
    let empty = true;
    for (let c = 0; c < headers.length; c++) {
      const v = line[c] != null ? String(line[c]).trim() : "";
      if (v) empty = false;
      obj[headers[c]] = v;
    }
    if (!empty) rows.push(obj);
  }

  return { headers, rows };
}

