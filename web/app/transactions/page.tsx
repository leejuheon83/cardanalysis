"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell";
import { TransactionStatusBadge } from "@/components/status-badge";
import {
  getTransactionRowUiStatus,
  rowStatusClass,
} from "@/lib/transaction-row-status";
import type { TransactionListItem } from "@/types";
import type { StatusTierFilter } from "@/lib/transaction-row-status";

async function fetchTransactions(qs: string): Promise<{ items: TransactionListItem[] }> {
  const res = await fetch(`/api/transactions?${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error("목록 로드 실패");
  return res.json();
}

const STATUS_TIER_OPTIONS: { value: StatusTierFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "normal", label: "정상" },
  { value: "suspicious", label: "의심" },
  { value: "violation", label: "위반" },
  { value: "attention", label: "의심·위반 (주의만)" },
];

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userLabel, setUserLabel] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [statusTier, setStatusTier] = useState<StatusTierFilter>("all");
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (userLabel) p.set("userLabel", userLabel);
    if (minAmount) p.set("minAmount", minAmount);
    if (maxAmount) p.set("maxAmount", maxAmount);
    if (statusTier && statusTier !== "all") p.set("statusTier", statusTier);
    return p.toString();
  }, [from, to, userLabel, minAmount, maxAmount, statusTier]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["transactions", queryString],
    queryFn: () => fetchTransactions(queryString),
  });

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/transactions/upload", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUploadMsg(json.error ?? "업로드 실패");
      return;
    }
    const errLines =
      Array.isArray(json.errors) && json.errors.length > 0
        ? `\n\n스킵 사유(최대 5건):\n${json.errors.slice(0, 5).join("\n")}`
        : "";
    setUploadMsg(`생성 ${json.created}건, 스킵 ${json.skipped}건${errLines}`);
    await qc.invalidateQueries({ queryKey: ["transactions"] });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
    e.target.value = "";
  }

  async function onExportExcel() {
    setExportErr(null);
    try {
      const res = await fetch(`/api/transactions/export?${queryString}`, { credentials: "include" });
      if (!res.ok) {
        setExportErr("엑셀을 받을 수 없습니다. 로그인 상태를 확인하세요.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      let name = `거래목록_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const m = cd?.match(/filename\*=UTF-8''([^;]+)/i);
      if (m?.[1]) {
        try {
          name = decodeURIComponent(m[1]);
        } catch {
          /* ignore */
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportErr("다운로드 중 오류가 발생했습니다.");
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-slate-900">거래 목록</h1>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-700">엑셀 업로드</p>
        <p className="mt-1 text-xs text-slate-500">
          헤더 예: 사용자, 가맹점명, 승인일 또는 승인일자, 승인시각 또는 승인시간, 총금액 또는
          이용금액 (날짜는 YYYYMMDD 형식 가능)
        </p>
        <input
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="mt-2 text-sm"
          onChange={onUpload}
        />
        {uploadMsg && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{uploadMsg}</p>
        )}
      </div>

      <div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Field label="시작일" type="date" value={from} onChange={setFrom} />
        <Field label="종료일" type="date" value={to} onChange={setTo} />
        <Field label="사용자(부분검색)" value={userLabel} onChange={setUserLabel} />
        <Field label="최소 금액" value={minAmount} onChange={setMinAmount} placeholder="0" />
        <Field label="최대 금액" value={maxAmount} onChange={setMaxAmount} placeholder="9999999" />
        <label className="block text-xs font-medium text-slate-600">
          상태 단계
          <select
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={statusTier}
            onChange={(e) => setStatusTier(e.target.value as StatusTierFilter)}
          >
            {STATUS_TIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          필터 적용
        </button>
        <button
          type="button"
          onClick={() => void onExportExcel()}
          className="rounded border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
        >
          엑셀 다운로드 (현재 필터)
        </button>
      </div>
      {exportErr && <p className="mt-2 text-sm text-red-600">{exportErr}</p>}

      {isLoading && <p className="mt-6">불러오는 중…</p>}
      {error && <p className="mt-6 text-red-600">{(error as Error).message}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="font-medium text-slate-700">행 색상:</span>
        <span className="flex items-center gap-1.5">
          <TransactionStatusBadge status="normal" /> 정상 (리스크 40 미만, 또는 승인·기각)
        </span>
        <span className="flex items-center gap-1.5">
          <TransactionStatusBadge status="suspicious" /> 의심 (리스크 40~69)
        </span>
        <span className="flex items-center gap-1.5">
          <TransactionStatusBadge status="violation" /> 위반 (검토 위반 확정 또는 리스크≥70)
        </span>
      </div>

      <div className="mt-2 max-h-[min(70vh,560px)] overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 shadow-sm">
            <tr>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">일시</th>
              <th className="px-3 py-2">금액</th>
              <th className="px-3 py-2">가맹점</th>
              <th className="px-3 py-2">사용자</th>
              <th className="px-3 py-2">리스크</th>
              <th className="px-3 py-2">분류</th>
              <th className="px-3 py-2">검토</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((t) => {
              const ui = getTransactionRowUiStatus(t.riskScore, t.reviewStatus);
              return (
                <tr
                  key={t.id}
                  className={`border-b border-slate-100/80 ${rowStatusClass(ui)} hover:brightness-[0.99]`}
                >
                  <td className="px-3 py-2">
                    <TransactionStatusBadge status={ui} />
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">
                    {new Date(t.txnDate).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {Number(t.amount).toLocaleString("ko-KR")} {t.currency}
                  </td>
                  <td className="px-3 py-2">{t.merchantName ?? "—"}</td>
                  <td className="px-3 py-2">{t.userLabel ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{t.riskScore ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{t.violationCategory ?? "—"}</td>
                  <td className="px-3 py-2 text-xs font-medium">{t.reviewStatus}</td>
                  <td className="px-3 py-2">
                    <Link href={`/transactions/${t.id}`} className="text-primary underline">
                      상세
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data?.items.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">거래가 없습니다. 엑셀 파일을 업로드하세요.</p>
        )}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
