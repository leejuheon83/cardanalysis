import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash("admin123", 10);
  const accHash = await bcrypt.hash("accounting123", 10);

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    create: {
      email: "admin@example.com",
      name: "Admin",
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
    update: { passwordHash: adminHash, role: Role.ADMIN },
  });

  await prisma.user.upsert({
    where: { email: "accounting@example.com" },
    create: {
      email: "accounting@example.com",
      name: "회계 담당",
      passwordHash: accHash,
      role: Role.ACCOUNTING,
    },
    update: { passwordHash: accHash },
  });

  await prisma.modelVersion.upsert({
    where: {
      modelName_version: { modelName: "corporate-card-risk", version: "mock-v1" },
    },
    create: {
      modelName: "corporate-card-risk",
      version: "mock-v1",
      isDeployed: true,
      notes: "seed default",
    },
    update: { isDeployed: true },
  });

  console.log("Seed OK: admin@example.com / admin123, accounting@example.com / accounting123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
