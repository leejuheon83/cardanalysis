"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { SetupNotice } from "@/components/setup-notice";
import type { SetupAwareResponse } from "@/types";

type Summary = SetupAwareResponse & {
  counts: {
    modelVersions: number;
    analysisResults: number;
    featureSnapshots: number;
    reviewerFeedbacks: number;
  };
  modelVersions: {
    id: string;
    modelName: string;
    version: string;
    isDeployed: boolean;
    createdAt: string;
  }[];
};

async function fetchSummary(): Promise<Summary> {
  const res = await fetch("/api/ai-layer", { credentials: "include" });
  if (!res.ok) throw new Error("요약 로드 실패");
  return res.json();
}

export default function AiLayerPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-layer"],
    queryFn: fetchSummary,
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-slate-900">AI 레이어 요약</h1>
      <p className="mt-1 text-sm text-slate-500">
        ModelVersion · FeatureSnapshot · AiAnalysisResult · PredictionLabel · ReviewerFeedback 통합 스키마
      </p>
      {data?.setupRequired && data.message && <SetupNotice message={data.message} />}

      {isLoading && <p className="mt-6 text-slate-600">불러오는 중…</p>}
      {error && <p className="mt-6 text-red-600">{(error as Error).message}</p>}

      {data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["모델 버전", data.counts.modelVersions],
                ["분석 결과 행", data.counts.analysisResults],
                ["피처 스냅샷", data.counts.featureSnapshots],
                ["검토자 피드백", data.counts.reviewerFeedbacks],
              ] as const
            ).map(([label, n]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{n}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">모델명</th>
                  <th className="px-3 py-2">버전</th>
                  <th className="px-3 py-2">배포</th>
                  <th className="px-3 py-2">등록일</th>
                </tr>
              </thead>
              <tbody>
                {data.modelVersions.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{m.modelName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.version}</td>
                    <td className="px-3 py-2">{m.isDeployed ? "예" : "아니오"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {new Date(m.createdAt).toLocaleString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.modelVersions.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">
                모델 버전 없음. 거래 업로드 시 자동 등록됩니다.
              </p>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
