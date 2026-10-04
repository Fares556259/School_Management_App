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

function getOptimizedDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Crucial for Serverless (Vercel) + Supabase Supavisor/PgBouncer:
  // Forcing connection_limit=10 on serverless causes fast pool exhaustion on Supabase,
  // triggering fatal ECHECKOUTTIMEOUT errors!
  // A lean connection_limit (2-3) allows dozens of serverless instances to operate concurrently.
  if (url.includes("connection_limit=10")) {
    url = url.replace("connection_limit=10", "connection_limit=3");
  } else if (url.includes("connection_limit=1&") || url.endsWith("connection_limit=1")) {
    url = url.replace("connection_limit=1", "connection_limit=3");
  } else if (!url.includes("connection_limit=")) {
    url = url + (url.includes("?") ? "&" : "?") + "connection_limit=3";
  }

  // Ensure pool_timeout is bounded (20 seconds max wait instead of freezing for 60s)
  if (!url.includes("pool_timeout=")) {
    url = url + "&pool_timeout=20";
  }

  // Ensure pgbouncer flag is active for pooled transactions
  if (url.includes(":6543") && !url.includes("pgbouncer=true")) {
    url = url + "&pgbouncer=true";
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
