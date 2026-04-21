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
  });

if (isDev) globalForPrisma.prisma = prisma;

export default prisma;
