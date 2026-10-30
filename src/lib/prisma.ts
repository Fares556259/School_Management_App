import { PrismaClient } from "@prisma/client";
import { withDatabaseReadRetry, isDroppedConnection } from "./databaseReadRetry";

/**
 * STABLE PRISMA 6 SINGLETON WITH AUTOMATIC CONNECTION RECOVERY
 * Intercepts stale connection drops and auto-reconnects transparently.
 */

const isDev = process.env.NODE_ENV !== "production";

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
  prisma: any | undefined;
};

export function getOptimizedDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Crucial for Serverless (Vercel) + Supabase Supavisor/PgBouncer:
  // Every warm Vercel function owns a separate Prisma pool. Keep one connection per
  // instance so horizontal scaling cannot exhaust Supabase's shared database pool.
  const parsed = new URL(url);
  parsed.searchParams.set("connection_limit", "1");
  parsed.searchParams.set("pool_timeout", "20");

  // Ensure pgbouncer flag is active for pooled transactions
  if (parsed.port === "6543") {
    parsed.searchParams.set("pgbouncer", "true");
  }

  return parsed.toString();
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
      async $allOperations({ operation, args, query }) {
        return withDatabaseReadRetry(operation, () => query(args));
      },
    },
  },
});

export const prisma = (globalForPrisma.prisma ?? extendedPrisma) as unknown as PrismaClient;

if (isDev) globalForPrisma.prisma = prisma;

/**
 * Safe wrapper for concurrent db calls (e.g. Promise.all)
 */
export async function safeDbQuery<T>(fn: () => Promise<T>, retries = 0): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && isDroppedConnection(error)) {
      await new Promise((r) => setTimeout(r, 150));
      return safeDbQuery(fn, retries - 1);
    }
    throw error;
  }
}

export default prisma;
