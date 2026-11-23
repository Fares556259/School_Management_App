/** @jest-environment node */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("Test database connection", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to the test database", async () => {
    const result = await prisma.$queryRaw<
      { database: string }[]
    >`SELECT current_database() AS database`;

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].database).toBeTruthy();

    console.log("Connected database:", result[0].database);
  });
});