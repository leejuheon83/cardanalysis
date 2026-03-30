"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell";
import { TransactionStatusBadge } from "@/components/status-badge";
import { getTransactionRowUiStatus } from "@/lib/transaction-row-status";
import { useState } from "react";

type ReviewStatus = "PENDING" | "APPROVED" | "VIOLATION" | "DISMISSED";

type Detail = {
  id: string;
  amount: string;
  currency: string;
  merchantName: string | null;
  category: string | null;
  userLabel: string | null;
  txnDate: string;
  description: string | null;
  aiAnalysis: {
    riskScore: number;
    violationCategory: string;
    explanation: string;
    modelVersion: string | null;
  } | null;
  review: {
    status: ReviewStatus;
    comment: string | null;
    decidedAt: string | null;
    reviewer: { name: string | null; email: string } | null;
  } | null;
};

async function fetchDetail(id: string): Promise<Detail> {
  const res = await fetch(`/api/transactions/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("상세 로드 실패");
  return res.json();
}

export default function TransactionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => fetchDetail(id),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: async (status: ReviewStatus) => {
      const res = await fetch(`/api/transactions/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, comment: comment || undefined }),
      });
      if (!res.ok) throw new Error("검토 저장 실패");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transaction", id] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <AppShell>
      <Link href="/transactions" className="text-sm text-primary underline">
        ← 목록
      </Link>

      {isLoading && <p className="mt-6">불러오는 중…</p>}
      {error && <p className="mt-6 text-red-600">{(error as Error).message}</p>}

      {data && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">거래 상세</h1>
            <TransactionStatusBadge
              status={getTransactionRowUiStatus(
                data.aiAnalysis?.riskScore ?? null,
                data.review?.status ?? "PENDING",
              )}
            />
          </div>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold">거래 정보</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">일시</dt>
                <dd className="font-medium">{new Date(data.txnDate).toLocaleString("ko-KR")}</dd>
              </div>
              <div>
                <dt className="text-slate-500">금액</dt>
                <dd className="font-medium tabular-nums">
                  {Number(data.amount).toLocaleString("ko-KR")} {data.currency}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">가맹점</dt>
                <dd className="font-medium">{data.merchantName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">사용자</dt>
                <dd className="font-medium">{data.userLabel ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">적요</dt>
                <dd>{data.description ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-4">
            <h2 className="text-lg font-semibold text-blue-950">AI 분석 (제안)</h2>
            {data.aiAnalysis ? (
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  <span className="text-slate-600">리스크 점수:</span>{" "}
                  <strong className="tabular-nums">{data.aiAnalysis.riskScore}</strong> / 100
                </p>
                <p>
                  <span className="text-slate-600">위반 카테고리:</span>{" "}
                  <strong>{data.aiAnalysis.violationCategory}</strong>
                </p>
                <p className="text-slate-800">{data.aiAnalysis.explanation}</p>
                <p className="text-xs text-slate-500">
                  모델: {data.aiAnalysis.modelVersion ?? "—"}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">분석 없음</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold">검토 (최종 결정)</h2>
            <p className="mt-1 text-xs text-slate-500">
              현재 상태: <strong>{data.review?.status ?? "—"}</strong>
              {data.review?.reviewer && (
                <>
                  {" "}
                  · {data.review.reviewer.email}{" "}
                  {data.review.decidedAt &&
                    new Date(data.review.decidedAt).toLocaleString("ko-KR")}
                </>
              )}
            </p>
            <textarea
              className="mt-3 w-full rounded border border-slate-300 p-2 text-sm"
              rows={3}
              placeholder="코멘트 (선택)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate("APPROVED")}
                className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                승인
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate("VIOLATION")}
                className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                위반 확정
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate("DISMISSED")}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                기각(오탐)
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate("PENDING")}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                다시 대기
              </button>
            </div>
            {mutation.isError && (
              <p className="mt-2 text-sm text-red-600">{(mutation.error as Error).message}</p>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
