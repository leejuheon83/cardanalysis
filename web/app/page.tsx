"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { SetupNotice } from "@/components/setup-notice";
import Link from "next/link";
import type { SetupAwareResponse } from "@/types";

type Dashboard = SetupAwareResponse & {
  totalTransactions: number;
  flaggedTransactions: number;
  violationCount: number;
  pendingReviews: number;
};

async function fetchDashboard(): Promise<Dashboard> {
  const res = await fetch("/api/dashboard", { credentials: "include" });
  if (!res.ok) throw new Error("대시보드 로드 실패");
  return res.json();
}

export default function HomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-slate-900">대시보드</h1>
      <p className="mt-1 text-sm text-slate-500">MVP 지표</p>
      {data?.setupRequired && data.message && <SetupNotice message={data.message} />}

      {isLoading && <p className="mt-6 text-slate-600">불러오는 중…</p>}
      {error && <p className="mt-6 text-red-600">{(error as Error).message}</p>}

      {data && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="총 거래" value={data.totalTransactions} />
          <StatCard label="플래그(대기 또는 리스크≥50)" value={data.flaggedTransactions} />
          <StatCard label="위반 확정 건" value={data.violationCount} />
          <StatCard label="검토 대기" value={data.pendingReviews} />
        </div>
      )}

      <div className="mt-8">
        <Link
          href="/transactions"
          className="text-sm font-medium text-primary underline"
        >
          거래 목록으로 →
        </Link>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
