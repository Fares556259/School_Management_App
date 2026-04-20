import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * DATABASE STABILIZATION V4 (Hardened Singleton)
 * - Limits pool size to 3 to prevent "Connection Terminated" errors on free projects.
 * - Robust singleton pattern for Next.js hot-reloading.
 * - Extended timeouts for flaky cloud environments.
 */

const isDev = process.env.NODE_ENV !== "production";

// Use a standard global cast for Next.js singleton persistence
const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const getPgPool = () => {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool;

  console.log("🐘 [PRISMA] Initializing unique persistent PG Session Pool...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, // STRICT ISOLATION for Port 5432 Stability
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 90000, // 90s for high-latency sessions
    idleTimeoutMillis: 60000,
  });

  pool.on('error', (err) => {
    console.error('❌ [PRISMA] Background pool error:', err);
  });

  if (isDev) globalForPrisma.pgPool = pool;
  return pool;
};

const getPrismaClient = () => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const pool = getPgPool();
  const adapter = new PrismaPg(pool);
  
  const client = new PrismaClient({
    adapter,
    log: isDev ? ["error", "warn"] : ["error"],
  });

  if (isDev) {
    globalForPrisma.prisma = client;
    console.log("✅ [PRISMA] Singleton Instance Activated.");
  }
  
  return client;
};

export const prisma = getPrismaClient();
export default prisma;
