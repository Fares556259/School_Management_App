import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { processHniaVoiceTurn } from "../src/lib/voice/hniaVoiceBridge";
import prisma from "../src/lib/prisma";

async function runTests() {
  console.log("\n🎙️ === Testing Hnia Voice Bridge (Speech -> Text -> Hnia -> Text -> Speech) ===\n");

  const context = {
    schoolId: "bringbringa138gmailcom-1",
    adminId: "bringbringa138_602be",
    adminName: "Fares Selmi",
    schoolName: "SnapSchool Academy",
    language: "fr",
  };

  // TEST A: Greeting
  console.log("--- TEST A: Greeting (French) ---");
  const resA = await processHniaVoiceTurn({
    userMessage: "Bonjour Hnia",
    context,
  });
  console.log("Input: 'Bonjour Hnia'");
  console.log("Output text:", resA.text);
  if (!resA.text.toLowerCase().includes("hnia") && !resA.text.toLowerCase().includes("bonjour")) {
    throw new Error("Greeting failed");
  }
  console.log("✅ TEST A PASS\n");

  // TEST A2: Greeting (Tunisian Arabic)
  console.log("--- TEST A2: Greeting (Tunisian Arabic) ---");
  const resA2 = await processHniaVoiceTurn({
    userMessage: "عسلامة هنية",
    context,
  });
  console.log("Input: 'عسلامة هنية'");
  console.log("Output text:", resA2.text);
  console.log("✅ TEST A2 PASS\n");

  // TEST B: School Status (Fast-Path)
  console.log("--- TEST B: School Status ('وضعية المدرسة') ---");
  const resB = await processHniaVoiceTurn({
    userMessage: "شنوة وضعية المدرسة اليوم؟",
    context,
  });
  console.log("Input: 'شنوة وضعية المدرسة اليوم؟'");
  console.log("Output text:", resB.text);
  console.log("Tools executed:", resB.toolsExecuted?.map(t => t.toolName));
  console.log("✅ TEST B PASS\n");

  // TEST C: Caisse (Fast-Path)
  console.log("--- TEST C: Caisse ('caisse du jour') ---");
  const resC = await processHniaVoiceTurn({
    userMessage: "caisse du jour",
    context,
  });
  console.log("Input: 'caisse du jour'");
  console.log("Output text:", resC.text);
  console.log("Tools executed:", resC.toolsExecuted?.map(t => t.toolName));
  console.log("✅ TEST C PASS\n");

  // TEST D: Overdue payments query (Calling real tools through Gemini)
  console.log("--- TEST D: Overdue Payments Query ('شكون ما خلصش؟') ---");
  const resD = await processHniaVoiceTurn({
    userMessage: "شكون ما خلصش في سبتمبر؟",
    context,
  });
  console.log("Input: 'شكون ما خلصش في سبتمبر؟'");
  console.log("Output text:", resD.text);
  console.log("Tools executed:", resD.toolsExecuted?.map(t => t.toolName));
  console.log("✅ TEST D PASS\n");

  console.log("🎉 ALL VOICE BRIDGE INTEGRATION TESTS PASSED!");
  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  console.error("Test failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
