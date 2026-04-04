import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  try {
    const list = Object.keys(prisma);
    console.log("Prisma keys:", list.filter(k => !k.startsWith("_")));
    const noticeCount = await (prisma as any).notice.count();
    console.log("Notice count:", noticeCount);
  } catch (err: any) {
    console.error("Error checking notice model:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
