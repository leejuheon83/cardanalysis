import type { TransactionRowUiStatus } from "@/lib/transaction-row-status";
import { TRANSACTION_UI_STATUS_LABELS } from "@/lib/transaction-row-status";

const styles: Record<TransactionRowUiStatus, string> = {
  normal: "bg-slate-100 text-slate-700 ring-slate-200",
  suspicious: "bg-amber-100 text-amber-900 ring-amber-200",
  violation: "bg-red-100 text-red-900 ring-red-200",
};

export function TransactionStatusBadge({ status }: { status: TransactionRowUiStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {TRANSACTION_UI_STATUS_LABELS[status]}
    </span>
  );
}
