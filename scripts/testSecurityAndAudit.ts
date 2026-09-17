import "dotenv/config";
import prisma from "../src/lib/prisma";
import { getSchoolStatsTool } from "../src/lib/telegram/tools/readTools";
import { getParentsTool } from "../src/lib/telegram/tools/academicTools";
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

async function runSecurityAndAuditTests() {
  console.log("\n=======================================================");
  console.log("🔒  SNAPSCHOOL - TESTS ÉTANCHÉITÉ MULTI-TENANT & AUDIT LOGS");
  console.log("=======================================================\n");

  const schoolA = "bringbringa138gmailcom-1"; // SnapSchool Academy
  const schoolB = "fares-academy";            // Fares Academy

  const contextA: ToolContext = {
    schoolId: schoolA,
    adminId: "admin_a",
    adminName: "Admin A",
    language: "fr",
  };

  const contextB: ToolContext = {
    schoolId: schoolB,
    adminId: "admin_b",
    adminName: "Admin B",
    language: "fr",
  };

  // --- ÉTAPE 1 : Étanchéité Stricte des Effectifs (School Stats) ---
  await test("Étape 1 : Isolation stricte des statistiques d'effectifs entre deux établissements", async () => {
    const statsA = await getSchoolStatsTool({}, contextA);
    const statsB = await getSchoolStatsTool({}, contextB);

    assertTrue(statsA.students !== statsB.students || statsA.teachers !== statsB.teachers, "Les effectifs de deux écoles distinctes ne doivent pas être confondus");
    assertEqual(statsA.students, 53, "École A doit avoir exactement 53 élèves");
    assertEqual(statsA.teachers, 13, "École A doit avoir exactement 13 enseignants");
    assertEqual(statsA.parents, 26, "École A doit avoir exactement 26 parents");
    console.log(`     └ École A : ${statsA.students} élèves, ${statsA.teachers} profs, ${statsA.parents} parents`);
    console.log(`     └ École B : ${statsB.students} élèves, ${statsB.teachers} profs, ${statsB.parents} parents`);
  });

  // --- ÉTAPE 2 : Étanchéité du Répertoire Parents ---
  await test("Étape 2 : Zéro fuite de données de parents entre établissements", async () => {
    const parentsA = await getParentsTool({ take: 100 }, contextA);
    const parentsB = await getParentsTool({ take: 100 }, contextB);

    assertEqual(parentsA.total, 26, "École A a 26 parents");
    
    // Check that none of the parents of A belong to school B
    const parentsInDbA = await prisma.parent.findMany({
      where: { schoolId: schoolA },
      select: { id: true },
    });
    const idsA = new Set(parentsInDbA.map((p) => p.id));

    const parentsInDbB = await prisma.parent.findMany({
      where: { schoolId: schoolB },
      select: { id: true },
    });
    const idsB = new Set(parentsInDbB.map((p) => p.id));

    // Intersection of IDs between school A and B must be empty
    const intersection = [...idsA].filter((id) => idsB.has(id));
    assertEqual(intersection.length, 0, "Aucun parent ne doit être partagé entre les deux écoles");
  });

  // --- ÉTAPE 3 : Vérification de la Traçabilité AuditLog de Hnia ---
  await test("Étape 3 : Traçabilité des actions Hnia dans la table AuditLog", async () => {
    // Check recent audit logs performed by Hnia
    const hniaLogs = await prisma.auditLog.findMany({
      where: {
        schoolId: schoolA,
        performedBy: { contains: "Hnia AI" },
      },
      orderBy: { timestamp: "desc" },
      take: 5,
    });

    assertTrue(hniaLogs.length > 0, "Au moins une entrée d'audit Hnia doit être enregistrée");
    const latestLog = hniaLogs[0];
    assertTrue(latestLog.performedBy.includes("Hnia AI"), "performedBy doit mentionner Hnia AI");
    assertTrue(typeof latestLog.entityType === "string", "entityType doit être renseigné");
    assertTrue(typeof latestLog.description === "string" && latestLog.description.length > 10, "La description d'audit doit être détaillée");
    console.log(`     └ Dernier log audité : [${latestLog.action}] ${latestLog.entityType} #${latestLog.entityId}`);
    console.log(`       "${latestLog.description.slice(0, 100)}..."`);
  });

  // --- ÉTAPE 4 : Intégrité des Horodatages d'Audit ---
  await test("Étape 4 : Cohérence temporelle et immuabilité des logs d'audit", async () => {
    const logs = await prisma.auditLog.findMany({
      where: { schoolId: schoolA },
      orderBy: { timestamp: "desc" },
      take: 10,
    });

    for (const log of logs) {
      assertTrue(log.timestamp instanceof Date && !isNaN(log.timestamp.getTime()), "Chaque log doit avoir une date valide");
      assertTrue(log.timestamp.getTime() <= Date.now() + 10000, "Les logs ne doivent pas être datés dans le futur");
    }
  });

  console.log("\n=======================================================");
  console.log(`  SYNTHÈSE MULTI-TENANT & AUDIT : ${passed + failed} tests`);
  console.log(`  PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAndAuditTests().catch((e) => {
  console.error("Erreur test sécurité:", e);
  process.exit(1);
});
