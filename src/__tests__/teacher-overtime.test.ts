import assert from "node:assert/strict";
import { test } from "node:test";
import prisma from "../lib/prisma";
import { overtimeValues } from "../lib/overtimeAmount";
import { computeTeacherPaymentStatus } from "../lib/payrollUtils";
import { saveTeacherOvertime } from "../lib/teacherOvertime";

test("Custom overtime amount stays independent of absence deductions and advances", () => {
  const values = overtimeValues(3, 15, 75);
  const calc = computeTeacherPaymentStatus(
    {
      salary: 300,
      hourlyRate: 15,
      hoursPerMonth: 20,
      payments: [
        {
          month: 11,
          year: 2026,
          status: "PARTIAL",
          amount: 100,
          missedHours: 2,
          overtimeHours: 3,
          overtimeRate: values.rate,
          img: JSON.stringify({ deductionStatus: "APPLIED", deductedHours: 2 }),
        },
      ],
    },
    11,
    2026,
  );
  assert.equal(calc.deduction, 30);
  assert.equal(calc.overtimeAmount, 75);
  assert.equal(calc.netDue, 345);
  assert.equal(calc.remaining, 245);
  assert.equal(calc.effectiveRate, 15);
});

test("Custom totals support fixed salaries, millimes and non-integer derived rates", () => {
  for (const amount of [100, 70.125, 0]) {
    const values = overtimeValues(3, 0, amount);
    const calc = computeTeacherPaymentStatus(
      {
        salary: 300,
        payments: [
          {
            month: 11,
            year: 2026,
            overtimeHours: 3,
            overtimeRate: values.rate,
          },
        ],
      },
      11,
      2026,
    );
    assert.equal(calc.overtimeAmount, amount);
    assert.equal(calc.netDue, 300 + amount);
  }
  assert.equal(
    overtimeValues(3, 15).amount,
    45,
    "Older mobile clients retain hourly suggestion",
  );
  assert.equal(overtimeValues(0, 0, 0).amount, 0);
});

test("Invalid hours and amounts cannot reach a payroll write", () => {
  for (const hours of [-1, NaN, Infinity, 744.01, 1.111])
    assert.throws(() => overtimeValues(hours, 15, 30));
  for (const amount of [-1, NaN, Infinity, 1000000.001, 1.0001])
    assert.throws(() => overtimeValues(3, 15, amount));
  assert.throws(() => overtimeValues(0, 15, 10));
  assert.throws(() => overtimeValues(3, 0));
});

test("Only applied absences reduce salary; overtime uses its recorded rate", () => {
  for (const deductionStatus of ["PENDING", "EXCUSED"]) {
    const calc = computeTeacherPaymentStatus(
      {
        salary: 300,
        hourlyRate: 15,
        payments: [
          {
            month: 11,
            year: 2026,
            missedHours: 2,
            overtimeHours: 3,
            overtimeRate: 25,
            img: JSON.stringify({ deductionStatus }),
          },
        ],
      },
      11,
      2026,
    );
    assert.equal(calc.deduction, 0);
    assert.equal(calc.netDue, 375);
  }
});

test("Overtime persistence scopes the school, locks the teacher and guards concurrent changes", async () => {
  const original = prisma.$transaction;
  let existing: any = null;
  let teacher: any = {
    id: "teacher-a",
    schoolId: "school-a",
    salary: 300,
    hourlyRate: 15,
    hoursPerMonth: 20,
  };
  let writes: any[] = [];
  let audits: any[] = [];
  let locked = false;
  const tx: any = {
    $queryRaw: async (_strings: any, ...args: any[]) => {
      assert.deepEqual(args, ["teacher-a", "school-a"]);
      locked = true;
      return [];
    },
    teacher: {
      findFirst: async ({ where }: any) => {
        assert.equal(locked, true);
        assert.deepEqual(where, { id: "teacher-a", schoolId: "school-a" });
        return teacher;
      },
    },
    payment: {
      findUnique: async () => existing,
      upsert: async ({ update, create }: any) => {
        const data = existing
          ? { ...existing, ...update }
          : { id: 90, ...create };
        writes.push(data);
        return data;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        audits.push(data);
      },
    },
    expense: {
      create: async () => {
        throw Error("Overtime must not create a salary payment or expense");
      },
    },
  };
  (prisma as any).$transaction = async (fn: any) => fn(tx);
  const params = {
    schoolId: "school-a",
    adminId: "admin-a",
    teacherId: "teacher-a",
    month: 11,
    year: 2026,
    hours: 3,
    amount: 75,
    expectedOvertime: { hours: 0, rate: null },
  };
  try {
    const result = await saveTeacherOvertime(params);
    assert.equal(result.payment.overtimeRate, 25);
    assert.equal(result.payment.amount, 0);
    assert.equal(result.payment.status, "PENDING");
    assert.equal(result.netDue, 375);
    assert.equal(audits[0].schoolId, "school-a");
    assert.equal(audits[0].newValues.overtimeAmount, 75);
    existing = {
      id: 90,
      schoolId: "school-a",
      month: 11,
      year: 2026,
      status: "PARTIAL",
      amount: 100,
      missedHours: 2,
      overtimeHours: 3,
      overtimeRate: 25,
    };
    await assert.rejects(saveTeacherOvertime(params), /ont changé/);
    assert.equal(writes.length, 1, "Stale confirmation did not write");
    const updated = await saveTeacherOvertime({
      ...params,
      amount: 100,
      expectedOvertime: { hours: 3, rate: 25 },
    });
    assert.equal(updated.remaining, 270);
    assert.equal(updated.payment.amount, 100, "Existing advance preserved");
    existing = { ...existing, status: "PAID" };
    await assert.rejects(saveTeacherOvertime(params), /clôturé/);
    existing = { ...existing, status: "PARTIAL", amount: 350 };
    await assert.rejects(
      saveTeacherOvertime({
        ...params,
        amount: 10,
        expectedOvertime: { hours: 3, rate: 25 },
      }),
      /sous le montant/,
    );
    existing = { ...existing, schoolId: "school-other", amount: 100 };
    await assert.rejects(saveTeacherOvertime(params), /cette école/);
    existing = { ...existing, schoolId: "school-a" };
    await assert.rejects(
      saveTeacherOvertime({
        ...params,
        expectedOvertime: undefined,
        expectedSalary: { baseSalary: 999, deduction: 0 },
      }),
      /a changé/,
    );
    existing = null;
    teacher = null;
    await assert.rejects(saveTeacherOvertime(params), /cette école/);
    assert.equal(writes.length, 2, "Rejected cases never write");
  } finally {
    (prisma as any).$transaction = original;
  }
});

test("Remaining balance is rounded to millimes after an advance", () => {
  const calc = computeTeacherPaymentStatus(
    {
      salary: 300.123,
      payments: [
        {
          month: 11,
          year: 2026,
          status: "PARTIAL",
          amount: 100.101,
          overtimeHours: 3,
          overtimeRate: 50.001 / 3,
        },
      ],
    },
    11,
    2026,
  );
  assert.equal(calc.remaining, 250.023);
});
