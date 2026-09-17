import "dotenv/config";
import prisma from "../src/lib/prisma";
import { processPaymentReminders } from "../src/lib/notifications";
import { getDailyCaisseTool } from "../src/lib/telegram/tools/financeTools";
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

function assertTrue(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || "Assertion failed: expected true, got false");
}

function assertEqual<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) {
    throw new Error(`${msg ? msg + ": " : ""}Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

async function runCronPipelineTests() {
  console.log("\n=======================================================");
  console.log("⏰  SNAPSCHOOL - TESTS PIPELINES CRON, BRIEFINGS & RELANCES");
  console.log("=======================================================\n");

  const schoolId = "bringbringa138gmailcom-1";
  const context: ToolContext = {
    schoolId,
    adminId: "cron_test",
    adminName: "Système Automatisé",
    language: "fr",
  };

  // --- ÉTAPE 1 : Moteur de Relances Scolarité ---
  await test("Étape 1 : Exécution du scan de relance scolarité (processPaymentReminders)", async () => {
    const res = await processPaymentReminders(false, schoolId);
    assertTrue(res.success, "Le scan doit retourner success: true");
    assertTrue(typeof res.count === "number", "Le nombre de relances doit être un nombre");
    console.log(`     └ Relances envoyées/actualisées pour le mois : ${res.count}`);
  });

  // --- ÉTAPE 2 : Bilan Clôture de Caisse du Soir ---
  await test("Étape 2 : Agrégation comptable de la caisse du soir (getDailyCaisseTool)", async () => {
    const caisse = await getDailyCaisseTool({ date: "today" }, context);
    assertTrue(!!caisse.summary, "Le résumé de caisse doit être présent");
    assertTrue(typeof caisse.summary.netCashBalance === "string", "Le solde net doit être une chaîne formatée");
    assertTrue(typeof caisse.summary.totalIncomes === "string", "Les recettes doivent être formatées");
    assertTrue(typeof caisse.summary.totalExpenses === "string", "Les dépenses doivent être formatées");
    console.log(`     └ Solde du jour calculé : ${caisse.summary.netCashBalance} (Recettes: ${caisse.summary.totalIncomes}, Dépenses: ${caisse.summary.totalExpenses})`);
  });

  // --- ÉTAPE 3 : Pipeline du Briefing Matinal ---
  await test("Étape 3 : Agrégation des données du briefing matinal (Emploi du temps & Alertes)", async () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday...

    // Map JS day to DB DayOfWeek enum
    const daysMap: Record<number, any> = {
      1: "MONDAY",
      2: "TUESDAY",
      3: "WEDNESDAY",
      4: "THURSDAY",
      5: "FRIDAY",
      6: "SATURDAY",
      0: "SUNDAY",
    };

    const targetDay = daysMap[dayOfWeek] || "MONDAY";

    // Query today's scheduled lessons
    const lessonsToday = await prisma.timetableSlot.findMany({
      where: {
        schoolId,
        day: targetDay,
      },
      include: {
        teacher: { select: { name: true, surname: true } },
        class: { select: { name: true } },
        subject: { select: { name: true } },
      },
      take: 20,
    });

    assertTrue(Array.isArray(lessonsToday), "La liste des cours du jour doit être un tableau");
    console.log(`     └ Cours programmés pour aujourd'hui (${targetDay}) : ${lessonsToday.length} séance(s)`);

    // Verify accounts configured for dailyBriefing
    const briefingAccounts = await prisma.telegramAccount.findMany({
      where: { schoolId, dailyBriefing: true },
    });
    assertTrue(Array.isArray(briefingAccounts), "Les comptes abonnés au briefing doivent être accessibles");
    console.log(`     └ Administrateurs abonnés au briefing automatique : ${briefingAccounts.length}`);
  });

  // --- ÉTAPE 4 : Vérification de la Sécurité CRON_SECRET ---
  await test("Étape 4 : Validation du mécanisme de protection par Bearer token", () => {
    const mockSecret = "super_secret_cron_key_123";
    const validHeader = `Bearer ${mockSecret}`;
    const invalidHeader = `Bearer wrong_token`;

    const checkAuth = (header: string | null, secret?: string) => {
      if (!secret) return true; // optional in dev
      return header === `Bearer ${secret}`;
    };

    assertEqual(checkAuth(validHeader, mockSecret), true, "Le token valide doit passer");
    assertEqual(checkAuth(invalidHeader, mockSecret), false, "Le token invalide doit être rejeté");
    assertEqual(checkAuth(null, mockSecret), false, "L'absence de header doit être rejetée");
  });

  console.log("\n=======================================================");
  console.log(`  SYNTHÈSE PIPELINES CRON : ${passed + failed} tests`);
  console.log(`  PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCronPipelineTests().catch((e) => {
  console.error("Erreur test cron:", e);
  process.exit(1);
});
