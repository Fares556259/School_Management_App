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
      max: 20, // Limit connections per node process
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
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
