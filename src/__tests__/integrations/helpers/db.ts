import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL,
    },
  },
});

console.log("Using test database URL:", process.env.DIRECT_URL);
/** Unique suffix so parallel test runs don't collide on unique fields */
export const TEST_SUFFIX = `int_${Date.now()}`;

/** Deterministic schoolId used across integration tests */
export const TEST_SCHOOL_ID = "integration-school";

/** Seed a school record (idempotent upsert) */
export async function seedSchool() {
  return prisma.school.upsert({
    where: { id: TEST_SCHOOL_ID },
    update: {},
    create: {
      id: TEST_SCHOOL_ID,
      name: "Integration Test School",
      subdomain: `int-school-${TEST_SUFFIX}`,
      updatedAt: new Date(),
    },
  });
}

/** Seed a level record */
export async function seedLevel(schoolId: string, levelNum = 1) {
  return prisma.level.upsert({
    where: { level_schoolId: { level: levelNum, schoolId } },
    update: {},
    create: {
      level: levelNum,
      schoolId,
      tuitionFee: 500,
    },
  });
}

/** Seed a class record */
export async function seedClass(schoolId: string, levelId: number, name = "Integration Class") {
  return prisma.class.upsert({
    where: { name_schoolId: { name, schoolId } },
    update: {},
    create: {
      name,
      capacity: 30,
      levelId,
      schoolId,
    },
  });
}

/** Seed a subject record */
export async function seedSubject(schoolId: string, name = "Math") {
  return prisma.subject.upsert({
    where: { name_schoolId: { name, schoolId } },
    update: {},
    create: { name, schoolId },
  });
}

/** Seed a student record */
export async function seedStudent(
  schoolId: string,
  levelId: number,
  overrides: { id?: string; username?: string } = {}
) {
  const studentId = overrides.id || `student-${TEST_SUFFIX}`;
  const username = overrides.username || `student_user_${TEST_SUFFIX}`;
  return prisma.student.create({
    data: {
      id: studentId,
      username,
      name: "Integration",
      surname: "Student",
      address: "123 Test St",
      bloodType: "O+",
      sex: "MALE",
      birthday: new Date("2010-01-01"),
      levelId,
      schoolId,
    },
  });
}

/** Clean up all tables touched by integration tests for this school */
export async function cleanupIntegrationData(schoolId: string) {
  // Delete in dependency order to respect foreign keys
  await prisma.grade.deleteMany({ where: { schoolId } });
  await prisma.payment.deleteMany({ where: { schoolId } });
  await prisma.income.deleteMany({ where: { schoolId } });
  await prisma.student.deleteMany({ where: { schoolId } });
  await prisma.class.deleteMany({ where: { schoolId } });
  await prisma.level.deleteMany({ where: { schoolId } });
  await prisma.subject.deleteMany({ where: { schoolId } });
  await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
}

export { prisma };
