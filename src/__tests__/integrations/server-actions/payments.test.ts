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
import { prisma, TEST_SCHOOL_ID, TEST_SUFFIX, seedSchool, seedLevel, seedClass, seedStudent, cleanupIntegrationData } from "../helpers/db";

const SCHOOL_ID = "integration-school";

describe("Integration: receiveStudentPayment", () => {
  let levelId: number;
  let classId: number;
  let studentId: string;

  beforeAll(async () => {
    await seedSchool();
    const level = await seedLevel(SCHOOL_ID, 1);
    levelId = level.id;
    const cls = await seedClass(SCHOOL_ID, levelId, "Integration Class A");
    classId = cls.id;
  });

  afterAll(async () => {
    await cleanupIntegrationData(SCHOOL_ID);
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Remove any payment/income created in this test for this student
    if (studentId) {
      await prisma.payment.deleteMany({ where: { studentId } });
      await prisma.income.deleteMany({
        where: { referenceType: "StudentPayment", schoolId: SCHOOL_ID },
      });
    }
  });

  it("creates a PAID payment and an Income record for a student", async () => {
    // Arrange: create a student
    const student = await seedStudent(SCHOOL_ID, levelId);
    studentId = student.id;

    // Dynamically import the action AFTER mocks are registered
    const { receiveStudentPayment } = await import("@/actions/students");

    // Act: process a full tuition payment
    const result = await receiveStudentPayment(
      studentId,
      "Integration Student",
      500,        // fullAmount
      "September 2026",
      500         // paidAmount (full)
    );

    // Assert: action succeeded
    expect(result.success).toBe(true);

    // Assert: Payment record exists in DB
    const payment = await prisma.payment.findUnique({
      where: {
        studentId_month_year: { studentId, month: 9, year: 2026 },
      },
    });
    expect(payment).toBeTruthy();
    expect(payment?.status).toBe("PAID");
    expect(payment?.amount).toBe(500);
    expect(payment?.schoolId).toBe(SCHOOL_ID);

    // Assert: Income record was created
    const income = await prisma.income.findFirst({
      where: {
        referenceType: "StudentPayment",
        schoolId: SCHOOL_ID,
      },
    });
    expect(income).toBeTruthy();
    expect(income?.amount).toBe(500);
    expect(income?.category).toBe("Tuition");
  });

  it("creates a PARTIAL payment and income when paid less than full amount", async () => {
    // Arrange
    const student = await seedStudent(SCHOOL_ID, levelId, {
      id: `student-partial-${TEST_SUFFIX}`,
      username: `partial_user_${TEST_SUFFIX}`,
    });
    studentId = student.id;

    // Dynamically import the action AFTER mocks are registered
    const { receiveStudentPayment } = await import("@/actions/students");

    // Act: pay only 300 of 500
    const result = await receiveStudentPayment(
      studentId,
      "Integration Student",
      500,
      "September 2026",
      300
    );

    // Assert
    expect(result.success).toBe(true);

    const payment = await prisma.payment.findFirst({
      where: { studentId, month: 9, year: 2026 },
    });
    expect(payment).toBeTruthy();
    expect(payment?.status).toBe("PARTIAL");
    expect(payment?.amount).toBe(300);
    expect(payment?.deferredAmount).toBe(200);

    const income = await prisma.income.findFirst({
      where: { referenceType: "StudentPayment", schoolId: SCHOOL_ID },
    });
    expect(income?.amount).toBe(300);
    expect(income?.category).toBe("Partial");
  });
});
