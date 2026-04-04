import { Day, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const classes = await prisma.class.findMany({
    where: { name: { in: ["1A", "1B", "1C"] } }
  });

  const subjects = await prisma.subject.findMany();
  const teachers = await prisma.teacher.findMany();

  const days = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY];
  const periods = [
    { slot: 1, start: "08:00 AM", end: "09:00 AM" },
    { slot: 2, start: "09:00 AM", end: "10:00 AM" },
    { slot: 3, start: "10:30 AM", end: "11:30 AM" },
    { slot: 4, start: "11:30 AM", end: "12:30 PM" },
    { slot: 5, start: "01:30 PM", end: "02:30 PM" },
    { slot: 6, start: "02:30 PM", end: "03:30 PM" },
  ];

  const subjectNames = [
    "Mathematics", "Arabic", "French", "English", "Science", 
    "History", "Geography", "Physical Education", "Music / Arts"
  ];

  for (const cls of classes) {
    console.log(`Seeding timetable for Class ${cls.name}...`);
    for (const day of days) {
      for (const period of periods) {
        // Randomly pick a subject from the predefined list
        const randSubjectName = subjectNames[Math.floor(Math.random() * subjectNames.length)];
        const subject = subjects.find(s => s.name === randSubjectName) || subjects[0];
        
        // Pick a teacher that teaches this subject if possible
        const teacher = teachers[Math.floor(Math.random() * teachers.length)];

        await prisma.timetableSlot.upsert({
          where: {
            classId_day_slotNumber: {
              classId: cls.id,
              day: day,
              slotNumber: period.slot,
            }
          },
          update: {},
          create: {
            day: day,
            slotNumber: period.slot,
            startTime: period.start,
            endTime: period.end,
            classId: cls.id,
            subjectId: subject.id,
            teacherId: teacher.id,
          }
        });
      }
    }
  }

  console.log("Timetable seeding completed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
