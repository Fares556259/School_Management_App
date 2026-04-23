import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.setupRequest.create({
    data: {
      schoolName: "Fares Academy",
      ownerName: "Fares",
      phoneNumber: "123456789",
      email: "unleashedfares@gmail.com",
      city: "Online",
      status: "PENDING"
    }
  });

  console.log("Successfully forced a SetupRequest creation!");

  // Try to find the user in Admin
  const admin = await prisma.admin.findUnique({
    where: { email: "unleashedfares@gmail.com" }
  });

  if (admin) {
    await prisma.admin.update({
      where: { email: "unleashedfares@gmail.com" },
      data: { status: "pending" }
    });
    console.log("Updated Fares admin status to pending.");
  } else {
     console.log("Admin record not found. Let the user click sync.");
  }
}
main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
