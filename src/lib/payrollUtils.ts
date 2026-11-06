import { parseMonthYear } from "./dateUtils";

export interface TeacherPayrollItem {
  id?: string;
  salary?: number | null;
  hourlyRate?: number | null;
  hoursPerMonth?: number | null;
  payments?: Array<{
    id?: number;
    month: number;
    year: number;
    status?: string | null;
    amount?: number | null;
    missedHours?: number | null;
    overtimeHours?: number | null;
    overtimeRate?: number | null;
    img?: string | null;
    paidAt?: Date | string | null;
  }>;
}

export interface TeacherStatusCalculation {
  month: number;
  year: number;
  baseSalary: number;
  effectiveRate: number;
  missedHours: number;
  deductedHours: number;
  deduction: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimeAmount: number;
  netDue: number;
  amountPaid: number;
  remaining: number;
  isPaid: boolean;
  isPartial: boolean;
  isUnpaid: boolean;
  actualStatus: string;
  payment: any | null;
}

/**
 * Pure calculation function for Teacher payment status for a specific month/year.
 * Follows strict remaining-balance business rules:
 * - netDue = baseSalary - deduction + overtimeAmount
 * - remaining = Math.max(0, netDue - amountPaid)
 * - isPaid: remaining <= 0 && (actualStatus === "PAID" || amountPaid >= netDue)
 * - isPartial: !isPaid && (amountPaid > 0 && remaining > 0)
 * - isUnpaid: !isPaid && !isPartial
 */
export function computeTeacherPaymentStatus(
  item: TeacherPayrollItem,
  monthIdx: number,
  yearVal: number
): TeacherStatusCalculation {
  const payment = item.payments?.find((p: any) => p.month === monthIdx && p.year === yearVal) || null;
  const actualStatus = payment?.status ? String(payment.status).toUpperCase() : "UNPAID";
  const amountPaid = ['PAID','PARTIAL'].includes(actualStatus) ? payment?.amount || 0 : 0;

  const rate = item.hourlyRate && item.hourlyRate > 0 ? item.hourlyRate : 0;
  const monthlyHours = item.hoursPerMonth && item.hoursPerMonth > 0 ? item.hoursPerMonth : 0;
  const baseSalary = (rate > 0 && monthlyHours > 0) ? (rate * monthlyHours) : (item.salary || 0);

  // Parse metadata if present for deduction status
  let deductedHours = payment?.missedHours || 0;
  if (payment?.img) {
    try {
      const parsed = JSON.parse(payment.img);
      if (parsed.deductionStatus === "EXCUSED") {
        deductedHours = 0;
      } else if (parsed.deductionStatus === "APPLIED") {
        deductedHours = parsed.deductedHours !== undefined ? parsed.deductedHours : (payment.missedHours || 0);
      } else if (parsed.deductionStatus === "PENDING") {
        deductedHours = 0;
      }
    } catch {}
  }

  const effectiveRate = rate > 0 ? rate : 15;
  const deduction = deductedHours * effectiveRate;
  const overtimeHours = payment?.overtimeHours || 0;
  const overtimeRate = payment?.overtimeRate ?? (rate > 0 ? rate : monthlyHours > 0 ? baseSalary / monthlyHours : 0);
  const overtimeAmount = Math.round(overtimeHours * overtimeRate * 1000) / 1000;
  const netDue = Math.round(Math.max(0, baseSalary - deduction + overtimeAmount) * 1000) / 1000;
  const remaining = Math.round(Math.max(0, netDue - amountPaid) * 1000) / 1000;

  const isPaid = (actualStatus === "PAID" || (netDue > 0 && amountPaid >= netDue)) && remaining <= 0;
  const isPartial = !isPaid && (actualStatus === "PARTIAL" || (amountPaid > 0 && remaining > 0));
  const isUnpaid = !isPaid && !isPartial;

  return {
    month: monthIdx,
    year: yearVal,
    baseSalary,
    effectiveRate,
    missedHours: payment?.missedHours || 0,
    deductedHours,
    deduction,
    overtimeHours,
    overtimeRate,
    overtimeAmount,
    netDue,
    amountPaid,
    remaining,
    isPaid,
    isPartial,
    isUnpaid,
    actualStatus,
    payment,
  };
}

/** Payable choices use the calculated balance, including deductions and overtime. */
export function getTeacherPayableMonths(
  teacher: TeacherPayrollItem,
  months: readonly string[],
  closedMonths: readonly string[] = [],
): string[] {
  const closed = new Set(closedMonths);
  return months.filter(key => {
    if (closed.has(key)) return false;
    const { month, year } = parseMonthYear(key);
    const payroll = computeTeacherPaymentStatus(teacher, month, year);
    return payroll.actualStatus !== "PAID" && payroll.remaining > 0;
  });
}

export function computeTeacherRowStatus(row: Record<string, any>, month: number, year: number) {
  return computeTeacherPaymentStatus({ salary:Number(row.salary??0), hourlyRate:Number(row.hourlyRate??0), hoursPerMonth:Number(row.hoursPerMonth??0), payments:[{month,year,status:row.paymentStatus,amount:Number(row.paymentAmount??row.paidAmount??0),missedHours:Number(row.missedHours??0),overtimeHours:Number(row.overtimeHours??0),overtimeRate:row.overtimeRate===null||row.overtimeRate===undefined?null:Number(row.overtimeRate),img:row.paymentMeta}] },month,year);
}

export interface StaffPayrollItem {
  id?: string;
  salary?: number | null;
  payments?: Array<{
    id?: number;
    month: number;
    year: number;
    status?: string | null;
    amount?: number | null;
    paidAt?: Date | string | null;
  }>;
}

export interface StaffStatusCalculation {
  month: number;
  year: number;
  baseSalary: number;
  amountPaid: number;
  remaining: number;
  isPaid: boolean;
  isPartial: boolean;
  isUnpaid: boolean;
  actualStatus: string;
  payment: any | null;
}

/**
 * Pure calculation function for Staff payment status for a specific month/year.
 * Follows strict remaining-balance business rules:
 * - remaining = Math.max(0, baseSalary - amountPaid)
 * - isPaid: remaining <= 0 && (actualStatus === "PAID" || amountPaid >= baseSalary)
 * - isPartial: !isPaid && (amountPaid > 0 && remaining > 0)
 * - isUnpaid: !isPaid && !isPartial
 */
export function computeStaffPaymentStatus(
  item: StaffPayrollItem,
  monthIdx: number,
  yearVal: number
): StaffStatusCalculation {
  const payment = item.payments?.find((p: any) => p.month === monthIdx && p.year === yearVal) || null;
  const actualStatus = payment?.status ? String(payment.status).toUpperCase() : "UNPAID";
  const amountPaid = payment?.amount || 0;
  const baseSalary = item.salary || 0;
  const remaining = Math.max(0, baseSalary - amountPaid);

  const isPaid = (actualStatus === "PAID" || (baseSalary > 0 && amountPaid >= baseSalary)) && remaining <= 0;
  const isPartial = !isPaid && (actualStatus === "PARTIAL" || (amountPaid > 0 && remaining > 0));
  const isUnpaid = !isPaid && !isPartial;

  return {
    month: monthIdx,
    year: yearVal,
    baseSalary,
    amountPaid,
    remaining,
    isPaid,
    isPartial,
    isUnpaid,
    actualStatus,
    payment,
  };
}
