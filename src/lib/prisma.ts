import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  var prismaGlobal: undefined | PrismaClient;
  var pgPoolGlobal: undefined | Pool;
}

const getPrismaClient = () => {
  if (!globalThis.pgPoolGlobal) {
    const isDev = process.env.NODE_ENV !== "production";
    
    globalThis.pgPoolGlobal = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: isDev ? 10 : 20, // Increased for stability over direct connections
      idleTimeoutMillis: 10000, 
      connectionTimeoutMillis: 10000, // Fail fast (10s) instead of hanging the app
      keepalive: true,
      keepaliveInitialDelayMillis: 10000,
    });

    globalThis.pgPoolGlobal.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });

    globalThis.pgPoolGlobal.on('connect', () => {
      if (isDev) console.log('New database connection established');
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
