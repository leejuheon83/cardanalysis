/**
 * 목록/상세 UI 단계: 정상 < 의심 < 위반
 * - 검토대기(PENDING)만으로는 의심이 되지 않음(리스크 40 이상일 때만 의심 이상).
 */
export type TransactionRowUiStatus = "normal" | "suspicious" | "violation";

export const TRANSACTION_UI_STATUS_LABELS: Record<TransactionRowUiStatus, string> = {
  normal: "정상",
  suspicious: "의심",
  violation: "위반",
};

/** 목록 API·엑셀 내보내기 필터 */
export type StatusTierFilter = "all" | "normal" | "suspicious" | "violation" | "attention";

export function getTransactionRowUiStatus(
  riskScore: number | null | undefined,
  reviewStatus: string,
): TransactionRowUiStatus {
  if (reviewStatus === "APPROVED" || reviewStatus === "DISMISSED") {
    return "normal";
  }
  const r = riskScore ?? 0;
  if (reviewStatus === "VIOLATION" || r >= 70) {
    return "violation";
  }
  if (r >= 40) {
    return "suspicious";
  }
  return "normal";
}

export function matchesStatusTierFilter(
  riskScore: number | null | undefined,
  reviewStatus: string,
  filter: StatusTierFilter,
): boolean {
  const ui = getTransactionRowUiStatus(riskScore, reviewStatus);
  switch (filter) {
    case "all":
      return true;
    case "attention":
      return ui === "suspicious" || ui === "violation";
    default:
      return ui === filter;
  }
}

export function rowStatusClass(status: TransactionRowUiStatus): string {
  switch (status) {
    case "violation":
      return "border-l-4 border-l-red-600 bg-red-50/80";
    case "suspicious":
      return "border-l-4 border-l-amber-500 bg-amber-50/80";
    default:
      return "border-l-4 border-l-slate-200 bg-white";
  }
}
