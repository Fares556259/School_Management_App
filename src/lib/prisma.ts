import { PrismaClient } from "@prisma/client";

/**
 * STABLE PRISMA 6 SINGLETON WITH AUTOMATIC CONNECTION RECOVERY
 * Intercepts stale connection drops and auto-reconnects transparently.
 */

const isDev = process.env.NODE_ENV !== "production";

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
  prisma: any | undefined;
};

function getOptimizedDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Ensure PgBouncer pool has a healthy connection limit (10) for true concurrent Promise.all execution
  if (url.includes("connection_limit=1&") || url.endsWith("connection_limit=1")) {
    return url.replace("connection_limit=1", "connection_limit=10");
  } else if (!url.includes("connection_limit=") && url.includes("pgbouncer=true")) {
    return url + (url.includes("?") ? "&" : "?") + "connection_limit=10";
  }

  return url;
}

const basePrisma =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: isDev ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: getOptimizedDatabaseUrl(),
      },
    },
  });

if (isDev) globalForPrisma.prismaBase = basePrisma;

const extendedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        try {
          return await query(args);
        } catch (error: any) {
          const isConnError =
            error?.message?.includes("closed the connection") ||
            error?.message?.includes("Connection reset") ||
            error?.message?.includes("Kind: Closed") ||
            error?.message?.includes("Engine is not yet connected") ||
            error?.code === "P1001" ||
            error?.code === "P1017";

          if (isConnError) {
            console.warn(`[Prisma] Connection drop detected on ${model}.${operation}. Reconnecting...`);
            await basePrisma.$disconnect().catch(() => {});
            await basePrisma.$connect().catch(() => {});
            return await query(args);
          }
          throw error;
        }
      },
    },
  },
});

export const prisma = (globalForPrisma.prisma ?? extendedPrisma) as unknown as PrismaClient;

if (isDev) globalForPrisma.prisma = prisma;

/**
 * Safe wrapper for concurrent db calls (e.g. Promise.all)
 */
export async function safeDbQuery<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isConnError =
      error?.message?.includes("closed the connection") ||
      error?.message?.includes("Connection reset") ||
      error?.message?.includes("Kind: Closed") ||
      error?.message?.includes("Engine is not yet connected") ||
      error?.code === "P1001" ||
      error?.code === "P1017";

    if (retries > 0 && isConnError) {
      console.warn("[Prisma] safeDbQuery retrying query after connection error...");
      await basePrisma.$disconnect().catch(() => {});
      await basePrisma.$connect().catch(() => {});
      return safeDbQuery(fn, retries - 1);
    }
    throw error;
  }
}

// Explicit cleanup for high-fidelity connection management
process.on("beforeExit", async () => {
  await basePrisma.$disconnect();
});

export default prisma;
