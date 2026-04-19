import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

async function exportDatabase() {
  console.log("🚀 Starting Database Export...");
  
  try {
    const data = {
      timestamp: new Date().toISOString(),
      classes: await prisma.class.findMany(),
      teachers: await prisma.teacher.findMany(),
      students: await prisma.student.findMany(),
      parents: await prisma.parent.findMany(),
      payments: await prisma.payment.findMany(),
      notices: await prisma.notice.findMany(),
      notifications: await prisma.notification.findMany(),
      auditLogs: await prisma.auditLog.findMany(),
    };

    const fileName = "SnapSchool_Database_Backup.json";
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));

    console.log(`✅ Success! Your database has been exported to: ${fileName}`);
    console.log("👉 You can now send this file to your friend.");
    console.log("💡 To restore this, they just need to run a Prisma import script.");
  } catch (error) {
    console.error("❌ Export failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

exportDatabase();
