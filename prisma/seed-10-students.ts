import { Day, PrismaClient, UserSex, PaymentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Adding 10 Dummy Students & Parents...");

  // 1. Get a class and level to associate with
  let level = await prisma.level.findFirst();
  if (!level) level = await prisma.level.create({ data: { level: 1 } });

  let classItem = await prisma.class.findFirst();
  if (!classItem) {
    classItem = await prisma.class.create({ 
      data: { name: "1A", capacity: 30, levelId: level.id } 
    });
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const dummyNames = [
    { name: "Ahmed", surname: "Mabrouk" },
    { name: "Yassine", surname: "Trabelsi" },
    { name: "Sarra", surname: "Ben Ali" },
    { name: "Myriam", surname: "Kallel" },
    { name: "Hamza", surname: "Gharbi" },
    { name: "Leila", surname: "Dridi" },
    { name: "Mehdi", surname: "Jaziri" },
    { name: "Nour", surname: "Selmi" },
    { name: "Omar", surname: "Zayed" },
    { name: "Ines", surname: "Mansour" },
  ];

  for (let i = 0; i < 10; i++) {
    const timestamp = Date.now();
    const id = `dummy_s_${timestamp}_${i}`;
    const pId = `dummy_p_${timestamp}_${i}`;
    const data = dummyNames[i];

    // Create Parent
    await prisma.parent.create({
      data: {
        id: pId,
        username: `parent_${id}`,
        name: `Parent of ${data.name}`,
        surname: data.surname,
        phone: `2169876543${i}`,
        address: "Tunis, Tunisia",
      }
    });

    // Create Student
    await prisma.student.create({
      data: {
        id: id,
        username: `stud_${id}`,
        name: data.name,
        surname: data.surname,
        address: "Tunis, Tunisia",
        bloodType: "A+",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        birthday: new Date("2016-05-15"),
        parentId: pId,
        classId: classItem.id,
        levelId: level.id,
      }
    });

    // Create Pending Payment for Finance Test
    await prisma.payment.create({
      data: {
        amount: 450,
        month: month,
        year: year,
        status: "PENDING",
        userType: "STUDENT",
        studentId: id,
      }
    });
  }

  console.log("Successfully added 10 students with pending payments!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
