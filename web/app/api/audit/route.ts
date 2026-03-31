import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { hasConfiguredDatabase, setupRequiredMessage } from "@/lib/runtime-config";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasConfiguredDatabase()) {
    return NextResponse.json({
      items: [],
      setupRequired: true,
      message: setupRequiredMessage(),
    });
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { email: true, name: true } },
    },
  });

  return NextResponse.json({
    items: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      payload: l.payload,
      createdAt: l.createdAt.toISOString(),
      actorEmail: l.actor?.email ?? null,
      actorName: l.actor?.name ?? null,
    })),
    setupRequired: false,
    message: null,
  });
}
