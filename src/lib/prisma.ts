import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { cache } from "react";

declare global {
  var prisma: PrismaClient | undefined;
  var pgPool: Pool | undefined;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * DATABASE STABILIZATION V3 (Cached & Hardened)
 * - SSL enabled for Supabase compatibility.
 * - Connection pool max: 10 (supports parallel dashboard batches).
 * - React.cache() for request-level deduplication.
 */

if (!globalThis.pgPool) {
  globalThis.pgPool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: { rejectUnauthorized: false }, 
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 5000,
  });
}

const adapter = new PrismaPg(globalThis.pgPool);

const prismaClient =
  globalThis.prisma ||
  new PrismaClient({
    adapter,
    log: isDev ? ["error", "warn"] : ["error"],
  });

if (isDev) {
  globalThis.prisma = prismaClient;
}

// Export a cached version for Next.js 14+ 
// This ensures that redundant queries in Layout + Page are shared
export const prisma = prismaClient;
export default prisma;
