"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import type { PolicyRuleDetail, PolicyRuleVersionDto } from "@/types/policy-rules";
import { approvalLabel, inputTypeLabel } from "@/lib/policy-rules/labels";

async function fetchRule(ruleId: string): Promise<PolicyRuleDetail> {
  const res = await fetch(`/api/v1/policy-rules/${ruleId}`, { credentials: "include" });
  if (!res.ok) throw new Error("규칙 상세를 불러오지 못했습니다.");
  return res.json();
}

async function fetchVersions(ruleId: string): Promise<{ items: PolicyRuleVersionDto[] }> {
  const res = await fetch(`/api/v1/policy-rules/${ruleId}/versions`, { credentials: "include" });
  if (!res.ok) throw new Error("버전 목록을 불러오지 못했습니다.");
  return res.json();
}

export default function PolicyRuleSandboxPage() {
  const params = useParams<{ ruleId: string }>();
  const ruleId = params.ruleId;
  const [versionId, setVersionId] = useState("");
  const [inputType, setInputType] = useState<"SINGLE_TRANSACTION" | "SAMPLESET_LAST_DAYS" | "CSV_ROWS">(
    "SINGLE_TRANSACTION",
  );
  const [txJson, setTxJson] = useState(
    JSON.stringify(
      {
        amount: 350000,
        currency: "KRW",
        merchantName: "Sample Merchant",
        category: "MEAL",
        userLabel: "홍길동",
        txnDate: new Date().toISOString(),
        cardId: "card-001",
        hasReceipt: false,
      },
      null,
      2,
    ),
  );
  const [days, setDays] = useState("30");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ruleQuery = useQuery({
    queryKey: ["policy-rule-sandbox", ruleId],
    queryFn: () => fetchRule(ruleId),
  });
  const versionQuery = useQuery({
    queryKey: ["policy-rule-version-list", ruleId],
    queryFn: () => fetchVersions(ruleId),
  });

  const selectedVersionId = useMemo(
    () => versionId || versionQuery.data?.items[0]?.id || ruleQuery.data?.currentVersion?.id || "",
    [ruleQuery.data?.currentVersion?.id, versionId, versionQuery.data?.items],
  );

  const runTest = async () => {
    setError(null);
    setResult(null);
    try {
      if (!selectedVersionId) throw new Error("테스트할 버전을 선택하세요.");
      let body: Record<string, unknown> = { inputType };
      if (inputType === "SINGLE_TRANSACTION") {
        body = { inputType, transaction: JSON.parse(txJson) };
      } else if (inputType === "CSV_ROWS") {
        body = { inputType, csvRows: JSON.parse(txJson) };
      } else {
        body = { inputType, lastDays: Number(days || "30") };
      }

      const res = await fetch(`/api/v1/policy-rules/${ruleId}/versions/${selectedVersionId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "샌드박스 실행 실패");
      setResult(json as Record<string, unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "샌드박스 실행 실패");
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">정책 규칙 테스트 샌드박스</h1>
        <Link href={`/policy-rules/${ruleId}`} className="text-sm text-primary underline">
          규칙 상세로
        </Link>
      </div>

      <div className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-xs font-medium text-slate-600">
          버전 선택
          <select
            value={selectedVersionId}
            onChange={(e) => setVersionId(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {(versionQuery.data?.items ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNo} / {approvalLabel[v.approvalStatus]} / {v.isActive ? "활성" : "비활성"}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-600">
          테스트 입력 타입
          <select
            value={inputType}
            onChange={(e) => setInputType(e.target.value as "SINGLE_TRANSACTION" | "SAMPLESET_LAST_DAYS" | "CSV_ROWS")}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="SINGLE_TRANSACTION">{inputTypeLabel.SINGLE_TRANSACTION}</option>
            <option value="SAMPLESET_LAST_DAYS">{inputTypeLabel.SAMPLESET_LAST_DAYS}</option>
            <option value="CSV_ROWS">{inputTypeLabel.CSV_ROWS}</option>
          </select>
        </label>

        {inputType === "SAMPLESET_LAST_DAYS" ? (
          <label className="block text-xs font-medium text-slate-600">
            조회 일수
            <input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        ) : (
          <label className="block text-xs font-medium text-slate-600">
            구조화 입력(JSON)
            <textarea
              rows={10}
              value={txJson}
              onChange={(e) => setTxJson(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs"
            />
          </label>
        )}

        <button type="button" onClick={runTest} className="rounded bg-primary px-3 py-2 text-sm font-medium text-white">
          샌드박스 실행
        </button>

        {ruleQuery.isLoading || versionQuery.isLoading ? <p className="text-sm text-slate-600">준비 중...</p> : null}
        {(ruleQuery.error || versionQuery.error) && (
          <p className="text-sm text-red-600">규칙 또는 버전 로딩 중 오류가 발생했습니다.</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <pre className="overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </AppShell>
  );
}

