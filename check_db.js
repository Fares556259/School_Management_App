import prisma from "@/lib/prisma";

async function run() {
  const parents = await prisma.parent.findMany({ select: { name: true, surname: true, email: true, username: true } });
  const admins = await prisma.admin.findMany();
  
  console.log("PARENTS:");
  parents.forEach(p => console.log(JSON.stringify(p)));
  console.log("\nADMINS:");
  admins.forEach(a => console.log(JSON.stringify(a)));
}
run();
