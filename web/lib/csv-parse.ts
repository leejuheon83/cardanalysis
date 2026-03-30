import Papa from "papaparse";
import { excelSerialToLocalDate, maybeExcelSerial } from "@/lib/excel-date-serial";

export type ParsedRow = Record<string, string>;

export function parseCsvText(text: string): { headers: string[]; rows: ParsedRow[] } {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const data = result.data as string[][];
  if (!data.length) return { headers: [], rows: [] };

  const headers = data[0].map((h, i) => String(h).trim() || `col_${i}`);
  const rows: ParsedRow[] = [];
  for (let r = 1; r < data.length; r++) {
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

function norm(s: string) {
  return s.replace(/\s/g, "").toLowerCase();
}

/** 열 이름 우선순위: 신청금액만 0인 행이 있어도 총금액을 쓰도록 */
const AMOUNT_HEADER_PRIORITY = [
  "총금액",
  "이용금액",
  "결제금액",
  "신청금액",
  "금액",
  "amount",
  "amt",
  "payment",
];
const DATE_KEYS = ["일시", "거래일시", "날짜", "date", "txn", "승인일시"];
/** '승인일'은 '승인일자'보다 뒤에 두면 안 됨: 승인일자 열에 승인일이 부분일치함 */
const DATE_ONLY_KEYS = ["일자", "거래일", "승인일자", "이용일자", "승인일", "date"];
const TIME_ONLY_KEYS = ["시간", "거래시간", "승인시간", "승인시각", "시각", "time"];
const MERCHANT_KEYS = ["가맹점", "가맹점명", "상호", "merchant", "store"];
const MERCHANT_EXTRA_KEYS = ["업체명", "가맹점업체명", "merchantname"];
const USER_KEYS = ["사용자", "소지자", "직원", "user", "cardholder", "employee"];
const CAT_KEYS = ["카테고리", "category", "업종", "분류"];
const DESC_KEYS = ["적요", "비고", "사유", "description", "memo"];

function pick(row: ParsedRow, keys: string[]): string | undefined {
  const cols = Object.keys(row);
  for (const col of cols) {
    const n = norm(col);
    for (const k of keys) {
      if (n.includes(norm(k))) return row[col];
    }
  }
  return undefined;
}

function pickAmount(row: ParsedRow): string | undefined {
  for (const hint of AMOUNT_HEADER_PRIORITY) {
    const nh = norm(hint);
    for (const col of Object.keys(row)) {
      if (norm(col).includes(nh)) return row[col];
    }
  }
  return undefined;
}

/** YYYYMMDD (구분 없음, 카드사 엑셀 흔함) */
function parseCompactYmd(s: string): Date | null {
  const t = s.trim().replace(/\s/g, "");
  const m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d;
}

function parseKoreanLooseDate(s: string): Date | null {
  const dotted = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (dotted) {
    const d = new Date(Number(dotted[1]), Number(dotted[2]) - 1, Number(dotted[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const hangul = s.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (hangul) {
    const d = new Date(Number(hangul[1]), Number(hangul[2]) - 1, Number(hangul[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseHms(t: string): { h: number; m: number; s: number } | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]), s: Number(m[3] ?? 0) };
}

/** 업로드 엑셀/CSV에서 거래일시 파싱 (엑셀 시리얼·한국식 날짜·시간 소수부 등) */
export function parseFlexibleDateTime(datePart: string, timePart?: string): Date | null {
  const d = datePart.trim();
  if (!d) return null;
  const tRaw = timePart?.trim();

  if (!tRaw) {
    const compact = parseCompactYmd(d);
    if (compact) return compact;
    const serial = maybeExcelSerial(d);
    if (serial != null && serial >= 20000 && serial < 65000) {
      return excelSerialToLocalDate(serial);
    }
    const tryNative = new Date(d);
    if (!Number.isNaN(tryNative.getTime())) return tryNative;
    return parseKoreanLooseDate(d);
  }

  const dSerial = maybeExcelSerial(d);
  const tSerial = maybeExcelSerial(tRaw);

  if (
    dSerial != null &&
    dSerial >= 20000 &&
    dSerial < 65000 &&
    tSerial != null &&
    tSerial >= 0 &&
    tSerial < 1
  ) {
    return excelSerialToLocalDate(Math.floor(dSerial) + tSerial);
  }

  if (dSerial != null && dSerial >= 20000 && dSerial < 65000 && tSerial == null) {
    const base = excelSerialToLocalDate(Math.floor(dSerial));
    const hms = parseHms(tRaw);
    if (hms) {
      return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hms.h, hms.m, hms.s);
    }
  }

  if (dSerial == null && tSerial != null && tSerial >= 0 && tSerial < 1) {
    const base = parseFlexibleDateTime(d);
    if (base) {
      return new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        0,
        0,
        0,
        Math.round(tSerial * 86400000),
      );
    }
  }

  const ymdOnly = parseCompactYmd(d);
  if (ymdOnly) {
    const hms = parseHms(tRaw);
    if (hms) {
      return new Date(
        ymdOnly.getFullYear(),
        ymdOnly.getMonth(),
        ymdOnly.getDate(),
        hms.h,
        hms.m,
        hms.s,
      );
    }
    return ymdOnly;
  }

  const combined = `${d} ${tRaw}`;
  const fromCombined = new Date(combined);
  if (!Number.isNaN(fromCombined.getTime())) return fromCombined;
  const kd = parseKoreanLooseDate(combined);
  if (kd) {
    const hms = parseHms(tRaw);
    if (hms) {
      return new Date(kd.getFullYear(), kd.getMonth(), kd.getDate(), hms.h, hms.m, hms.s);
    }
    return kd;
  }
  return null;
}

export function rowToTransactionInput(row: ParsedRow): {
  amount: number;
  txnDate: Date;
  merchantName?: string;
  userLabel?: string;
  category?: string;
  description?: string;
} | null {
  const amountStr = pickAmount(row);
  const combinedDate = pick(row, DATE_KEYS);
  const dateOnly = pick(row, DATE_ONLY_KEYS);
  const timeOnly = pick(row, TIME_ONLY_KEYS);

  const txnDate = combinedDate
    ? parseFlexibleDateTime(String(combinedDate).trim())
    : dateOnly
      ? parseFlexibleDateTime(String(dateOnly).trim(), timeOnly ? String(timeOnly).trim() : undefined)
      : null;

  if (!amountStr || !txnDate || Number.isNaN(txnDate.getTime())) return null;

  const amount = parseFloat(String(amountStr).replace(/[,₩$원\s\u3000]/g, ""));
  if (Number.isNaN(amount)) return null;

  return {
    amount,
    txnDate,
    merchantName: pick(row, [...MERCHANT_KEYS, ...MERCHANT_EXTRA_KEYS]),
    userLabel: pick(row, USER_KEYS),
    category: pick(row, CAT_KEYS),
    description: pick(row, DESC_KEYS),
  };
}
