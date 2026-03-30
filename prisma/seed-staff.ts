import { PrismaClient, UserSex } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const staffData = [
  { id: "staff1", username: "staff1", name: "Ahmed",    surname: "Ben Ali",    role: "Secretary",  email: "ahmed@school.com",   phone: "555-0101", salary: 1800, sex: UserSex.MALE },
  { id: "staff2", username: "staff2", name: "Fatma",    surname: "Trabelsi",   role: "Accountant", email: "fatma@school.com",   phone: "555-0102", salary: 2000, sex: UserSex.FEMALE },
  { id: "staff3", username: "staff3", name: "Mohamed",  surname: "Gharbi",     role: "Janitor",    email: "mohamed@school.com", phone: "555-0103", salary: 1200, sex: UserSex.MALE },
  { id: "staff4", username: "staff4", name: "Amira",    surname: "Bouzid",     role: "Librarian",  email: "amira@school.com",   phone: "555-0104", salary: 1600, sex: UserSex.FEMALE },
  { id: "staff5", username: "staff5", name: "Karim",    surname: "Mejri",      role: "Guard",      email: "karim@school.com",   phone: "555-0105", salary: 1300, sex: UserSex.MALE },
  { id: "staff6", username: "staff6", name: "Sana",     surname: "Hamdi",      role: "Nurse",      email: "sana@school.com",    phone: "555-0106", salary: 1700, sex: UserSex.FEMALE },
  { id: "staff7", username: "staff7", name: "Yassine",  surname: "Khelifi",    role: "IT Support", email: "yassine@school.com", phone: "555-0107", salary: 2200, sex: UserSex.MALE },
  { id: "staff8", username: "staff8", name: "Ines",     surname: "Ferchichi",  role: "Secretary",  email: "ines@school.com",    phone: "555-0108", salary: 1800, sex: UserSex.FEMALE },
];

async function main() {
  for (const s of staffData) {
    await prisma.staff.upsert({
      where: { id: s.id },
      update: {},
      create: {
        ...s,
        address: "Tunis, Tunisia",
        bloodType: "A+",
        isPaid: false,
        birthday: new Date(1990, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      },
    });
    console.log(`✓ ${s.name} ${s.surname} (${s.role})`);
  }
  console.log("\n✅ 8 staff members seeded!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
