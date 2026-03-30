"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import type { PolicyRuleDetail } from "@/types/policy-rules";
import { actionLabel, approvalLabel, ruleTypeLabel, severityLabel, statusLabel } from "@/lib/policy-rules/labels";
import {
  formatConditionFromDto,
  formatExceptionFromDto,
  formatScopeFromDto,
} from "@/lib/policy-rules/readable";

async function fetchRule(ruleId: string): Promise<PolicyRuleDetail> {
  const res = await fetch(`/api/v1/policy-rules/${ruleId}`, { credentials: "include" });
  if (!res.ok) throw new Error("규칙 상세를 불러오지 못했습니다.");
  return res.json();
}

export default function PolicyRuleDetailPage() {
  const params = useParams<{ ruleId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const ruleId = params.ruleId;
  const { data, isLoading, error } = useQuery({
    queryKey: ["policy-rule", ruleId],
    queryFn: () => fetchRule(ruleId),
  });

  const deactivate = async () => {
    const reason = window.prompt("비활성화 사유를 입력하세요.");
    if (!reason) return;
    const res = await fetch(`/api/v1/policy-rules/${ruleId}/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "비활성화 실패");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["policy-rule", ruleId] });
    await qc.invalidateQueries({ queryKey: ["policy-rules"] });
  };

  const activateCurrent = async () => {
    const versionId = data?.currentVersion?.id;
    if (!versionId) return;
    const confirmationNote = window.prompt("활성화 확인 메모를 입력하세요.");
    if (!confirmationNote) return;

    const res = await fetch(`/api/v1/policy-rules/${ruleId}/versions/${versionId}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ confirmationNote, requireConflictCheck: true }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error ?? "활성화 실패");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["policy-rule", ruleId] });
    await qc.invalidateQueries({ queryKey: ["policy-rules"] });
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">정책 규칙 상세</h1>
          <p className="mt-1 text-sm text-slate-500">정책 규칙 정의/버전/활성 상태를 확인합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/policy-rules/${ruleId}/edit`} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
            수정
          </Link>
          <Link href={`/policy-rules/${ruleId}/sandbox`} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
            테스트 샌드박스
          </Link>
          <Link href={`/policy-rules/${ruleId}/versions`} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
            버전 이력
          </Link>
        </div>
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-600">불러오는 중...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{(error as Error).message}</p>}

      {data && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                {data.name} <span className="ml-2 text-xs font-mono text-slate-500">{data.ruleCode}</span>
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={activateCurrent}
                  className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white"
                >
                  현재 버전 활성화
                </button>
                <button
                  type="button"
                  onClick={deactivate}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs"
                >
                  비활성화
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">{data.description ?? "설명 없음"}</p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
              <Meta label="상태" value={statusLabel[data.status]} />
              <Meta label="유형" value={ruleTypeLabel[data.ruleType]} />
              <Meta label="심각도" value={severityLabel[data.severity]} />
              <Meta label="우선순위" value={String(data.priority)} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">현재 버전</h3>
            {!data.currentVersion && <p className="mt-2 text-sm text-slate-500">버전이 없습니다.</p>}
            {data.currentVersion && (
              <>
                <p className="mt-2 text-sm text-slate-700">
                  v{data.currentVersion.versionNo} / 승인 {approvalLabel[data.currentVersion.approvalStatus]} / 상태{" "}
                  {data.currentVersion.isActive ? "활성" : "비활성"}
                </p>
                <p className="mt-1 text-sm text-slate-600">{data.currentVersion.changeSummary ?? "-"}</p>
                <div className="mt-3 space-y-2">
                  <SectionTitle title="조건" />
                  {data.currentVersion.conditions.length === 0 ? (
                    <p className="text-xs text-slate-500">조건이 없습니다.</p>
                  ) : (
                    <ul className="space-y-1">
                      {data.currentVersion.conditions.map((c) => (
                        <li key={c.id ?? `${c.field}-${c.orderNo}`} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                          {formatConditionFromDto(c)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  <SectionTitle title="적용 범위" />
                  {data.currentVersion.scopes.length === 0 ? (
                    <p className="text-xs text-slate-500">적용 범위가 없습니다.</p>
                  ) : (
                    <ul className="space-y-1">
                      {data.currentVersion.scopes.map((s) => (
                        <li key={s.id ?? `${s.scopeUnitType}-${s.scopeUnitId}`} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                          {formatScopeFromDto(s)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  <SectionTitle title="예외 대상" />
                  {data.currentVersion.exceptions.length === 0 ? (
                    <p className="text-xs text-slate-500">예외가 없습니다.</p>
                  ) : (
                    <ul className="space-y-1">
                      {data.currentVersion.exceptions.map((e) => (
                        <li key={e.id ?? `${e.targetType}-${e.targetId}`} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                          {formatExceptionFromDto(e)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <pre className="mt-3 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs">
                  {JSON.stringify(
                    {
                      actions: data.currentVersion.actions.map((a) => actionLabel[a]),
                      conditions: data.currentVersion.conditions,
                      scopes: data.currentVersion.scopes,
                      exceptions: data.currentVersion.exceptions,
                    },
                    null,
                    2,
                  )}
                </pre>
              </>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/policy-rules")}
        className="mt-6 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
      >
        목록으로
      </button>
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded bg-slate-50 px-2 py-1">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="ml-2 font-medium">{value}</span>
    </p>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h4 className="text-xs font-semibold text-slate-700">{title}</h4>;
}

