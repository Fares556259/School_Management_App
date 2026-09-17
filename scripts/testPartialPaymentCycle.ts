import "dotenv/config";
import prisma from "../src/lib/prisma";
import { getPartialPaymentsTool, recoverPartialPaymentTool } from "../src/lib/telegram/tools/financeTools";
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

async function runPartialPaymentCycleTests() {
  console.log("\n=======================================================");
  console.log("💳  SNAPSCHOOL - TESTS CYCLE COMPLET PAIEMENTS PARTIELS & RECOUVREMENT");
  console.log("=======================================================\n");

  const schoolId = "bringbringa138gmailcom-1";
  const context: ToolContext = {
    schoolId,
    adminId: "admin_test",
    adminName: "Directeur Test",
    language: "fr",
  };

  // Find an active student with a parent
  const student = await prisma.student.findFirst({
    where: { schoolId, parentId: { not: null } },
    include: { parent: true, class: true },
  });

  if (!student) {
    throw new Error("Aucun élève éligible trouvé pour le test de paiement");
  }

  console.log(`👤 Élève Test Sélectionné : ${student.name} ${student.surname} (${student.class?.name || "Sans classe"})`);

  // Target isolated future month to guarantee zero impact on real school year
  const testMonth = 11;
  const testYear = 2029;

  // Cleanup any leftover test payments from prior runs
  await prisma.payment.deleteMany({
    where: {
      studentId: student.id,
      month: testMonth,
      year: testYear,
    },
  });

  let createdPaymentId: number | null = null;

  try {
    // --- ÉTAPE 1 : Création de l'Acompte (Paiement Partiel) ---
    await test("Étape 1 : Création d'un acompte partiel (150 DT versés / 200 DT reliquat)", async () => {
      const payment = await prisma.payment.create({
        data: {
          schoolId,
          studentId: student.id,
          userType: "STUDENT",
          month: testMonth,
          year: testYear,
          amount: 150,
          deferredAmount: 200,
          status: "PARTIAL",
          deferredUntil: new Date("2029-11-20"),
        },
      });
      createdPaymentId = payment.id;

      assertEqual(payment.status, "PARTIAL", "Statut initial PARTIAL");
      assertEqual(payment.amount, 150, "Montant versé = 150 DT");
      assertEqual(payment.deferredAmount, 200, "Reliquat dû = 200 DT");
    });

    // --- ÉTAPE 2 : Détection par Hnia via getPartialPaymentsTool ---
    await test("Étape 2 : Détection exacte du reliquat via getPartialPaymentsTool", async () => {
      const res = await getPartialPaymentsTool(
        {
          month: testMonth,
          year: testYear,
          studentName: student.name,
        },
        context
      );

      assertTrue(res.count >= 1, "Au moins un dossier de reliquat doit être trouvé");
      assertTrue(Array.isArray(res.items) && res.items.length >= 1, "La liste doit contenir l'élève");
      const foundItem = res.items.find((i: any) => i.id === createdPaymentId);
      assertTrue(!!foundItem, "L'item trouvé doit correspondre au paiement test");
      assertEqual(foundItem.remainingGap, 200, "Reliquat affiché doit être 200 DT");
    });

    // --- ÉTAPE 3 : Recouvrement de la 2ème Tranche via recoverPartialPaymentTool ---
    await test("Étape 3 : Recouvrement intégral de la 2ème tranche (200 DT) -> Transition en PAID", async () => {
      const recoverRes = await recoverPartialPaymentTool(
        {
          studentNameOrId: student.id,
          month: testMonth,
          year: testYear,
          amount: 200,
        },
        context
      );

      assertTrue(recoverRes.success, "L'opération de recouvrement doit réussir");
      assertTrue(
        recoverRes.message.toUpperCase().includes("SOLDÉ") ||
          recoverRes.message.toUpperCase().includes("PAID") ||
          recoverRes.message.toLowerCase().includes("soldé"),
        "Le message doit confirmer le solde complet"
      );

      // Verify in Database
      const updated = await prisma.payment.findUnique({
        where: { id: createdPaymentId! },
      });

      assertTrue(!!updated, "Le paiement doit exister en base");
      assertEqual(updated!.status, "PAID", "Le statut doit avoir basculé en PAID");
      assertEqual(updated!.amount, 350, "Le montant total cumulé doit être de 350 DT (150 + 200)");
      assertEqual(updated!.deferredAmount, 0, "Le reliquat doit être 0 DT");
    });

  } finally {
    // --- ÉTAPE 4 : Nettoyage Automatique Intégral ---
    if (createdPaymentId) {
      await prisma.payment.deleteMany({
        where: { id: createdPaymentId },
      });
      // Also delete any associated test income entry
      await prisma.income.deleteMany({
        where: {
          schoolId,
          title: { contains: "Recouvrement scolarité" },
          amount: 200,
          date: { gte: new Date(Date.now() - 60000) },
        },
      });
      console.log(`\n🧹 Nettoyage terminé : Les enregistrements de test temporaires ont été purgés.`);
    }
  }

  console.log("\n=======================================================");
  console.log(`  SYNTHÈSE CYCLE PAIEMENTS PARTIELS : ${passed + failed} tests`);
  console.log(`  PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPartialPaymentCycleTests().catch((e) => {
  console.error("Erreur cycle paiement partiel:", e);
  process.exit(1);
});
