import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalTransactions, flaggedTransactions, violationCount, pendingReviews] =
    await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.count({
        where: {
          OR: [
            { review: { status: "PENDING" } },
            {
              aiAnalysisResults: {
                some: { isCurrent: true, riskScore: { gte: 50 } },
              },
            },
          ],
        },
      }),
      prisma.review.count({ where: { status: "VIOLATION" } }),
      prisma.review.count({ where: { status: "PENDING" } }),
    ]);

  return NextResponse.json({
    totalTransactions,
    flaggedTransactions,
    violationCount,
    pendingReviews,
  });
}
