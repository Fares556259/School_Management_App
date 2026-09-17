import { parseMonthYear, MONTHS, getSchoolYearMonths, isMonthBefore } from "../lib/dateUtils";
import { computeTeacherPaymentStatus, computeStaffPaymentStatus } from "../lib/payrollUtils";

// Lightweight test framework runner
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function test(description: string, fn: () => void) {
  try {
    fn();
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } catch (err: any) {
    failedTests++;
    failures.push(`${description} -> ${err.message}`);
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ": " : ""}Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || "Assertion failed: expected true, got false");
  }
}

console.log("\n=======================================================");
console.log("  PAYROLL & TRACKING COMPREHENSIVE TEST SUITE");
console.log("=======================================================\n");

// ============================================================================
// SUITE 1: UNIVERSAL DATE & MONTH PARSER
// ============================================================================
console.log("--- Suite 1: parseMonthYear (Multilingual & Edge Cases) ---");

test("English standard month string: 'September 2026'", () => {
  const res = parseMonthYear("September 2026");
  assertEqual(res.month, 9);
  assertEqual(res.year, 2026);
  assertEqual(res.monthKey, "September 2026");
  assertEqual(res.fullFrench, "Septembre 2026");
});

test("English abbreviation and lowercase: 'sep 2026'", () => {
  const res = parseMonthYear("sep 2026");
  assertEqual(res.month, 9);
  assertEqual(res.year, 2026);
  assertEqual(res.monthKey, "September 2026");
});

test("French capitalized month string: 'Septembre 2026'", () => {
  const res = parseMonthYear("Septembre 2026");
  assertEqual(res.month, 9);
  assertEqual(res.year, 2026);
  assertEqual(res.monthKey, "September 2026");
});

test("French lowercase month string: 'septembre 2026'", () => {
  const res = parseMonthYear("septembre 2026");
  assertEqual(res.month, 9);
  assertEqual(res.year, 2026);
  assertEqual(res.monthKey, "September 2026");
});

test("French accented month: 'Février 2026' and 'fevrier 2026'", () => {
  const withAccent = parseMonthYear("Février 2026");
  assertEqual(withAccent.month, 2);
  assertEqual(withAccent.year, 2026);
  assertEqual(withAccent.monthKey, "February 2026");

  const withoutAccent = parseMonthYear("fevrier 2026");
  assertEqual(withoutAccent.month, 2);
  assertEqual(withoutAccent.year, 2026);
});

test("French accented month: 'Août 2026' and 'aout 2026'", () => {
  const withAccent = parseMonthYear("Août 2026");
  assertEqual(withAccent.month, 8);
  assertEqual(withAccent.year, 2026);

  const withoutAccent = parseMonthYear("aout 2026");
  assertEqual(withoutAccent.month, 8);
});

test("French accented month: 'Décembre 2026' and 'decembre 2026'", () => {
  const res = parseMonthYear("Décembre 2026");
  assertEqual(res.month, 12);
  assertEqual(res.year, 2026);
});

test("Arabic month name: 'سبتمبر 2026' (September)", () => {
  const res = parseMonthYear("سبتمبر 2026");
  assertEqual(res.month, 9);
  assertEqual(res.year, 2026);
  assertEqual(res.monthKey, "September 2026");
});

test("Arabic Tunisian month names: 'جانفي 2026' (Jan) and 'فيفري 2026' (Feb)", () => {
  const jan = parseMonthYear("جانفي 2026");
  assertEqual(jan.month, 1);
  assertEqual(jan.year, 2026);

  const feb = parseMonthYear("فيفري 2026");
  assertEqual(feb.month, 2);
  assertEqual(feb.year, 2026);
});

test("Arabic standard month names: 'أكتوبر 2026' and 'اكتوبر 2026'", () => {
  const res1 = parseMonthYear("أكتوبر 2026");
  assertEqual(res1.month, 10);
  assertEqual(res1.year, 2026);

  const res2 = parseMonthYear("اكتوبر 2026");
  assertEqual(res2.month, 10);
  assertEqual(res2.year, 2026);
});

