import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { hasConfiguredDatabase, setupRequiredMessage } from "@/lib/runtime-config";

/** AI 레이어 요약(관리·디버그용 MVP) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasConfiguredDatabase()) {
    return NextResponse.json({
      counts: {
        modelVersions: 0,
        analysisResults: 0,
        featureSnapshots: 0,
        reviewerFeedbacks: 0,
      },
      modelVersions: [],
      setupRequired: true,
      message: setupRequiredMessage(),
    });
  }

  const [modelCount, resultCount, snapshotCount, feedbackCount, recentModels] =
    await Promise.all([
      prisma.modelVersion.count(),
      prisma.aiAnalysisResult.count(),
      prisma.featureSnapshot.count(),
      prisma.reviewerFeedback.count(),
      prisma.modelVersion.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          modelName: true,
          version: true,
          isDeployed: true,
          createdAt: true,
        },
      }),
    ]);

  return NextResponse.json({
    counts: {
      modelVersions: modelCount,
      analysisResults: resultCount,
      featureSnapshots: snapshotCount,
      reviewerFeedbacks: feedbackCount,
    },
    modelVersions: recentModels.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    setupRequired: false,
    message: null,
  });
}
