import assert from "node:assert/strict";
import { test } from "node:test";
import prisma from "../lib/prisma";
import {
  overtimeValues,
  appendOvertime,
  totalOvertime,
} from "../lib/overtimeAmount";
import {
  computeTeacherPaymentStatus,
  getTeacherPayableMonths,
} from "../lib/payrollUtils";
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
    // New entry modes accumulate independently without changing missed hours or advances.
    existing = {
      ...existing,
      overtimeHours: 2,
      overtimeRate: 25,
      overtimeFixedAmount: 10,
      amount: 100,
    };
    const entryParams = {
      ...params,
      hours: 0,
      amount: undefined,
      expectedOvertime: { hours: 2, rate: 25, fixedAmount: 10 },
      expectedSalary: { baseSalary: 300, deduction: 30 },
    };
    const hourly = await saveTeacherOvertime({
      ...entryParams,
      entry: { mode: "hourly", hours: 3, rate: 20 },
    });
    assert.equal(hourly.payment.overtimeHours, 5);
    assert.equal(hourly.payment.overtimeRate, 22);
    assert.equal(hourly.payment.overtimeFixedAmount, 10);
    assert.equal(hourly.remaining, 290);
    const fixed = await saveTeacherOvertime({
      ...entryParams,
      entry: { mode: "fixed", amount: 70.125 },
    });
    assert.equal(
      fixed.payment.overtimeHours,
      2,
      "Flat amount does not invent worked hours",
    );
    assert.equal(fixed.payment.overtimeRate, 25);
    assert.equal(fixed.payment.overtimeFixedAmount, 80.125);
    assert.equal(fixed.overtimeAmount, 130.125);
    assert.equal(fixed.remaining, 300.125);
    assert.equal(fixed.payment.amount, 100);
    await assert.rejects(
      saveTeacherOvertime({
        ...entryParams,
        expectedOvertime: { hours: 2, rate: 25, fixedAmount: 0 },
        entry: { mode: "fixed", amount: 10 },
      }),
      /ont changé/,
    );
    await assert.rejects(
      saveTeacherOvertime({
        ...entryParams,
        expectedSalary: undefined,
        entry: { mode: "fixed", amount: 10 },
      }),
      /Actualisez/,
    );
    const cleared = await saveTeacherOvertime({
      ...entryParams,
      entry: { mode: "reset" },
    });
    assert.equal(cleared.overtimeAmount, 0);
    assert.equal(cleared.payment.overtimeFixedAmount, 0);
    assert.equal(cleared.remaining, 170);
    existing = null;
    const fixedOnly = await saveTeacherOvertime({
      ...entryParams,
      expectedOvertime: { hours: 0, rate: null, fixedAmount: 0 },
      expectedSalary: { baseSalary: 300, deduction: 0 },
      entry: { mode: "fixed", amount: 50 },
    });
    assert.equal(fixedOnly.payment.overtimeHours, 0);
    assert.equal(fixedOnly.overtimeAmount, 50);
    assert.equal(fixedOnly.netDue, 350);
    teacher = null;
    await assert.rejects(saveTeacherOvertime(params), /cette école/);
    assert.equal(writes.length, 6, "Rejected cases never write");
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

test("Settled months disappear even when a legacy record still says PARTIAL", () => {
  const months = [
    "September 2026",
    "October 2026",
    "November 2026",
    "December 2026",
  ];
  const teacher = {
    salary: 360,
    hourlyRate: 15,
    hoursPerMonth: 24,
    payments: [
      { month: 9, year: 2026, status: "PARTIAL", amount: 330, missedHours: 2 },
      { month: 10, year: 2026, status: "PAID", amount: 360 },
      { month: 11, year: 2026, status: "PARTIAL", amount: 100 },
    ],
  };
  assert.deepEqual(getTeacherPayableMonths(teacher, months), [
    "November 2026",
    "December 2026",
  ]);
  assert.deepEqual(
    getTeacherPayableMonths(teacher, months, ["December 2026"]),
    ["November 2026"],
  );
  assert.deepEqual(
    getTeacherPayableMonths(
      { ...teacher, salary: 0, hourlyRate: 0, hoursPerMonth: 0, payments: [] },
      months,
    ),
    [],
  );
  const withOvertime = {
    ...teacher,
    payments: [
      {
        month: 9,
        year: 2026,
        status: "PARTIAL",
        amount: 330,
        missedHours: 2,
        overtimeHours: 2,
        overtimeRate: 30,
      },
    ],
  };
  assert.equal(
    getTeacherPayableMonths(withOvertime, months)[0],
    "September 2026",
    "Overtime creates a real remaining balance",
  );
});

test("Hourly and fixed additions combine accurately without reusing a legacy derived rate", () => {
  const current = {
    overtimeHours: 12,
    overtimeRate: 19.974 / 12,
    overtimeFixedAmount: 0,
  };
  const next = appendOvertime(
    current,
    { mode: "hourly", hours: 10, rate: 15 },
    15,
  );
  assert.equal(next.hours, 22);
  assert.equal(
    totalOvertime({
      overtimeHours: next.hours,
      overtimeRate: next.rate,
      overtimeFixedAmount: next.fixedAmount,
    }),
    169.974,
  );
  const fixed = appendOvertime(null, { mode: "fixed", amount: 50.125 }, 0);
  assert.equal(fixed.hours, 0);
  const calc = computeTeacherPaymentStatus(
    {
      salary: 300,
      payments: [
        {
          month: 11,
          year: 2026,
          overtimeFixedAmount: fixed.fixedAmount,
          status: "PARTIAL",
          amount: 100,
        },
      ],
    },
    11,
    2026,
  );
  assert.equal(calc.overtimeAmount, 50.125);
  assert.equal(calc.remaining, 250.125);
});

test("Entry modes reject invalid amounts, hours, rates and monthly overflow", () => {
  for (const amount of [0, -1, NaN, Infinity, 1.0001, 1000001])
    assert.throws(() => appendOvertime(null, { mode: "fixed", amount }, 15));
  for (const rate of [0, -1, NaN, Infinity, 15.0001])
    assert.throws(() =>
      appendOvertime(null, { mode: "hourly", hours: 1, rate }, 15),
    );
  for (const hours of [0, -1, NaN, Infinity, 1.111, 745])
    assert.throws(() =>
      appendOvertime(null, { mode: "hourly", hours, rate: 15 }, 15),
    );
  assert.throws(() =>
    appendOvertime(
      { overtimeHours: 744, overtimeRate: 15 },
      { mode: "hourly", hours: 1, rate: 15 },
      15,
    ),
  );
  assert.throws(() =>
    appendOvertime(
      { overtimeHours: 10, overtimeRate: 15 },
      { mode: "fixed", amount: 1000000 },
      15,
    ),
  );
});
