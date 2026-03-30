"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { RuleForm } from "@/app/policy-rules/_components/rule-form";
import type { PolicyRuleDetail } from "@/types/policy-rules";

async function fetchRule(ruleId: string): Promise<PolicyRuleDetail> {
  const res = await fetch(`/api/v1/policy-rules/${ruleId}`, { credentials: "include" });
  if (!res.ok) throw new Error("규칙 상세를 불러오지 못했습니다.");
  return res.json();
}

export default function EditPolicyRulePage() {
  const params = useParams<{ ruleId: string }>();
  const router = useRouter();
  const ruleId = params.ruleId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["policy-rule-edit", ruleId],
    queryFn: () => fetchRule(ruleId),
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-slate-900">정책 규칙 수정</h1>
      <p className="mt-1 text-sm text-slate-500">규칙 메타 업데이트 + 새 버전 생성을 수행합니다.</p>

      {isLoading && <p className="mt-6 text-sm text-slate-600">불러오는 중...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{(error as Error).message}</p>}

      {data && (
        <div className="mt-6">
          <RuleForm
            mode="edit"
            initial={data}
            onSubmit={async (payload) => {
              const { changeSummary, changeReason, actions, conditions, scopes, exceptions, ...meta } = payload;

              const resMeta = await fetch(`/api/v1/policy-rules/${ruleId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(meta),
              });
              const jsonMeta = await resMeta.json().catch(() => ({}));
              if (!resMeta.ok) throw new Error(jsonMeta.error ?? "규칙 메타 수정 실패");

              const resVersion = await fetch(`/api/v1/policy-rules/${ruleId}/versions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  changeSummary,
                  changeReason,
                  severity: meta.severity,
                  actions,
                  conditions,
                  scopes,
                  exceptions,
                }),
              });
              const jsonVersion = await resVersion.json().catch(() => ({}));
              if (!resVersion.ok) throw new Error(jsonVersion.error ?? "새 버전 생성 실패");
              router.push(`/policy-rules/${ruleId}`);
            }}
          />
        </div>
      )}
    </AppShell>
  );
}

