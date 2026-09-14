import { runAllEvals } from "./evalSuite";

async function main() {
  console.log("=================================================");
  console.log("🚀  HNIA AGENT - SUITE D'ÉVALUATION DE NON-RÉGRESSION");
  console.log("=================================================");

  const startTime = Date.now();
  const results = await runAllEvals();
  const totalDuration = Date.now() - startTime;

  let passedCount = 0;
  let failedCount = 0;

  console.log("\nRésultats d'évaluation :");
  console.log("-------------------------------------------------");
  for (const r of results) {
    if (r.passed) {
      passedCount++;
      console.log(` ✅ PASS [${r.durationMs}ms] : ${r.name}`);
    } else {
      failedCount++;
      console.log(` ❌ FAIL [${r.durationMs}ms] : ${r.name}`);
      console.log(`    ⚠️ Erreur : ${r.error}`);
    }
  }
  console.log("-------------------------------------------------");
  console.log(`Synthèse : ${results.length} tests | ${passedCount} validés | ${failedCount} échoués (${totalDuration}ms)`);

  if (failedCount > 0) {
    console.error("\n❌ Attention : Échec d'évaluation détecté !");
    process.exit(1);
  } else {
    console.log("\n🎉 Tous les tests d'évaluation sont validés avec succès !");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Erreur fatale lors des tests d'évaluation :", err);
  process.exit(1);
});
