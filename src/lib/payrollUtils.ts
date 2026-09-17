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
 * - netDue = baseSalary - deduction
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
  const amountPaid = payment?.amount || 0;

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
  const netDue = Math.max(0, baseSalary - deduction);
  const remaining = Math.max(0, netDue - amountPaid);

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
