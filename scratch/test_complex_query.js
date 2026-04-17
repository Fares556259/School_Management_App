const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQuery() {
  const parentId = "dummy_p_1776320480559_0";
  console.log(`Testing complex query for parentId: ${parentId}`);
  
  try {
    const start = Date.now();
    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        students: {
          include: {
            class: {
              include: {
                timetable: {
                  include: {
                    subject: true,
                    teacher: true,
                  },
                },
              },
            },
            payments: {
              orderBy: { id: "desc" },
            },
            results: {
              include: {
                exam: {
                  include: { lesson: { include: { subject: true } } },
                },
              },
            },
          },
        },
      },
    });
    const duration = Date.now() - start;
    console.log(`Query succeeded in ${duration}ms`);
    console.log(`Found ${parent?.students?.length || 0} students.`);
    process.exit(0);
  } catch (err) {
    console.error("Query failed:", err);
    process.exit(1);
  }
}

testQuery();
