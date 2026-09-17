import prisma from "../src/lib/prisma";
import { calculateParentPaymentDistribution } from "../src/lib/telegram/tools/writeTools";
import { computeTeacherPaymentStatus, computeStaffPaymentStatus } from "../src/lib/payrollUtils";
import {
  generateTuitionReceiptPdf,
  generateSalaryPayslipPdf,
  generateDailyCashRegisterPdf,
  TuitionReceiptData,
  SalaryPayslipData,
  DailyCashRegisterData,
} from "../src/lib/pdf/receipts";
import { getTimetableConflictsTool } from "../src/lib/telegram/tools/timetableTools";

// Test assertion helpers
let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ PASS: ${name}`);
  } catch (err: any) {
    failed++;
    failures.push(`${name} -> ${err.message}`);
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(`${message ? message + ": " : ""}Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || "Assertion failed: expected true, got false");
  }
}

async function runBusinessCases() {
  console.log("\n=======================================================");
  console.log("💼  SNAPSCHOOL - TESTS APPROFONDIS DES CAS MÉTIER");
  console.log("=======================================================\n");

  const schoolId = "bringbringa138gmailcom-1";

  // ==========================================================================
  // CAS MÉTIER 1 : VENTILATION PARENTALE MULTI-ENFANTS
  // ==========================================================================
  console.log("--- Cas Métier 1 : Moteur de Ventilation Multi-Enfants ---");

  const testParent = await prisma.parent.findFirst({
    where: { schoolId, students: { some: {} } },
    include: { students: true },
  });

  if (testParent) {
    await test(`Ventilation intelligente sur parent réel '${testParent.name} ${testParent.surname}' (${testParent.students.length} enfants)`, async () => {
      const totalAmount = 300;
      const res = await calculateParentPaymentDistribution(testParent.id, totalAmount, schoolId, 9, 2026);
      assertTrue(res !== null, "Le résultat de ventilation ne doit pas être null");
      assertTrue(Array.isArray(res?.allocations), "allocations doit être un tableau");
      const sumAllocated = res!.allocations.reduce((acc, a) => acc + a.amount, 0);
      assertEqual(sumAllocated + res!.unallocatedAmount, totalAmount, "Somme allouée + surplus = montant total");
    });

    await test("Ventilation avec excédent élevé (1 000 DT)", async () => {
      const hugeAmount = 1000;
      const res = await calculateParentPaymentDistribution(testParent.id, hugeAmount, schoolId, 9, 2026);
      assertTrue(res !== null);
      const totalSum = res!.allocations.reduce((a, b) => a + b.amount, 0) + res!.unallocatedAmount;
      assertEqual(totalSum, hugeAmount, "La totalité de la somme doit être couverte ou allouée");
    });
  }

  // ==========================================================================
  // CAS MÉTIER 2 : MOTEUR DE PAIE ET RETENUES D'ABSENCES
  // ==========================================================================
  console.log("\n--- Cas Métier 2 : Moteur de Paie & Déductions d'Absences ---");

  await test("Calcul enseignant au taux horaire avec retenue d'absence", () => {
    const teacher = {
      salary: 3000,
      hourlyRate: 20,
      hoursPerMonth: 50, // Base = 1000 DT
      payments: [
        {
          month: 9,
          year: 2026,
          amount: 400,
          status: "PARTIAL" as any,
          missedHours: 5, // 5 * 20 = 100 DT déduction
        },
      ],
    };

    const res = computeTeacherPaymentStatus(teacher, 9, 2026);
    assertEqual(res.baseSalary, 1000, "Base = 1000 DT");
    assertEqual(res.deduction, 100, "Déduction = 100 DT");
    assertEqual(res.netDue, 900, "Net dû = 900 DT");
    assertEqual(res.amountPaid, 400, "Versé = 400 DT");
    assertEqual(res.remaining, 500, "Reste = 500 DT");
    assertTrue(res.isPartial, "Statut PARTIAL");
  });

  await test("Auto-settle quand avance + retenue comblent le salaire de base", () => {
    const teacher = {
      salary: 1000,
      hourlyRate: 25,
      hoursPerMonth: 40,
      payments: [
        {
          month: 9,
          year: 2026,
          amount: 900,
          status: "PARTIAL" as any,
          missedHours: 4, // 4 * 25 = 100 DT
        },
      ],
    };

    const res = computeTeacherPaymentStatus(teacher, 9, 2026);
    assertEqual(res.deduction, 100);
    assertEqual(res.netDue, 900);
    assertEqual(res.amountPaid, 900);
    assertEqual(res.remaining, 0);
    assertTrue(res.isPaid, "Doit basculer automatiquement en PAID");
  });

  // ==========================================================================
  // CAS MÉTIER 3 : BORDEREAU DE CAISSE & GÉNÉRATION PDF
  // ==========================================================================
  console.log("\n--- Cas Métier 3 : Bordereau de Caisse & Génération PDF Haute Fidélité ---");

  await test("Génération officielle du Reçu Scolarité Double-Volet PDF", async () => {
    const receiptData: TuitionReceiptData = {
      schoolName: "SnapSchool Academy",
      receiptNumber: "REC-2026-09-001",
      paymentDate: new Date(),
      studentName: "Wiem Marzouki",
      studentClass: "1A",
      parentName: "Fares Selmi",
      parentPhone: "+216 12345678",
      periodFrench: "Septembre 2026",
      amountPaid: 350,
      tuitionFee: 350,
      remainingDue: 0,
      paymentMethod: "Espèces",
      adminName: "Directeur Général",
    };

    const res = await generateTuitionReceiptPdf(receiptData);
    assertTrue(Boolean(res && res.buffer), "Doit retourner un objet avec buffer");
    assertTrue(res.buffer.length > 500, "Le buffer PDF doit avoir une taille > 500 octets");
    const header = res.buffer.subarray(0, 4).toString("utf-8");
    assertEqual(header, "%PDF", "Header %PDF valide");
  });

  await test("Génération de la Fiche de Paie Enseignant PDF", async () => {
    const payslipData: SalaryPayslipData = {
      schoolName: "SnapSchool Academy",
      payslipNumber: "PAY-2026-09-042",
      paymentDate: new Date(),
      employeeName: "Mounir Gharbi",
      employeeRole: "Mathématiques",
      employeeType: "TEACHER",
      periodFrench: "Septembre 2026",
      baseSalary: 1200,
      hourlyRate: 20,
      hoursTracked: 60,
      deductionsAmount: 40,
      netPaid: 860,
      remainingDue: 300,
      paymentMethod: "Virement",
      adminName: "Directeur",
    };

    const res = await generateSalaryPayslipPdf(payslipData);
    assertTrue(Boolean(res && res.buffer), "Doit retourner un objet avec buffer");
    assertTrue(res.buffer.length > 500, "Taille bulletin > 500 octets");
    const header = res.buffer.subarray(0, 4).toString("utf-8");
    assertEqual(header, "%PDF", "Header %PDF");
  });

  await test("Génération du Bordereau Quotidien de Clôture de Caisse PDF", async () => {
    const cashRegisterData: DailyCashRegisterData = {
      schoolName: "SnapSchool Academy",
      date: new Date(),
      adminName: "Directeur Général",
      totalIncomes: 500,
      totalExpenses: 70,
      netBalance: 430,
      totalCash: 430,
      totalChecks: 70,
      checkCount: 1,
      inflowItems: [
        { label: "Scolarité Wiem Marzouki (1A)", amount: 350, categoryOrClass: "1A", method: "Espèces" },
        { label: "Inscription Nouvel Élève", amount: 150, categoryOrClass: "Inscription", method: "Espèces" },
      ],
      outflowItems: [
        { label: "Carburant Bus Scolaire", amount: 45, categoryOrClass: "Transport", method: "Espèces" },
        { label: "Fournitures Papier Administration", amount: 25, categoryOrClass: "Fournitures", method: "Espèces" },
      ],
    };

    const res = await generateDailyCashRegisterPdf(cashRegisterData);
    assertTrue(Boolean(res && res.buffer), "Doit retourner un objet avec buffer");
    assertTrue(res.buffer.length > 500, "Taille caisse > 500 octets");
    const header = res.buffer.subarray(0, 4).toString("utf-8");
    assertEqual(header, "%PDF", "Header %PDF");
  });

  // ==========================================================================
  // CAS MÉTIER 4 : GESTION DES CONFLITS D'EMPLOI DU TEMPS
  // ==========================================================================
  console.log("\n--- Cas Métier 4 : Détection des Conflits d'Emploi du Temps ---");

  await test("Vérification de la détection de conflits sur grille horaire", async () => {
    const fakeContext = {
      schoolId,
      adminId: "admin",
      adminName: "Directeur",
      language: "fr",
    };

    const conflicts = await getTimetableConflictsTool({}, fakeContext);
    assertTrue(typeof conflicts.totalConflicts === "number", "totalConflicts doit être un nombre");
    assertTrue(Array.isArray(conflicts.conflicts), "conflicts doit être un tableau");
  });

  // ==========================================================================
  // SYNTHÈSE DES CAS MÉTIER
  // ==========================================================================
  console.log("\n=======================================================");
  console.log(`  SYNTHÈSE CAS MÉTIER : ${passed + failed} tests`);
  console.log(`  PASSED:              ${passed}`);
  console.log(`  FAILED:              ${failed}`);
  console.log("=======================================================");

  if (failed > 0) {
    console.error("\nÉchecs constatés :\n" + failures.join("\n"));
    process.exit(1);
  } else {
    console.log("\n🎉 Tous les cas métier critiques ont été testés et validés avec succès !\n");
    process.exit(0);
  }
}

runBusinessCases().catch((e) => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});
