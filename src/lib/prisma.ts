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
  console.log("🐘 [PRISMA] Initializing new PG Pool...");
  globalThis.pgPool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 15, // Slightly higher to support batch dashboard parallelization
    ssl: { rejectUnauthorized: false }, 
    connectionTimeoutMillis: 30000, // 30s is more than enough for cloud DBs
    idleTimeoutMillis: 15000,       // 15s aggressive pruning of idle clients
    // TCP Keep-Alive to prevent pooler silent-drops
    keepAlive: true,
  });

  globalThis.pgPool.on('error', (err) => {
    console.error('❌ [PRISMA] Unexpected error on idle client:', err);
  });
}

const adapter = new PrismaPg(globalThis.pgPool);

const prismaClient =
  globalThis.prisma ||
  new PrismaClient({
    adapter,
    log: isDev ? ["error", "warn"] : ["error"],
  });

// Diagnostic Heartbeat
if (isDev) {
  globalThis.prisma = prismaClient;
  
  // Asynchronous heartbeat check
  globalThis.pgPool.query('SELECT 1').then(() => {
    console.log("✅ [PRISMA] Database connected successfully.");
  }).catch((err) => {
    console.error("❌ [PRISMA] Database connection failed:", err.message);
    if (err.message.includes('allow_list')) {
      console.warn("⚠️ [ACTION REQUIRED] Please set Supabase Network Constraints to 'Allow all access' (0.0.0.0/0).");
    }
  });
}

export const prisma = prismaClient;
export default prisma;
