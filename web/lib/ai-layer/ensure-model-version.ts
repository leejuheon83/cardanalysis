import type { Prisma } from "@prisma/client";

export async function ensureModelVersion(
  db: Prisma.TransactionClient,
  modelName: string,
  version: string,
) {
  return db.modelVersion.upsert({
    where: {
      modelName_version: { modelName, version },
    },
    create: {
      modelName,
      version,
      isDeployed: true,
      notes: "auto-registered from inference",
    },
    update: {},
  });
}
