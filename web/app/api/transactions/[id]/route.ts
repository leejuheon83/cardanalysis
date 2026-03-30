import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { mapCurrentAiAnalysis } from "@/lib/ai-layer/map-current-ai";

const analysisInclude = {
  where: { isCurrent: true },
  take: 1,
  include: {
    predictionLabels: true,
    modelVersion: true,
  },
} as const;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const t = await prisma.transaction.findUnique({
    where: { id },
    include: {
      aiAnalysisResults: analysisInclude,
      review: { include: { reviewer: true } },
    },
  });

  if (!t) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ai = mapCurrentAiAnalysis(t.aiAnalysisResults);

  return NextResponse.json({
    id: t.id,
    amount: t.amount.toString(),
    currency: t.currency,
    merchantName: t.merchantName,
    category: t.category,
    userLabel: t.userLabel,
    txnDate: t.txnDate.toISOString(),
    description: t.description,
    aiAnalysis: ai
      ? {
          riskScore: ai.riskScore,
          violationCategory: ai.violationCategory,
          explanation: ai.explanation,
          modelVersion: ai.modelVersion,
          analysisResultId: ai.analysisResultId,
        }
      : null,
    review: t.review
      ? {
          status: t.review.status,
          comment: t.review.comment,
          decidedAt: t.review.decidedAt?.toISOString() ?? null,
          overrideReason: t.review.overrideReason,
          aiAnalysisResultId: t.review.aiAnalysisResultId,
          reviewer: t.review.reviewer
            ? { name: t.review.reviewer.name, email: t.review.reviewer.email }
            : null,
        }
      : null,
  });
}
