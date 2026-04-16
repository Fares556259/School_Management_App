import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  var prismaGlobal: undefined | PrismaClient;
  var pgPoolGlobal: undefined | Pool;
}

const getPrismaClient = () => {
  if (!globalThis.pgPoolGlobal) {
    globalThis.pgPoolGlobal = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10, // Optimized for Transaction Mode + Parallel Server Actions
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 40000, // Increased for serverless network jitter
    });
  }
  
  const adapter = new PrismaPg(globalThis.pgPoolGlobal);
  return new PrismaClient({ 
    adapter,
    log: ['error', 'warn'],
  });
};

const prisma = globalThis.prismaGlobal ?? getPrismaClient();

export default prisma;

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
