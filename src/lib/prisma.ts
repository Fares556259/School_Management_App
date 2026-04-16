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
      max: 10, // Slightly reduced to avoid overwhelming Supabase transaction modes
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000, // Increased to 20s for better resilience
    });
  }
  
  const adapter = new PrismaPg(globalThis.pgPoolGlobal);
  return new PrismaClient({ adapter });
};

const prisma = globalThis.prismaGlobal ?? getPrismaClient();

export default prisma;

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
