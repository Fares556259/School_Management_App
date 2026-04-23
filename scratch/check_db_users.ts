import prisma from "@/lib/prisma";

async function check() {
  const users = [
    "fares.selmi@essai.ucar.tn",
    "unleashedfares@gmail.com",
    "selmifares57@gmail.com"
  ];

  console.log("--- Checking Admin Table ---");
  const admins = await prisma.admin.findMany({
    where: { email: { in: users } }
  });
  console.log(JSON.stringify(admins, null, 2));

  console.log("\n--- Checking SetupRequest Table ---");
  const leads = await prisma.setupRequest.findMany({
    where: { email: { in: users } }
  });
  console.log(JSON.stringify(leads, null, 2));
  
  process.exit(0);
}

check();
