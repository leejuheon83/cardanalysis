"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";

type Log = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: unknown;
  createdAt: string;
  actorEmail: string | null;
  actorName: string | null;
};

async function fetchAudit(): Promise<{ items: Log[] }> {
  const res = await fetch("/api/audit", { credentials: "include" });
  if (!res.ok) throw new Error("감사 로그 로드 실패");
  return res.json();
}

export default function AuditPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit"],
    queryFn: fetchAudit,
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-slate-900">감사 로그</h1>
      <p className="mt-1 text-sm text-slate-500">최근 100건</p>

      {isLoading && <p className="mt-6">불러오는 중…</p>}
      {error && <p className="mt-6 text-red-600">{(error as Error).message}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">시각</th>
              <th className="px-3 py-2">액터</th>
              <th className="px-3 py-2">액션</th>
              <th className="px-3 py-2">엔티티</th>
              <th className="px-3 py-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="px-3 py-2 text-xs text-slate-600">
                  {new Date(l.createdAt).toLocaleString("ko-KR")}
                </td>
                <td className="px-3 py-2 text-xs">{l.actorEmail ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-3 py-2 text-xs">
                  {l.entityType}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{l.entityId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
