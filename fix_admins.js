const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  const schools = await prisma.school.findMany({ include: { Admin: true } });
  let created = 0;

  for (const school of schools) {
    if (school.Admin.length === 0) {
      // Create a dummy admin for this school
      const fakeId = crypto.randomUUID();
      const baseName = school.name.split(' ')[0] || "Admin";
      
      await prisma.admin.create({
        data: {
          id: fakeId,
          username: `admin_${school.id.replace(/[^a-zA-Z0-9]/g, '')}`,
          name: baseName,
          surname: "Director",
          email: `admin@${school.subdomain}.snapschool.io`,
          phone: "+216 22 123 456",
          status: "active",
          schoolId: school.id,
        }
      });
      created++;
      console.log(`Created admin for ${school.name}`);
    }
  }
  console.log(`Finished fixing ${created} schools.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
