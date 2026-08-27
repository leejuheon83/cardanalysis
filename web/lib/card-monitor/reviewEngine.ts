/**
 * 거래 행 자동 검토 — 「접대비 운영지침」(2026.8.1 시행) 기준.
 * design-preview.html 클라이언트 검토와 동일 규칙을 유지해야 한다.
 */
import type { CardPolicy } from "./policies";
import { policyMatches } from "./policies";

export const AMOUNT_KEYS = [
  "금액",
  "이용금액",
  "결제금액",
  "승인금액",
  "amount",
  "amt",
  "payment",
  "total",
];

export const DATE_KEYS = [
  "일시",
  "거래일시",
  "승인일시",
  "이용일",
  "거래일자",
  "날짜",
  "date",
  "datetime",
  "time",
];

export const MERCHANT_KEYS = [
  "가맹점",
  "가맹점명",
  "상호",
  "merchant",
  "store",
  "가맹점명칭",
];

/** 제8조 예) 접객원을 두고 영업하는 유흥업소 및 이에 준하는 유흥성 업종 */
const BANNED_KEYWORDS = [
  "유흥",
  "룸싸롱",
  "룸살롱",
  "단란주점",
  "노래방",
  "가라오케",
  "클럽",
  "CLUB",
  "CASINO",
  "카지노",
  "안마",
  "마사지",
  "BAR",
];

/** 접대 목적성이 높아 분류·증빙 확인이 필요한 업종(제3조) */
const CAUTION_KEYWORDS = ["주점", "술집", "호텔", "모텔", "포차", "와인바"];

/** 골프장 — 접대비 분류 대상이나 지출 자체는 허용(제3조·제8조 7호) */
const GOLF_KEYWORDS = ["골프", "컨트리클럽", "GOLF", "C.C"];

/** 거래처 경조사 관련(제3조·제7조) */
const CONDOLENCE_KEYWORDS = [
  "화환",
  "경조",
  "부의",
  "조의",
  "축의",
  "장례",
  "상조",
  "플라워",
];

/** 택시·카페 등 동일일 다건 결제가 정상인 가맹점 — 분할 결제 의심(제8조 5호)에서 제외 */
const SPLIT_EXEMPT_KEYWORDS = ["티머니모빌리티", "에스씨케이컴퍼니"];

/** 제3조 2호 — 건당 30만원 이상은 접대비로 분류 */
export const ENTERTAINMENT_CLASSIFY_MIN = 300_000;

export function norm(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/\s/g, "")
    .toLowerCase();
}

export function matchKey(header: string, keys: string[]): boolean {
  const h = norm(header);
  for (let i = 0; i < keys.length; i++) {
    if (h.includes(norm(keys[i]))) return true;
  }
  return false;
}