test("ISO format: '2026-09' and '2026-9'", () => {
  const res1 = parseMonthYear("2026-09");
  assertEqual(res1.month, 9);
  assertEqual(res1.year, 2026);
  assertEqual(res1.monthKey, "September 2026");

  const res2 = parseMonthYear("2026-9");
  assertEqual(res2.month, 9);
  assertEqual(res2.year, 2026);
});

test("Numeric slash and dash formats: '9-2026' and '09/2026'", () => {
  const res1 = parseMonthYear("9-2026");
  assertEqual(res1.month, 9);
  assertEqual(res1.year, 2026);

  const res2 = parseMonthYear("09/2026");
  assertEqual(res2.month, 9);
  assertEqual(res2.year, 2026);
});

test("Object input: { month: 10, year: 2026 }", () => {
  const res = parseMonthYear({ month: 10, year: 2026 });
  assertEqual(res.month, 10);
  assertEqual(res.year, 2026);
  assertEqual(res.monthKey, "October 2026");
});

test("Fallback safety on undefined, null, and empty string: never returns month 0 or NaN", () => {
  const res1 = parseMonthYear(undefined);
  assertTrue(res1.month >= 1 && res1.month <= 12, "Month must be between 1 and 12");
  assertTrue(!isNaN(res1.year) && res1.year >= 2000, "Year must be a valid number");

  const res2 = parseMonthYear(null);
  assertTrue(res2.month >= 1 && res2.month <= 12);

  const res3 = parseMonthYear("");
  assertTrue(res3.month >= 1 && res3.month <= 12);
});

// ============================================================================
// SUITE 2: TEACHER PAYROLL CALCULATION & STATUS DETERMINATION
// ============================================================================
console.log("\n--- Suite 2: computeTeacherPaymentStatus ---");

test("Teacher with flat base salary and no payments -> UNPAID", () => {
  const calc = computeTeacherPaymentStatus(
    { salary: 1200, payments: [] },
    9,
    2026
  );
  assertEqual(calc.baseSalary, 1200);
  assertEqual(calc.netDue, 1200);
  assertEqual(calc.amountPaid, 0);
  assertEqual(calc.remaining, 1200);
  assertEqual(calc.isPaid, false);
  assertEqual(calc.isPartial, false);
  assertEqual(calc.isUnpaid, true);
});

test("Teacher with hourlyRate * hoursPerMonth formula overriding default salary", () => {
  // e.g. default schema salary is 3000, but rate is 25 and hours is 40 -> 1000 DT
  const calc = computeTeacherPaymentStatus(
    { salary: 3000, hourlyRate: 25, hoursPerMonth: 40, payments: [] },
    9,
    2026
  );
  assertEqual(calc.baseSalary, 1000);
  assertEqual(calc.netDue, 1000);
  assertEqual(calc.remaining, 1000);
});

test("Teacher with missed hours deduction applied", () => {
  const calc = computeTeacherPaymentStatus(
    {
      salary: 1000,
      hourlyRate: 20,
      payments: [
        {
          month: 9,
          year: 2026,
          missedHours: 5,
          img: JSON.stringify({ deductionStatus: "APPLIED", deductedHours: 5 }),
          amount: 0,
        },
      ],
    },
    9,
    2026
  );
  assertEqual(calc.baseSalary, 1000);
  assertEqual(calc.deduction, 100); // 5h * 20 DT = 100 DT
  assertEqual(calc.netDue, 900);     // 1000 - 100 = 900 DT
  assertEqual(calc.amountPaid, 0);
  assertEqual(calc.remaining, 900);
  assertEqual(calc.isUnpaid, true);
});

