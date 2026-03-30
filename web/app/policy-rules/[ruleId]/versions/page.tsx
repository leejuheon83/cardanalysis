"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import type { PolicyRuleVersionDto } from "@/types/policy-rules";
import { approvalLabel } from "@/lib/policy-rules/labels";
import { formatConditionFromDto } from "@/lib/policy-rules/readable";

async function fetchVersions(ruleId: string): Promise<{ items: PolicyRuleVersionDto[] }> {
  const res = await fetch(`/api/v1/policy-rules/${ruleId}/versions`, { credentials: "include" });
  if (!res.ok) throw new Error("버전 이력을 불러오지 못했습니다.");
  return res.json();
}

export default function PolicyRuleVersionsPage() {
  const params = useParams<{ ruleId: string }>();
  const qc = useQueryClient();
  const ruleId = params.ruleId;
  const { data, isLoading, error } = useQuery({
    queryKey: ["policy-rule-versions", ruleId],
    queryFn: () => fetchVersions(ruleId),
  });

  const rollback = async (targetVersionId: string) => {
    const reason = window.prompt("롤백 사유를 입력하세요.");
    if (!reason) return;
    const res = await fetch(`/api/v1/policy-rules/${ruleId}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ targetVersionId, reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error ?? "롤백 실패");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["policy-rule-versions", ruleId] });
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">버전 이력</h1>
        <Link href={`/policy-rules/${ruleId}`} className="text-sm text-primary underline">
          규칙 상세로
        </Link>
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-600">불러오는 중...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{(error as Error).message}</p>}

      <div className="mt-6 space-y-3">
        {data?.items.map((v) => (
          <div key={v.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">
                v{v.versionNo} {v.isActive ? <span className="ml-2 text-xs text-green-700">활성 버전</span> : null}
              </p>
              <button
                type="button"
                onClick={() => rollback(v.id)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                이 버전으로 롤백
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              승인: {approvalLabel[v.approvalStatus]} / 생성: {new Date(v.createdAt).toLocaleString("ko-KR")}
            </p>
            <p className="mt-1 text-sm text-slate-700">{v.changeSummary ?? "-"}</p>
            <div className="mt-2">
              <p className="text-xs font-medium text-slate-700">조건 요약</p>
              {v.conditions.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">조건 없음</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {v.conditions.slice(0, 3).map((c) => (
                    <li key={c.id ?? `${c.field}-${c.orderNo}`} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                      {formatConditionFromDto(c)}
                    </li>
                  ))}
                </ul>
              )}
              {v.conditions.length > 3 && (
                <p className="mt-1 text-xs text-slate-500">외 {v.conditions.length - 3}개 조건</p>
              )}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-primary underline">버전 상세 데이터(JSON)</summary>
              <pre className="mt-2 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs">
                {JSON.stringify(v, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