export function parseAmount(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const s = String(v).replace(/[,₩$원\s]/g, "").trim();
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

export function mapHeaders(headers: string[]) {
  let idxAmount = -1;
  let idxDate = -1;
  let idxMerchant = -1;
  for (let c = 0; c < headers.length; c++) {
    const h = headers[c];
    if (idxAmount < 0 && matchKey(h, AMOUNT_KEYS)) idxAmount = c;
    if (idxDate < 0 && matchKey(h, DATE_KEYS)) idxDate = c;
    if (idxMerchant < 0 && matchKey(h, MERCHANT_KEYS)) idxMerchant = c;
  }
  return { idxAmount, idxDate, idxMerchant };
}

/** 제4조 — 건당 금액별 승인(전결)권자 */
export function approverFor(amount: number): string {
  if (amount > 5_000_000) return "대표이사";
  if (amount > 3_000_000) return "본부장";
  if (amount > 1_000_000) return "국장";
  return "팀장";
}

function findKeyword(merchant: string, list: string[]): string | null {
  const mu = merchant.toUpperCase();
  for (const w of list) {
    if (merchant.includes(w) || mu.includes(w.toUpperCase())) return w;
  }
  return null;
}

export type ReviewResult = {
  risk: number;
  status: string;
  badge: string;
  rowClass: string;
  reason: string;
};

export type ReviewableRow = {
  _amount?: number;
  _merchant?: string;
  _date?: unknown;
};

function statusFromRisk(risk: number) {
  if (risk >= 72) {
    return {
      status: "위반 의심",
      badge: "badge-violation",
      rowClass: "row-flag-violation",
    };
  }
  if (risk >= 48) {
    return {
      status: "검토 대기",
      badge: "badge-pending",
      rowClass: "row-flag-pending",
    };
  }
  if (risk >= 28) {
    return {
      status: "의심",
      badge: "badge-suspicious",
      rowClass: "row-flag-suspicious",
    };
  }
  return { status: "정상", badge: "badge-approved", rowClass: "" };
}

const NORMAL_REASON = "지침 자동점검 통과 — 접대비 운영지침(2026.8.1)";

function evaluate(
  row: ReviewableRow,
  policies: CardPolicy[],
  extraFlags: string[] = [],
  extraRisk = 0,
): ReviewResult {
  const amount = row._amount || 0;
  const merchant = String(row._merchant || "");
  let risk = 5;
  const flags: string[] = [];

  // 골프장은 허용 업종(제8조 7호) — 「컨트리클럽」이 금지 키워드 「클럽」에 걸리지 않도록 먼저 판정
  if (findKeyword(merchant, GOLF_KEYWORDS)) {
    risk += 18;
    flags.push("골프장 지출 — 접대비 분류(제3조)·참석자/목적 증빙 확인");
  } else {
    const banned = findKeyword(merchant, BANNED_KEYWORDS);
    if (banned) {
      risk += 70;
      flags.push(
        `유흥성 업종 의심 「${banned}」 — 제8조 금지(업무상 필요 시 본부장 보고)`,
      );
    } else {
      const caution = findKeyword(merchant, CAUTION_KEYWORDS);
      if (caution) {
        risk += 22;
        flags.push(`접대성 업종 주의 「${caution}」 — 접대비 분류·증빙 확인(제3조)`);
      }
    }
  }

  const condolence = findKeyword(merchant, CONDOLENCE_KEYWORDS);
  if (condolence) {
    risk += 12;
    flags.push(
      "거래처 경조사비(제7조) — 청탁금지법 한도·팀 단위 1회·SBS 계열 지출 금지 확인",
    );
  }

  if (amount >= ENTERTAINMENT_CLASSIFY_MIN) {
    risk += 10;
    flags.push("접대비 분류 대상 — 건당 30만원 이상(제3조)");
  }
  if (amount > 5_000_000) {
    risk += 30;
    flags.push("대표이사 전결 대상 — 500만원 초과(제4조)");
  } else if (amount > 3_000_000) {
    risk += 20;
    flags.push("본부장 전결 대상 — 300만원 초과(제4조)");
  } else if (amount > 1_000_000) {
    risk += 12;
    flags.push("국장 전결 대상 — 100만원 초과(제4조)");
  }

  for (const p of policies) {
    if (policyMatches(p, row)) {
      risk += 18;
      flags.push(`정책: ${p.name}`);
    }
  }

  flags.push(...extraFlags);
  risk += extraRisk;

  risk = Math.min(99, Math.round(risk));
  const s = statusFromRisk(risk);
  const reason = flags.length > 0 ? flags.join(" · ") : NORMAL_REASON;
  return { risk, status: s.status, badge: s.badge, rowClass: s.rowClass, reason };
}

export function autoReview(row: ReviewableRow): ReviewResult {
  return evaluate(row, []);
}

/** 정책 관리 탭 규칙을 적용한 검토 (design-preview `autoReview` 와 동일) */
export function autoReviewWithPolicies(
  row: ReviewableRow,
  policies: CardPolicy[],
): ReviewResult {
  return evaluate(row, policies);
}

/** 일자 키(YYYY-MM-DD 등) — 분할·중복 결제 판정용 */
export function dayKeyOf(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && !Number.isNaN(v)) {
    return String(Math.floor(v));
  }
  const s = String(v).trim();
  const m = s.match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/);
  if (m) return m[0].replace(/[./]/g, "-");
  return s.split(/[\sT]/)[0] || s;
}

/**
 * 제8조 4·5호 — 동일 건 중복, 동일일·동일 가맹점 분할 결제 의심.
 * 행 전체를 보고 각 행의 검토 결과를 재계산한다.
 */
export function reviewRowsWithGuideline(
  rows: ReviewableRow[],
  policies: CardPolicy[],
): ReviewResult[] {
  const groupCount = new Map<string, number>();
  const dupCount = new Map<string, number>();
  const keys: Array<{ g: string; d: string }> = [];

  for (const row of rows) {
    const day = dayKeyOf(row._date);
    const merchant = norm(row._merchant);
    const g = day && merchant ? `${day}|${merchant}` : "";
    const d = g ? `${g}|${row._amount || 0}` : "";
    keys.push({ g, d });
    if (g) groupCount.set(g, (groupCount.get(g) || 0) + 1);
    if (d) dupCount.set(d, (dupCount.get(d) || 0) + 1);
  }

  return rows.map((row, i) => {
    const extraFlags: string[] = [];
    let extraRisk = 0;
    const splitExempt =
      findKeyword(String(row._merchant || ""), SPLIT_EXEMPT_KEYWORDS) != null;
    const { g, d } = keys[i];
    const gc = g ? groupCount.get(g) || 0 : 0;
    const dc = d ? dupCount.get(d) || 0 : 0;
    if (gc >= 2 && !splitExempt) {
      extraRisk += 28;
      extraFlags.push(
        `분할 결제 의심 — 동일일 동일 가맹점 ${gc}건(제8조 5호)`,
      );
    }
    if (dc >= 2) {
      extraRisk += 15;
      extraFlags.push("동일 건 중복 의심 — 일시·가맹점·금액 일치(제8조 4호)");
    }
    return evaluate(row, policies, extraFlags, extraRisk);
  });
}

export function summarizeKpiFromReviews(reviews: ReviewResult[]) {
  let pending = 0;
  let viol = 0;
  let ok = 0;
  for (const ev of reviews) {
    if (ev.status === "위반 의심") viol += 1;
    else if (ev.status === "정상") ok += 1;
    else pending += 1;
  }
  return {
    total: reviews.length,
    reviewPending: pending,
    violation: viol,
    ok,
  };
}

export function summarizeKpi(objects: ReviewableRow[]) {
  return summarizeKpiFromReviews(reviewRowsWithGuideline(objects, []));
}
