import assert from "node:assert/strict";
import { chunkExpoPushMessages, isExpoPushToken } from "../lib/expoPushApi";
import { getOptimizedDatabaseUrl } from "../lib/prisma";

async function main() {
  assert.equal(isExpoPushToken("ExpoPushToken[abc_123-def]"), true);
  assert.equal(isExpoPushToken("ExponentPushToken[abc123]"), true);
  assert.equal(isExpoPushToken("https://example.com/token"), false);
  assert.deepEqual(chunkExpoPushMessages(Array.from({ length: 201 }, (_, index) => index)).map(chunk => chunk.length), [100, 100, 1]);

  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://user:pass@pooler.example.com:5432/postgres?connection_limit=3&pool_timeout=60&sslmode=require";
  const optimized = new URL(getOptimizedDatabaseUrl()!);
  assert.equal(optimized.searchParams.get("connection_limit"), "1");
  assert.equal(optimized.searchParams.get("pool_timeout"), "20");
  assert.equal(optimized.searchParams.get("sslmode"), "require");

  process.env.DATABASE_URL = "postgresql://user:pass@pooler.example.com:6543/postgres";
  const transactionPool = new URL(getOptimizedDatabaseUrl()!);
  assert.equal(transactionPool.searchParams.get("pgbouncer"), "true");

  if (previousUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousUrl;

  console.log("Runtime delivery checks passed: Expo token validation/chunking and serverless database pool limits.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
