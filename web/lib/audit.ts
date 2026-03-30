import { prisma } from "@/lib/prisma";

export async function writeAuditLog(params: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      payload: params.payload ? (params.payload as object) : undefined,
    },
  });
}
