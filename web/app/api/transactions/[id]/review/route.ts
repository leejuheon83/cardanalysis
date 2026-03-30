import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ReviewStatus } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { mapCurrentAiAnalysis } from "@/lib/ai-layer/map-current-ai";

const bodySchema = z.object({
  status: z.nativeEnum(ReviewStatus),
  comment: z.string().max(2000).optional(),
});

function inferAgreement(
  status: ReviewStatus,
  riskScore: number | null,
  suggestedCategory: string | null,
): boolean | null {
  if (riskScore == null) return null;
  if (status === "VIOLATION") return riskScore >= 50;
  if (status === "DISMISSED") return riskScore < 40;
  if (status === "APPROVED") return riskScore < 50;
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: transactionId } = params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const review = await prisma.review.findUnique({
    where: { transactionId },
    include: {
      transaction: {
        include: {
          aiAnalysisResults: {
            where: { isCurrent: true },
            take: 1,
            include: { predictionLabels: true, modelVersion: true },
          },
        },
      },
    },
  });
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const aiView = mapCurrentAiAnalysis(review.transaction.aiAnalysisResults);
  const overrideReason = parsed.data.comment ?? null;

  const updated = await prisma.$transaction(async (db) => {
    const rev = await db.review.update({
      where: { id: review.id },
      data: {
        status: parsed.data.status,
        comment: overrideReason,
        reviewerId: session.user.id,
        decidedAt: new Date(),
        overrideReason:
          parsed.data.status === "DISMISSED" || parsed.data.status === "VIOLATION"
            ? overrideReason
            : review.overrideReason,
      },
    });

    if (aiView) {
      await db.reviewerFeedback.create({
        data: {
          transactionId,
          reviewId: review.id,
          aiAnalysisResultId: aiView.analysisResultId,
          reviewerUserId: session.user.id,
          finalOutcome: parsed.data.status,
          finalViolationCategory:
            parsed.data.status === "VIOLATION" ? aiView.violationCategory : null,
          overrideReason,
          aiSuggestedCategory: aiView.violationCategory,
          aiRiskScoreAtReview: aiView.riskScore,
          agreementWithAi: inferAgreement(
            parsed.data.status,
            aiView.riskScore,
            aiView.violationCategory,
          ),
        },
      });
    }

    return rev;
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: "review.update",
    entityType: "Review",
    entityId: updated.id,
    payload: {
      transactionId,
      status: parsed.data.status,
      aiAnalysisResultId: aiView?.analysisResultId,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    comment: updated.comment,
    decidedAt: updated.decidedAt?.toISOString() ?? null,
  });
}
