import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const subjects = await prisma.subject.findMany();
  console.log("SUBJECTS_START");
  console.log(JSON.stringify(subjects, null, 2));
  console.log("SUBJECTS_END");
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
