import { describe, expect, it } from "@jest/globals";
import {
  computeStaffPaymentStatus,
  computeTeacherPaymentStatus,
} from "../lib/payrollUtils";

describe("computeTeacherPaymentStatus", () => {
  it("uses hourly rate and monthly hours instead of the default salary", () => {
    const result = computeTeacherPaymentStatus(
      { salary: 3000, hourlyRate: 25, hoursPerMonth: 40, payments: [] },
      9,
      2026
    );

    expect(result.baseSalary).toBe(1000);
    expect(result.remaining).toBe(1000);
    expect(result.isUnpaid).toBe(true);
  });

  it("deducts applied missed hours from the amount due", () => {
    const result = computeTeacherPaymentStatus(
      {
        salary: 1000,
        hourlyRate: 20,
        payments: [
          {
            month: 9,
            year: 2026,
            missedHours: 5,
            img: JSON.stringify({
              deductionStatus: "APPLIED",
              deductedHours: 5,
            }),
            amount: 0,
          },
        ],
      },
      9,
      2026
    );

    expect(result.deduction).toBe(100);
    expect(result.netDue).toBe(900);
    expect(result.remaining).toBe(900);
  });

  it("does not deduct excused missed hours", () => {
    const result = computeTeacherPaymentStatus(
      {
        salary: 1000,
        hourlyRate: 20,
        payments: [
          {
            month: 9,
            year: 2026,
            missedHours: 5,
            img: JSON.stringify({ deductionStatus: "EXCUSED" }),
            amount: 0,
          },
        ],
      },
      9,
      2026
    );

    expect(result.deduction).toBe(0);
    expect(result.netDue).toBe(1000);
  });

  it("calculates a partial payment and remaining balance", () => {
    const result = computeTeacherPaymentStatus(
      {
        salary: 1000,
        payments: [{ month: 9, year: 2026, status: "PARTIAL", amount: 300 }],
      },
      9,
      2026
    );

    expect(result.amountPaid).toBe(300);
    expect(result.remaining).toBe(700);
    expect(result.isPartial).toBe(true);
    expect(result.isPaid).toBe(false);
    expect(result.isUnpaid).toBe(false);
  });

  it("does not use a payment from a different month", () => {
    const result = computeTeacherPaymentStatus(
      {
        salary: 1000,
        payments: [{ month: 8, year: 2026, status: "PAID", amount: 1000 }],
      },
      9,
      2026
    );

    expect(result.amountPaid).toBe(0);
    expect(result.remaining).toBe(1000);
    expect(result.isUnpaid).toBe(true);
  });
});

describe("computeStaffPaymentStatus", () => {
  it("reports unpaid salary when there are no payments", () => {
    const result = computeStaffPaymentStatus({ salary: 800, payments: [] }, 10, 2026);

    expect(result.remaining).toBe(800);
    expect(result.isUnpaid).toBe(true);
  });

  it("marks the salary paid when the full amount is covered", () => {
    const result = computeStaffPaymentStatus(
      {
        salary: 800,
        payments: [{ month: 10, year: 2026, status: "PARTIAL", amount: 800 }],
      },
      10,
      2026
    );

    expect(result.remaining).toBe(0);
    expect(result.isPaid).toBe(true);
    expect(result.isPartial).toBe(false);
  });
});
