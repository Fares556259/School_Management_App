require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createClient } = require('@supabase/supabase-js');
const slugify = require('slugify');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function approveAdmin(adminId) {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.pendingSchoolName) {
      console.log("Admin or school name not found.");
      return;
    }

    const schoolName = admin.pendingSchoolName;
    const baseSlug = slugify(schoolName, { lower: true, strict: true });
    let schoolId = baseSlug;
    let counter = 1;

    while (await prisma.school.findFirst({ where: { id: schoolId } })) {
      schoolId = `${baseSlug}-${counter}`;
      counter++;
    }

    console.log("Provisioning school:", schoolId);

    // mock provisionSchool
    await prisma.$transaction(async (tx) => {
      await tx.school.create({
        data: {
          id: schoolId,
          name: schoolName,
          subdomain: schoolId,
          updatedAt: new Date(),
          activatedAt: new Date(),
        },
      });

      const safeId = Math.floor(Math.random() * 1000000) + 10;
      await tx.institution.create({
        data: {
          id: safeId,
          schoolId: schoolId,
          schoolName: schoolName,
          academicYear: "2025-2026",
          currentSemester: 1,
        },
      });

      for (const l of [1, 2, 3, 4, 5, 6]) {
        await tx.level.create({
          data: { level: l, schoolId: schoolId },
        });
      }

      await tx.admin.update({
        where: { id: adminId },
        data: {
          status: "active",
          schoolId: schoolId,
          pendingSchoolName: null,
        },
      });
    });

    console.log("Updating Supabase user metadata...");
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(adminId, {
      user_metadata: {
        role: "admin",
        status: "active",
        schoolId: schoolId,
        schoolName: schoolName,
      },
    });

    if (error) {
      console.error("Supabase Error:", error);
    } else {
      console.log("Success! Supabase user updated.");
    }
  } catch (error) {
    console.error("Approval Error:", error);
  }
}

approveAdmin('0f3c7fdf-498d-47b4-b325-1a6ed504b7f7').finally(() => prisma.$disconnect());
