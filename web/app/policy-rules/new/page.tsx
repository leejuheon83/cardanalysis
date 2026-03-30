"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { RuleForm } from "@/app/policy-rules/_components/rule-form";

export default function NewPolicyRulePage() {
  const router = useRouter();

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-slate-900">정책 규칙 생성</h1>
      <p className="mt-1 text-sm text-slate-500">초안 규칙과 첫 버전을 동시에 생성합니다.</p>

      <div className="mt-6">
        <RuleForm
          mode="create"
          onSubmit={async (payload) => {
            const res = await fetch("/api/v1/policy-rules", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error ?? "규칙 생성 실패");
            router.push(`/policy-rules/${json.id}`);
          }}
        />
      </div>
    </AppShell>
  );
}

