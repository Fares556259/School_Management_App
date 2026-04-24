import { PrismaClient } from "@prisma/client";

/**
 * STABLE PRISMA 6 SINGLETON
 * We have downgraded to Prisma 6 to restore the native Rust query engine.
 * This eliminates the "client engine" error and provide superior stability 
 * for local development without needing driver adapters.
 */

const isDev = process.env.NODE_ENV !== "production";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (isDev) globalForPrisma.prisma = prisma;

// Explicit cleanup for high-fidelity connection management
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

export default prisma;
