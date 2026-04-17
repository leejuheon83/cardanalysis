/**
 * 거래 행 자동 검토 — server/src/reviewEngine.js · design-preview 와 동일 정책
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

const SENSITIVE = [
  "유흥",
  "룸싸롱",
  "룸",
  "호텔",
  "모텔",
  "주점",
  "술집",
  "BAR",
  "CASINO",
  "노래방",
  "안마",
];

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

export type ReviewResult = {
  risk: number;
  status: string;
  badge: string;
  rowClass: string;
  reason: string;
};

export function autoReview(row: {
  _amount?: number;
  _merchant?: string;
}): ReviewResult {
  const amount = row._amount || 0;
  const merchant = String(row._merchant || "");
  let risk = 8;
  const flags: string[] = [];

  if (amount >= 1_000_000) {
    risk += 45;
    flags.push("고액(100만원 이상)");
  } else if (amount >= 500_000) {
    risk += 32;
    flags.push("고액(50만원 이상)");
  } else if (amount >= 200_000) {
    risk += 18;
    flags.push("중고액(20만원 이상)");
  }

  const mu = merchant.toUpperCase();
  for (let i = 0; i < SENSITIVE.length; i++) {
    const w = SENSITIVE[i];
    if (merchant.includes(w) || mu.includes(w.toUpperCase())) {
      risk += 28;
      flags.push(`금지/주의 업종 키워드: ${w}`);
      break;
    }
  }

  risk = Math.min(99, Math.round(risk));

  let status: string;
  let badge: string;
  let rowClass: string;
  if (risk >= 72) {
    status = "위반 의심";
    badge = "badge-violation";
    rowClass = "row-flag-violation";
  } else if (risk >= 48) {
    status = "검토 대기";
    badge = "badge-pending";
    rowClass = "row-flag-pending";
  } else if (risk >= 28) {
    status = "의심";
    badge = "badge-suspicious";
    rowClass = "row-flag-suspicious";
  } else {
    status = "정상";
    badge = "badge-approved";
    rowClass = "";
  }

  const reason =
    flags.length > 0 ? flags.join(" · ") : "자동 규칙 미충족(정상 구간)";

  return { risk, status, badge, rowClass, reason };
}

const NORMAL_REASON = "자동 규칙 미충족(정상 구간)";

/** 정책 관리 탭 규칙을 적용한 검토 (design-preview `autoReview` 와 동일) */
export function autoReviewWithPolicies(
  row: { _amount?: number; _merchant?: string; _date?: unknown },
  policies: CardPolicy[],
): ReviewResult {
  const base = autoReview(row);
  let risk = base.risk;
  const flags =
    base.reason === NORMAL_REASON ? [] : base.reason.split(" · ");

  for (const p of policies) {
    if (policyMatches(p, row)) {
      risk += 18;
      flags.push(`정책: ${p.name}`);
    }
  }
  risk = Math.min(99, Math.round(risk));

  let status: string;
  let badge: string;
  let rowClass: string;
  if (risk >= 72) {
    status = "위반 의심";
    badge = "badge-violation";
    rowClass = "row-flag-violation";
  } else if (risk >= 48) {
    status = "검토 대기";
    badge = "badge-pending";
    rowClass = "row-flag-pending";
  } else if (risk >= 28) {
    status = "의심";
    badge = "badge-suspicious";
    rowClass = "row-flag-suspicious";
  } else {
    status = "정상";
    badge = "badge-approved";
    rowClass = "";
  }

  const reason =
    flags.length > 0 ? flags.join(" · ") : NORMAL_REASON;

  return { risk, status, badge, rowClass, reason };
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

export function summarizeKpi(
  objects: Array<{ _amount?: number; _merchant?: string }>,
) {
  let pending = 0;
  let viol = 0;
  let ok = 0;
  for (const o of objects) {
    const ev = autoReview(o);
    if (ev.status === "위반 의심") viol += 1;
    else if (ev.status === "정상") ok += 1;
    else pending += 1;
  }
  return {
    total: objects.length,
    reviewPending: pending,
    violation: viol,
    ok,
  };
}
