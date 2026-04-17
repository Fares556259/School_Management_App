
import prisma from "./src/lib/prisma";

async function check() {
  console.log("Prisma instance keys:", Object.keys(prisma).filter(k => !k.startsWith('_')));
  console.log("InstitutionalConfig delegate:", prisma.institutionalConfig);
  process.exit(0);
}

check();
