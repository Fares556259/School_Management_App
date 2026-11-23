/** @jest-environment node */

// Mocks registered before any action modules are dynamically imported
jest.mock("react", () => ({
  cache: (fn: (...args: any[]) => any) => fn,
}));

jest.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn().mockResolvedValue({
    id: "user-123",
    user_metadata: { schoolId: "integration-school" },
  } as any),
}));

jest.mock("@/lib/school", () => ({
  getSchoolId: jest.fn().mockResolvedValue("integration-school"),
}));

jest.mock("@/lib/cache", () => ({
  invalidateTenantTags: jest.fn(),
}));

import { describe, expect, it, afterEach, beforeAll, afterAll } from "@jest/globals";
import { prisma, TEST_SCHOOL_ID, TEST_SUFFIX, seedSchool, seedLevel, seedClass, seedStudent, seedSubject, cleanupIntegrationData } from "../helpers/db";

const SCHOOL_ID = "integration-school";

describe("Integration: createGradeSheet", () => {
  let levelId: number;
  let classId: number;
  let subjectId: number;
  let studentId: string;

  beforeAll(async () => {
    await seedSchool();
    const level = await seedLevel(SCHOOL_ID, 2);
    levelId = level.id;
    const cls = await seedClass(SCHOOL_ID, levelId, "Integration Class B");
    classId = cls.id;
    const subject = await seedSubject(SCHOOL_ID, "Math");
    subjectId = subject.id;
  });

  afterAll(async () => {
    await cleanupIntegrationData(SCHOOL_ID);
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (studentId) {
      await prisma.grade.deleteMany({ where: { studentId, schoolId: SCHOOL_ID } });
      await prisma.gradeSheet.deleteMany({ where: { classId, subjectId, term: 1, schoolId: SCHOOL_ID } });
    }
  });

  it("creates a grade sheet and grade records for a student", async () => {
    // Arrange: create a student
    const student = await seedStudent(SCHOOL_ID, levelId, {
      id: `student-grade-${TEST_SUFFIX}`,
      username: `grade_user_${TEST_SUFFIX}`,
    });
    studentId = student.id;

    // Dynamically import the action AFTER mocks are registered
    const { createGradeSheet } = await import("@/actions/grades");

    // Act: create a grade sheet with one grade entry
    const result = await createGradeSheet({
      classId,
      subjectId,
      term: 1,
      proofUrl: "https://example.com/proof.pdf",
      grades: [
        { studentId, score: 16 },
      ],
    });

    // Assert: action succeeded
    expect(result.success).toBe(true);
    expect(result.sheetId).toBeTruthy();

    // Assert: GradeSheet record exists in DB
    const sheet = await prisma.gradeSheet.findUnique({
      where: { classId_subjectId_term: { classId, subjectId, term: 1 } },
    });
    expect(sheet).toBeTruthy();
    expect(sheet?.proofUrl).toBe("https://example.com/proof.pdf");
    expect(sheet?.schoolId).toBe(SCHOOL_ID);

    // Assert: Grade record exists in DB
    const grade = await prisma.grade.findUnique({
      where: {
        studentId_subjectId_term: { studentId, subjectId, term: 1 },
      },
    });
    expect(grade).toBeTruthy();
    expect(grade?.score).toBe(16);
    expect(grade?.schoolId).toBe(SCHOOL_ID);
  });
});
