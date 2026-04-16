const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function verify() {
  console.log("🔍 [TEST] Finding a test parent...");
  const parent = await prisma.parent.findFirst({ select: { id: true, phone: true, password: true } });
  
  if (!parent) {
    console.error("❌ No parent found in DB.");
    return;
  }
  
  console.log(`✅ Found: ${parent.phone} (Password Set: ${!!parent.password})`);
  
  // 1. Check Login Result
  console.log("\n1️⃣ Testing /api/mobile/login (Status Check)...");
  const loginRes = await fetch("http://localhost:3000/api/mobile/login", {
    method: "POST",
    body: JSON.stringify({ phone: parent.phone })
  });
  const loginData = await loginRes.json();
  console.log("Result:", loginData.status);

  // 2. Setup Password (if NULL)
  if (!parent.password) {
    console.log("\n2️⃣ Testing /api/mobile/auth (Action: setup)...");
    const setupRes = await fetch("http://localhost:3000/api/mobile/auth", {
      method: "POST",
      body: JSON.stringify({ phone: parent.phone, password: "test-password-123", action: "setup" })
    });
    console.log("Status:", setupRes.status, await setupRes.text());
  }

  // 3. Verify Login Status Change
  console.log("\n3️⃣ Re-checking /api/mobile/login...");
  const loginRes2 = await fetch("http://localhost:3000/api/mobile/login", {
    method: "POST",
    body: JSON.stringify({ phone: parent.phone })
  });
  console.log("New Status:", (await loginRes2.json()).status);

  // 4. Test Sign-In
  console.log("\n4️⃣ Testing /api/mobile/auth (Action: signin)...");
  const signinRes = await fetch("http://localhost:3000/api/mobile/auth", {
    method: "POST",
    body: JSON.stringify({ phone: parent.phone, password: "test-password-123", action: "signin" })
  });
  console.log("SignIn Success:", signinRes.status === 200);

  // Cleanup
  console.log("\n🧹 Resetting parent password for future tests...");
  await prisma.parent.update({ where: { id: parent.id }, data: { password: null } });
}

verify().catch(console.error).finally(() => prisma.$disconnect());
