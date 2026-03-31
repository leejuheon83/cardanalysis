"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { SetupNotice } from "@/components/setup-notice";
import type { PolicyRuleListResponse, PolicySeverity, PolicyStatus, PolicyRuleType } from "@/types/policy-rules";
import { ruleTypeLabel, severityLabel, statusLabel } from "@/lib/policy-rules/labels";

async function fetchPolicyRules(query: string): Promise<PolicyRuleListResponse> {
  const res = await fetch(`/api/v1/policy-rules?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("정책 규칙 목록을 불러오지 못했습니다.");
  return res.json();
}

const severityColor: Record<PolicySeverity, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export default function PolicyRuleListPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<PolicyStatus | "">("");
  const [severity, setSeverity] = useState<PolicySeverity | "">("");
  const [ruleType, setRuleType] = useState<PolicyRuleType | "">("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (severity) p.set("severity", severity);
    if (ruleType) p.set("ruleType", ruleType);
    return p.toString();
  }, [q, status, severity, ruleType]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["policy-rules", query],
    queryFn: () => fetchPolicyRules(query),
  });

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">정책 규칙 관리</h1>
          <p className="mt-1 text-sm text-slate-500">코드 변경 없이 위반 규칙을 운영합니다.</p>
        </div>
        <Link
          href="/policy-rules/new"
          aria-disabled={data?.setupRequired ? "true" : "false"}
          className="rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:brightness-95"
        >
          새 규칙
        </Link>
      </div>
      {data?.setupRequired && data.message && <SetupNotice message={data.message} />}

      <div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="검색" value={q} onChange={setQ} placeholder="규칙명/코드" />
        <SelectField
          label="상태"
          value={status}
          onChange={(v) => setStatus(v as PolicyStatus | "")}
          options={[
            { value: "", label: "전체" },
            { value: "DRAFT", label: statusLabel.DRAFT },
            { value: "ACTIVE", label: statusLabel.ACTIVE },
            { value: "INACTIVE", label: statusLabel.INACTIVE },
            { value: "ARCHIVED", label: statusLabel.ARCHIVED },
          ]}
        />
        <SelectField
          label="심각도"
          value={severity}
          onChange={(v) => setSeverity(v as PolicySeverity | "")}
          options={[
            { value: "", label: "전체" },
            { value: "LOW", label: severityLabel.LOW },
            { value: "MEDIUM", label: severityLabel.MEDIUM },
            { value: "HIGH", label: severityLabel.HIGH },
            { value: "CRITICAL", label: severityLabel.CRITICAL },
          ]}
        />
        <SelectField
          label="유형"
          value={ruleType}
          onChange={(v) => setRuleType(v as PolicyRuleType | "")}
          options={[
            { value: "", label: "전체" },
            { value: "TIME_BASED", label: ruleTypeLabel.TIME_BASED },
            { value: "AMOUNT_BASED", label: ruleTypeLabel.AMOUNT_BASED },
            { value: "MERCHANT_CATEGORY_BASED", label: ruleTypeLabel.MERCHANT_CATEGORY_BASED },
            { value: "DOCUMENT_BASED", label: ruleTypeLabel.DOCUMENT_BASED },
            { value: "PATTERN_BASED", label: ruleTypeLabel.PATTERN_BASED },
            { value: "ORGANIZATION_BASED", label: ruleTypeLabel.ORGANIZATION_BASED },
          ]}
        />
      </div>

      <button
        type="button"
        onClick={() => refetch()}
        className="mt-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        필터 적용
      </button>

      {isLoading && <p className="mt-6 text-sm text-slate-600">불러오는 중...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{(error as Error).message}</p>}

      <div className="mt-4 overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">규칙 코드</th>
              <th className="px-3 py-2">규칙명</th>
              <th className="px-3 py-2">유형</th>
              <th className="px-3 py-2">심각도</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">활성 버전</th>
              <th className="px-3 py-2">수정일</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((rule) => (
              <tr key={rule.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{rule.ruleCode}</td>
                <td className="px-3 py-2">{rule.name}</td>
                <td className="px-3 py-2 text-xs">{ruleTypeLabel[rule.ruleType]}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${severityColor[rule.severity]}`}>
                    {severityLabel[rule.severity]}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs font-medium">{statusLabel[rule.status]}</td>
                <td className="px-3 py-2 text-xs">{rule.currentVersion?.versionNo ?? "-"}</td>
                <td className="px-3 py-2 text-xs">{new Date(rule.updatedAt).toLocaleString("ko-KR")}</td>
                <td className="px-3 py-2">
                  <Link href={`/policy-rules/${rule.id}`} className="text-primary underline">
                    상세
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">등록된 규칙이 없습니다.</p>}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        {options.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
    </label>
  );
}

