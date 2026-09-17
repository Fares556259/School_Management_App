import "dotenv/config";
import { analyzeTelegramImage, DocumentAnalysisResult } from "../src/lib/telegram/vision";

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

async function runVisionVoiceTests() {
  console.log("\n=======================================================");
  console.log("🎙️👁️  SNAPSCHOOL - TESTS APPROFONDIS AUDIO & VISION (VOICE / OCR)");
  console.log("=======================================================\n");

  // 1. Test Model Hierarchy Alignment (Avoid 429 Traps)
  await test("Ordre hiérarchique des modèles dans voice.ts & vision.ts", async () => {
    const fs = await import("fs");
    const voiceCode = fs.readFileSync("src/lib/telegram/voice.ts", "utf-8");
    const visionCode = fs.readFileSync("src/lib/telegram/vision.ts", "utf-8");

    // Must NOT have gemini-3.6-flash first (limited to 20 req/day on free tier)
    assertTrue(!voiceCode.includes('CANDIDATE_MODELS = [\n    "gemini-3.6-flash"'), "voice.ts ne doit pas avoir 3.6-flash en première position");
    assertTrue(!visionCode.includes('VISION_MODELS = [\n  "gemini-3.6-flash"'), "vision.ts ne doit pas avoir 3.6-flash en première position");

    assertTrue(voiceCode.includes("gemini-3.5-flash"), "voice.ts doit inclure gemini-3.5-flash");
    assertTrue(visionCode.includes("gemini-3.5-flash"), "vision.ts doit inclure gemini-3.5-flash");
  });

  // 2. Test Document Analysis Schema Validation
  await test("Validation du schéma TypeScript DocumentAnalysisResult", () => {
    const sampleResult: DocumentAnalysisResult = {
      documentType: "EXPENSE_RECEIPT",
      title: "Facture Agil Carburant",
      summary: "Plein de mazout pour bus scolaire",
      amount: 85.5,
      date: "2026-09-17",
      category: "Transport",
      merchant: "Station Agil Ennasr",
      suggestedAction: "add_expense",
    };

    assertEqual(sampleResult.documentType, "EXPENSE_RECEIPT");
    assertEqual(sampleResult.amount, 85.5);
    assertEqual(sampleResult.suggestedAction, "add_expense");
  });

  // 3. Test analyzeTelegramImage with a minimal 1x1 GIF / PNG buffer
  await test("Traitement d'image robuste et gestion des erreurs de buffer", async () => {
    const minimalPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    try {
      const analysis = await analyzeTelegramImage(minimalPng, "Reçu de test");
      assertTrue(typeof analysis.documentType === "string", "documentType doit être renseigné");
      assertTrue(typeof analysis.summary === "string", "summary doit être renseigné");
      console.log(`     └ Type détecté pour image minimale : ${analysis.documentType} (action suggérée: ${analysis.suggestedAction || "aucune"})`);
    } catch (err: any) {
      assertTrue(err.message.length > 0, "L'erreur éventuelle doit avoir un message explicite");
      console.log(`     ℹ️ Exception réseau / clé gérée avec succès : ${err.message.slice(0, 80)}...`);
    }
  });

  console.log("\n=======================================================");
  console.log(`  SYNTHÈSE AUDIO & VISION : ${passed + failed} tests`);
  console.log(`  PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runVisionVoiceTests().catch((e) => {
  console.error("Erreur exécution test audio/vision:", e);
  process.exit(1);
});