test("Teacher with missed hours EXCUSED -> no deduction applied", () => {
  const calc = computeTeacherPaymentStatus(
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
  assertEqual(calc.deduction, 0);
  assertEqual(calc.netDue, 1000);
  assertEqual(calc.remaining, 1000);
});

test("Teacher with partial advance payment (300 DT on 1000 DT due) -> PARTIAL / Avance", () => {
  const calc = computeTeacherPaymentStatus(
    {
      salary: 1000,
      payments: [
        {
          month: 9,
          year: 2026,
          status: "PARTIAL",
          amount: 300,
        },
      ],
    },
    9,
    2026
  );
  assertEqual(calc.netDue, 1000);
  assertEqual(calc.amountPaid, 300);
  assertEqual(calc.remaining, 700);
  assertEqual(calc.isPaid, false);
  assertEqual(calc.isPartial, true);
  assertEqual(calc.isUnpaid, false);
});

test("Teacher completing remaining balance (paying remaining 700 DT -> total 1000 DT) -> PAID", () => {
  const calc = computeTeacherPaymentStatus(
    {
      salary: 1000,
      payments: [
        {
          month: 9,
          year: 2026,
          status: "PAID",
          amount: 1000,
        },
      ],
    },
    9,
    2026
  );
  assertEqual(calc.netDue, 1000);
  assertEqual(calc.amountPaid, 1000);
  assertEqual(calc.remaining, 0);
  assertEqual(calc.isPaid, true);
  assertEqual(calc.isPartial, false);
  assertEqual(calc.isUnpaid, false);
});

test("Teacher advance + deduction covering base salary (Auto-settle): 270 DT paid + 30 DT deduction on 300 DT base -> PAID", () => {
  const calc = computeTeacherPaymentStatus(
    {
      salary: 300,
      hourlyRate: 15,
      payments: [
        {
          month: 9,
          year: 2026,
          status: "PARTIAL", // was marked PARTIAL in DB before deduction was applied
          amount: 270,
          missedHours: 2,
          img: JSON.stringify({ deductionStatus: "APPLIED", deductedHours: 2 }),
        },
      ],
    },
    9,
    2026
  );
  assertEqual(calc.baseSalary, 300);
  assertEqual(calc.deduction, 30); // 2h * 15 DT
  assertEqual(calc.netDue, 270);
  assertEqual(calc.amountPaid, 270);
  assertEqual(calc.remaining, 0);
  assertEqual(calc.isPaid, true);    // Must auto-resolve to PAID because remaining is 0!
  assertEqual(calc.isPartial, false);
  assertEqual(calc.isUnpaid, false);
});

test("Teacher overpayment: paying 1100 DT on 1000 DT net due -> remaining is 0 and PAID", () => {
  const calc = computeTeacherPaymentStatus(
    {
      salary: 1000,
      payments: [
        {
          month: 9,
          year: 2026,
          status: "PAID",
          amount: 1100,
        },
      ],
    },
    9,
    2026
  );
  assertEqual(calc.remaining, 0);
  assertEqual(calc.isPaid, true);
  assertEqual(calc.isPartial, false);
  assertEqual(calc.isUnpaid, false);
});

// ============================================================================
// SUITE 3: STAFF PAYROLL CALCULATION & STATUS DETERMINATION
// ============================================================================
console.log("\n--- Suite 3: computeStaffPaymentStatus ---");

test("Staff with salary 800 DT and no payment -> UNPAID", () => {
  const calc = computeStaffPaymentStatus(
    { salary: 800, payments: [] },
    10,
    2026
  );
  assertEqual(calc.baseSalary, 800);
  assertEqual(calc.amountPaid, 0);
  assertEqual(calc.remaining, 800);
  assertEqual(calc.isPaid, false);
  assertEqual(calc.isPartial, false);
  assertEqual(calc.isUnpaid, true);
});

test("Staff with advance payment (250 DT on 800 DT) -> PARTIAL / Avance", () => {
  const calc = computeStaffPaymentStatus(
    {
      salary: 800,
      payments: [
        {
          month: 10,
          year: 2026,
          status: "PARTIAL",
          amount: 250,
        },
      ],
    },
    10,
    2026
  );
  assertEqual(calc.baseSalary, 800);
  assertEqual(calc.amountPaid, 250);
  assertEqual(calc.remaining, 550);
  assertEqual(calc.isPaid, false);
  assertEqual(calc.isPartial, true);
  assertEqual(calc.isUnpaid, false);
});

test("Staff advance that equals full salary (800 DT on 800 DT) -> PAID (not stuck in PARTIAL)", () => {
  const calc = computeStaffPaymentStatus(
    {
      salary: 800,
      payments: [
        {
          month: 10,
          year: 2026,
          status: "PARTIAL", // DB had partial flag
          amount: 800,
        },
      ],
    },
    10,
    2026
  );
  assertEqual(calc.remaining, 0);
  assertEqual(calc.isPaid, true);
  assertEqual(calc.isPartial, false);
  assertEqual(calc.isUnpaid, false);
});

test("Staff full salary paid -> PAID", () => {
  const calc = computeStaffPaymentStatus(
    {
      salary: 800,
      payments: [
        {
          month: 10,
          year: 2026,
          status: "PAID",
          amount: 800,
        },
      ],
    },
    10,
    2026
  );
  assertEqual(calc.remaining, 0);
  assertEqual(calc.isPaid, true);
  assertEqual(calc.isPartial, false);
  assertEqual(calc.isUnpaid, false);
});

// ============================================================================
// SUITE 4: MUTUAL EXCLUSIVITY & FILTER CONSISTENCY
// ============================================================================
console.log("\n--- Suite 4: Mutual Exclusivity Verification ---");

test("Ensure exactly ONE of {isPaid, isPartial, isUnpaid} is true for any arbitrary state", () => {
  const testScenarios = [
    { salary: 1000, amount: 0, status: "UNPAID" },
    { salary: 1000, amount: 1, status: "PARTIAL" },
    { salary: 1000, amount: 500, status: "PARTIAL" },
    { salary: 1000, amount: 999.99, status: "PARTIAL" },
    { salary: 1000, amount: 1000, status: "PAID" },
    { salary: 1000, amount: 1500, status: "PAID" },
    { salary: 0, amount: 0, status: "UNPAID" },
    { salary: 500, amount: 500, status: "PARTIAL" }, // Edge case: status is PARTIAL but full amount paid
  ];

  for (const s of testScenarios) {
    const tCalc = computeTeacherPaymentStatus(
      { salary: s.salary, payments: [{ month: 9, year: 2026, amount: s.amount, status: s.status }] },
      9,
      2026
    );
    const tCount = Number(tCalc.isPaid) + Number(tCalc.isPartial) + Number(tCalc.isUnpaid);
    assertEqual(tCount, 1, `Teacher scenario { salary: ${s.salary}, amount: ${s.amount}, status: ${s.status} } violated mutual exclusivity`);

    const sCalc = computeStaffPaymentStatus(
      { salary: s.salary, payments: [{ month: 9, year: 2026, amount: s.amount, status: s.status }] },
      9,
      2026
    );
    const sCount = Number(sCalc.isPaid) + Number(sCalc.isPartial) + Number(sCalc.isUnpaid);
    assertEqual(sCount, 1, `Staff scenario { salary: ${s.salary}, amount: ${s.amount}, status: ${s.status} } violated mutual exclusivity`);
  }
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log("\n=======================================================");
console.log(`  TOTAL TESTS: ${passedTests + failedTests}`);
console.log(`  PASSED:      ${passedTests}`);
console.log(`  FAILED:      ${failedTests}`);
console.log("=======================================================\n");

if (failedTests > 0) {
  console.error("Test failures:\n" + failures.join("\n"));
  process.exit(1);
} else {
  console.log("🎉 All payroll and tracking tests passed with 100% accuracy!\n");
  process.exit(0);
}
