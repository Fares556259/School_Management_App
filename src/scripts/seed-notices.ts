import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.notice.createMany({
    data: [
      {
        title: "Registration Deadline",
        message: "Academic registration for the next term ends this Friday. Please ensure all student records are updated.",
        important: true,
      },
      {
        title: "Parent-Teacher Meeting",
        message: "The monthly parent-teacher association meeting is scheduled for next Tuesday at 10:00 AM.",
        important: false,
      },
      {
        title: "School Holiday",
        message: "School will be closed on April 15th for the National Labor Day observation.",
        important: false,
      },
    ],
  });
  console.log("Notices seeded successfully!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
