/** MVP: 거래 필드에서 최소 피처 스냅샷 JSON 생성 (추후 Feature Store로 확장) */
export function buildMinimalFeaturePayload(input: {
  amount: number;
  merchantName?: string | null;
  category?: string | null;
  userLabel?: string | null;
  txnDate: Date;
}) {
  return {
    schema: "v1-minimal",
    amount: input.amount,
    merchantName: input.merchantName ?? null,
    category: input.category ?? null,
    userLabel: input.userLabel ?? null,
    txnDateIso: input.txnDate.toISOString(),
  };
}
