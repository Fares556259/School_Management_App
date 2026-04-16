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
      max: 15, // Increased from 5 to handle concurrent mobile API bursts
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000, // Slightly increased timeout
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
