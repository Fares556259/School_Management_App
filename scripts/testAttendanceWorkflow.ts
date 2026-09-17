import "dotenv/config";
import prisma from "../src/lib/prisma";
import {
  markAttendanceTool,
  getStudentAttendanceHistoryTool,
  justifyAttendanceTool,
} from "../src/lib/telegram/tools/attendanceTools";
import { ToolContext } from "../src/lib/telegram/tools/readTools";

let passed = 0;
let failed = 0;
const errors: string[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ PASS: ${name}`);
  } catch (err: any) {
    failed++;
    errors.push(`${name} -> ${err.message}`);
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) {
    throw new Error(`${msg ? msg + ": " : ""}Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || "Assertion failed: expected true, got false");
}

async function runAttendanceWorkflowTests() {
  console.log("\n=======================================================");
  console.log("📋  SNAPSCHOOL - TESTS WORKFLOW PRÉSENCES & JUSTIFICATIONS MÉDICALES");
  console.log("=======================================================\n");

  const schoolId = "bringbringa138gmailcom-1";
  const context: ToolContext = {
    schoolId,
    adminId: "admin_test",
    adminName: "Directeur Test",
    language: "fr",
  };

  const student = await prisma.student.findFirst({
    where: { schoolId, classId: { not: null } },
    include: { class: true },
  });

  if (!student) {
    throw new Error("Aucun élève trouvé avec une classe assignée");
  }

  console.log(`👤 Élève Test Sélectionné : ${student.name} ${student.surname} (${student.class?.name})`);

  // Target isolated future date
  const testDateStr = "2029-05-15";
  const testDate = new Date(testDateStr);

  // Clean any existing attendance for that test date
  const startOfDay = new Date(testDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(testDate);
  endOfDay.setHours(23, 59, 59, 999);

  await prisma.attendance.deleteMany({
    where: {
      studentId: student.id,
      date: { gte: startOfDay, lte: endOfDay },
    },
  });

  try {
    // --- ÉTAPE 1 : Pointage d'une Absence Injustifiée ---
    await test("Étape 1 : Pointage d'une absence via markAttendanceTool", async () => {
      const markRes = await markAttendanceTool(
        {
          studentNameOrId: student.id,
          status: "ABSENT",
          date: testDateStr,
          note: "Absence non justifiée le matin",
        },
        context
      );

      assertTrue(markRes.success, "Le pointage d'absence doit réussir");

      // Verify in DB
      const record = await prisma.attendance.findFirst({
        where: {
          studentId: student.id,
          date: { gte: startOfDay, lte: endOfDay },
        },
      });
      assertTrue(!!record, "Un enregistrement d'absence doit exister en base");
      assertEqual(record!.status, "ABSENT", "Statut doit être ABSENT");
    });

    // --- ÉTAPE 2 : Consultation de l'Historique ---
    await test("Étape 2 : Consultation de l'historique et détection de l'absence", async () => {
      const history = await getStudentAttendanceHistoryTool(
        {
          studentNameOrId: student.id,
          daysCount: 3650, // Long horizon to capture test date
        },
        context
      );

      assertTrue(history.found, "L'historique de l'élève doit être retourné");
      assertTrue(history.totalAbsences >= 1, "Total absences >= 1");
      assertTrue(history.unexcusedAbsences >= 1, "Au moins 1 absence doit être non justifiée");
    });

    // --- ÉTAPE 3 : Justification Médicale ---
    await test("Étape 3 : Justification médicale de l'absence via justifyAttendanceTool", async () => {
      const justifyRes = await justifyAttendanceTool(
        {
          studentNameOrId: student.id,
          date: testDateStr,
          reason: "Certificat médical grippe aiguë - Dr. Ben Salem",
        },
        context
      );

      assertTrue(justifyRes.success, "La justification doit réussir");

      // Verify in DB
      const record = await prisma.attendance.findFirst({
        where: {
          studentId: student.id,
          date: { gte: startOfDay, lte: endOfDay },
        },
      });
      assertTrue(!!record, "Enregistrement présent");
      assertEqual(record!.justificationStatus, "APPROVED", "Statut de justification = APPROVED");
    });

    // --- ÉTAPE 4 : Recalcul Automatique dans l'Historique ---
    await test("Étape 4 : Recalcul du statut (Absence basculée en Excusée)", async () => {
      const history = await getStudentAttendanceHistoryTool(
        {
          studentNameOrId: student.id,
          daysCount: 3650,
        },
        context
      );

      assertTrue(history.found, "Historique disponible");
      assertTrue(history.excusedAbsences >= 1, "L'absence doit maintenant être comptée comme excusée");
    });

  } finally {
    // --- ÉTAPE 5 : Nettoyage Automatique ---
    await prisma.attendance.deleteMany({
      where: {
        studentId: student.id,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });
    console.log(`\n🧹 Nettoyage terminé : Les pointages de présence de test ont été purgés.`);
  }

  console.log("\n=======================================================");
  console.log(`  SYNTHÈSE PRÉSENCES & JUSTIFICATIONS : ${passed + failed} tests`);
  console.log(`  PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAttendanceWorkflowTests().catch((e) => {
  console.error("Erreur workflow présences:", e);
  process.exit(1);
});
