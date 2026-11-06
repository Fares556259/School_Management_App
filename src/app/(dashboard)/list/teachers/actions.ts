"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import { parseMonthYear } from "@/lib/dateUtils";
import { getStudentAdminSchool } from '@/lib/studentProfile';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { saveTeacherOvertime } from '@/lib/teacherOvertime';
import { computeTeacherPaymentStatus } from '@/lib/payrollUtils';

import { totalOvertime, type OvertimeEntry } from "@/lib/overtimeAmount";

class PayrollConflictError extends Error {}

export async function updateOvertimeHours(teacherId:string,monthYear:string,hours:number,expectedRate?:number, options?: { amount?: number; entry?: OvertimeEntry; expectedOvertime: { hours: number; rate: number | null; fixedAmount?: number }; expectedSalary?: { baseSalary: number; deduction: number; amountPaid?: number } }) {
  try {
    const schoolId=await getStudentAdminSchool();const user=await getAuthenticatedUser();if(!user)throw new Error('Unauthorized');
    const {month,year}=parseMonthYear(monthYear);const result=await saveTeacherOvertime({schoolId,adminId:user.id,teacherId,month,year,hours,expectedRate,amount:options?.amount,entry:options?.entry,expectedOvertime:options?.expectedOvertime,expectedSalary:options?.expectedSalary});
    const {invalidateTenantTags}=await import('@/lib/cache');invalidateTenantTags(schoolId,'teachers','finance','dashboard');revalidatePath('/list/teachers');revalidatePath(`/list/teachers/${teacherId}`);
    return {success:true,...result};
  }catch(error:any){return{success:false,error:error.message};}
}

export const updateMissedHours = async (
  teacherId: string,
  monthYear: string,
  missedHours: number,
  meta?: {
    trackedHours?: number;
    deductedHours?: number;
    deductionStatus?: "PENDING" | "APPLIED" | "EXCUSED";
    notes?: string;
  }
) => {
  const parsed = parseMonthYear(monthYear);
  const monthIdx = parsed.month;
  const yearVal = parsed.year;

  try {
    const schoolId = await getStudentAdminSchool();
    const imgData = meta ? JSON.stringify(meta) : undefined;

    // Check if month is already paid - cannot apply deduction to already paid month
    const [existing, teacher] = await Promise.all([
      prisma.payment.findUnique({
        where: {
          teacherId_month_year: { teacherId, month: monthIdx, year: yearVal }
        }
      }),
      prisma.teacher.findUnique({
        where: { id: teacherId, schoolId },
        select: { salary: true, hourlyRate: true, hoursPerMonth: true }
      })
    ]);
    if (!teacher) throw new Error('Enseignant introuvable dans cette école.');
    if (existing && existing.schoolId !== schoolId) throw new Error('Paiement introuvable dans cette école.');

    if (existing?.status === "PAID" && meta?.deductionStatus === "APPLIED") {
      return {
        success: false,
        error: "Ce mois est déjà clôturé et payé. Une retenue ne peut pas être appliquée rétroactivement. Veuillez reporter ces heures sur le mois suivant."
      };
    }

    const baseSalary = (teacher?.hourlyRate && teacher.hourlyRate > 0 && teacher?.hoursPerMonth && teacher.hoursPerMonth > 0)
      ? (teacher.hourlyRate * teacher.hoursPerMonth)
      : (teacher?.salary || 0);
    const effectiveRate = teacher?.hourlyRate && teacher.hourlyRate > 0 ? teacher.hourlyRate : 15;
    const deductedH = meta?.deductionStatus === "APPLIED" ? (meta.deductedHours !== undefined ? meta.deductedHours : missedHours) : 0;
    const deductionAmt = deductedH * effectiveRate;
    const overtimeAmount=totalOvertime(existing, teacher?.hourlyRate??0);
    const netDue = Math.max(0, baseSalary - deductionAmt + overtimeAmount);

    // If an existing payment (advance) covers or exceeds the net due, automatically mark as PAID
    const shouldAutoSettle = Boolean(existing && existing.amount > 0 && existing.amount >= netDue);
    const resolvedStatus = shouldAutoSettle ? "PAID" : (existing?.status || "PENDING");

    const payment = await prisma.payment.upsert({
      where: {
        teacherId_month_year: { teacherId, month: monthIdx, year: yearVal }
      },
      update: {
        missedHours,
        ...(shouldAutoSettle ? { status: "PAID" } : {}),
        ...(imgData !== undefined ? { img: imgData } : {}),
      },
      create: {
        teacherId,
        amount: 0,
        month: monthIdx,
        year: yearVal,
        status: resolvedStatus,
        userType: "TEACHER",
        missedHours,
        ...(imgData !== undefined ? { img: imgData } : {}),
        schoolId,
      }
    });

    const { invalidateTenantTags } = await import("@/lib/cache");
    invalidateTenantTags(schoolId, "dashboard", "teachers");
    revalidatePath("/list/teachers");

    return { success: true, payment };
  } catch (err) {
    console.error("Failed to update missed hours:", err);
    return { success: false, error: "Failed to update missed hours." };
  }
};

export const carryOverMissedHours = async (
  teacherId: string,
  fromMonthYear: string,
  toMonthYear: string,
  hoursToCarry: number
) => {
  const fromParsed = parseMonthYear(fromMonthYear);
  const fromMonthIdx = fromParsed.month;
  const fromYearVal = fromParsed.year;

  const toParsed = parseMonthYear(toMonthYear);
  const toMonthIdx = toParsed.month;
  const toYearVal = toParsed.year;

  try {
    const schoolId = await getStudentAdminSchool();
    if (!await prisma.teacher.findFirst({where:{id:teacherId,schoolId},select:{id:true}})) throw new Error('Enseignant introuvable dans cette école.');

    await prisma.$transaction(async (tx) => {
      // 1. Clear hours from source month and mark as transferred
      const sourceExisting = await tx.payment.findUnique({
        where: {
          teacherId_month_year: { teacherId, month: fromMonthIdx, year: fromYearVal }
        }
      });

      const sourceMeta = {
        trackedHours: 0,
        deductedHours: 0,
        deductionStatus: "EXCUSED" as const,
        notes: `Reporté (${hoursToCarry}h) sur ${toMonthYear}`
      };

      if (sourceExisting) {
        await tx.payment.update({
          where: { id: sourceExisting.id },
          data: {
            missedHours: 0,
            img: JSON.stringify(sourceMeta)
          }
        });
      }

      // 2. Add hours to target month
      const targetExisting = await tx.payment.findUnique({
        where: {
          teacherId_month_year: { teacherId, month: toMonthIdx, year: toYearVal }
        }
      });

      let currentTargetHours = targetExisting?.missedHours || 0;
      if (targetExisting?.img) {
        try {
          const parsed = JSON.parse(targetExisting.img);
          if (parsed.trackedHours !== undefined) {
            currentTargetHours = parsed.trackedHours;
          }
        } catch {}
      }

      const newTargetHours = currentTargetHours + hoursToCarry;
      const targetMeta = {
        trackedHours: newTargetHours,
        deductedHours: 0,
        deductionStatus: "PENDING" as const,
        notes: `Inclus report de ${hoursToCarry}h depuis ${fromMonthYear}`
      };

      await tx.payment.upsert({
        where: {
          teacherId_month_year: { teacherId, month: toMonthIdx, year: toYearVal }
        },
        update: {
          missedHours: newTargetHours,
          img: JSON.stringify(targetMeta)
        },
        create: {
          teacherId,
          amount: 0,
          month: toMonthIdx,
          year: toYearVal,
          status: "PENDING",
          userType: "TEACHER",
          missedHours: newTargetHours,
          img: JSON.stringify(targetMeta),
          schoolId
        }
      });
    });

    const { invalidateTenantTags } = await import("@/lib/cache");
    invalidateTenantTags(schoolId, "dashboard", "teachers");
    revalidatePath("/list/teachers");

    return { success: true };
  } catch (err) {
    console.error("Failed to carry over missed hours:", err);
    return { success: false, error: "Impossible de reporter les heures sur le mois suivant." };
  }
};

export const payTeacherSalary = async (
  teacherId: string,
  teacherName: string,
  amountPaidNow: number,
  monthYear: string,
  missedHours?: number,
  deduction?: number,
  isAdvance: boolean = false,
  expenseTitleInput?: string,
  auditDescriptionInput?: string,
  meta?: {
    trackedHours?: number;
    deductedHours?: number;
    deductionStatus?: "PENDING" | "APPLIED" | "EXCUSED";
    notes?: string;
  },
  expectedPayroll?: { netDue: number; amountPaid: number; overtimeHours: number; overtimeRate: number | null; overtimeFixedAmount?: number }
) => {
  const parsed = parseMonthYear(monthYear);
  const monthIdx = parsed.month;
  const yearVal = parsed.year;
  const standardMonthYear = parsed.monthKey;

  try {
    const schoolId=await getStudentAdminSchool();
    const [existing, teacher] = await Promise.all([
      prisma.payment.findUnique({
        where: {
          teacherId_month_year: {
            teacherId,
            month: monthIdx,
            year: yearVal
          }
        }
      }),
      prisma.teacher.findUnique({
        where: { id: teacherId, schoolId },
        select: { salary: true, hourlyRate: true, hoursPerMonth: true }
      })
    ]);
    if (!teacher) throw new Error('Enseignant introuvable dans cette école.');

    if (existing?.status === "PAID") {
      throw new Error("Ce mois est déjà entièrement payé et clôturé.");
    }

    if (existing && existing.schoolId !== schoolId) throw new Error('Paiement introuvable dans cette école.');
    const imgData = meta ? JSON.stringify(meta) : undefined;
    const payroll = computeTeacherPaymentStatus({ ...teacher, payments: [{
      ...existing, month: monthIdx, year: yearVal,
      missedHours: missedHours ?? existing?.missedHours ?? 0,
      img: imgData ?? existing?.img,
    }] }, monthIdx, yearVal);
    const netDue = payroll.netDue;
    const previousPaid = payroll.amountPaid;
    if (expectedPayroll && (
      !Number.isFinite(expectedPayroll.netDue) || !Number.isFinite(expectedPayroll.amountPaid) ||
      Math.abs(expectedPayroll.netDue - netDue) > 0.00001 ||
      Math.abs(expectedPayroll.amountPaid - previousPaid) > 0.00001 ||
      expectedPayroll.overtimeHours !== payroll.overtimeHours ||
      expectedPayroll.overtimeRate !== (existing?.overtimeRate ?? null) ||
      (expectedPayroll.overtimeFixedAmount ?? 0) !== (existing?.overtimeFixedAmount || 0)
    )) throw new PayrollConflictError('La paie a changé. Actualisez et vérifiez le nouveau solde avant de payer.');
    if(!Number.isFinite(amountPaidNow)||amountPaidNow<=0||Math.abs(amountPaidNow*1000-Math.round(amountPaidNow*1000))>0.00001||amountPaidNow>payroll.remaining) throw new Error('Montant supérieur au salaire restant ou invalide.');
    const newTotalAmount = Math.round((previousPaid + amountPaidNow)*1000)/1000;
    const isFullyCovered = newTotalAmount >= netDue && newTotalAmount > 0;
    const newStatus = isFullyCovered ? "PAID" : (newTotalAmount > 0 ? "PARTIAL" : "PENDING");
    const payment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Teacher" WHERE id=${teacherId} AND "schoolId"=${schoolId} FOR UPDATE`;
      const latestTeacher = await tx.teacher.findFirst({ where: { id: teacherId, schoolId }, select: { salary: true, hourlyRate: true, hoursPerMonth: true } });
      if (!latestTeacher || latestTeacher.salary !== teacher.salary || latestTeacher.hourlyRate !== teacher.hourlyRate || latestTeacher.hoursPerMonth !== teacher.hoursPerMonth) throw new PayrollConflictError('Le salaire a changé. Actualisez avant de payer.');
      const latest=await tx.payment.findUnique({where:{teacherId_month_year:{teacherId,month:monthIdx,year:yearVal}}});
      const revision=(value:any)=>JSON.stringify(value?{amount:value.amount,status:value.status,img:value.img,missedHours:value.missedHours,overtimeHours:value.overtimeHours,overtimeRate:value.overtimeRate,overtimeFixedAmount:value.overtimeFixedAmount}:null);
      if(revision(latest)!==revision(existing)) throw new PayrollConflictError('La paie a changé. Actualisez et vérifiez le nouveau solde avant de payer.');
      const p = await tx.payment.upsert({
        where: {
          teacherId_month_year: {
            teacherId,
            month: monthIdx,
            year: yearVal
          }
        },
        update: {
          status: newStatus,
          paidAt: new Date(),
          amount: newTotalAmount,
          missedHours: missedHours !== undefined ? missedHours : existing?.missedHours || 0,
          ...(imgData !== undefined ? { img: imgData } : {}),
        },
        create: {
          teacherId,
          amount: newTotalAmount,
          month: monthIdx,
          year: yearVal,
          status: newStatus,
          userType: "TEACHER",
          paidAt: new Date(),
          missedHours: missedHours || 0,
          ...(imgData !== undefined ? { img: imgData } : {}),
          schoolId,
        }
      });

      // Build expense title with deduction info
      let expenseTitle = expenseTitleInput || (isAdvance 
        ? `Advance: ${teacherName} (${standardMonthYear})`
        : `Salary: ${teacherName} (${standardMonthYear})`);
        
      if (!expenseTitleInput && deduction && deduction > 0) {
        expenseTitle += ` - ${missedHours}h missed`;
      }

      // Also add to Expense table for central reporting
      await tx.expense.create({
        data: {
          title: expenseTitle,
          amount: amountPaidNow,
          date: new Date(),
          category: isAdvance ? "Advance" : "Salary",
          referenceType: "TeacherSalary",
          referenceId: p.id.toString(),
          schoolId,
        },
      });

      return p;
    }, {
      timeout: 15000
    });

    const effectiveDate = new Date(yearVal, monthIdx - 1, 1);
    createAuditLog({
      action: isAdvance ? "PAY_ADVANCE" : "PAY_SALARY",
      entityType: "Teacher",
      entityId: teacherId,
      description: auditDescriptionInput || (isAdvance
        ? `Paid advance of ${amountPaidNow} DT to ${teacherName} for ${standardMonthYear}`
        : `Paid salary of ${amountPaidNow} DT to ${teacherName} for ${standardMonthYear}${deduction ? ` (${missedHours}h missed, -${deduction} DT deduction)` : ''}`),
      amount: amountPaidNow,
      type: 'expense',
      effectiveDate,
    }).catch(err => console.error("Non-blocking audit log error:", err));

    const { invalidateTenantTags } = await import("@/lib/cache");
    invalidateTenantTags(schoolId, "dashboard", "finance", "teachers", "expenses");

    revalidatePath("/list/teachers");
    revalidatePath("/list/expenses");
    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    return { success: true, payment };
  } catch (err) {
    console.error("Failed to process salary payment:", err);
    return { success: false, error: err instanceof PayrollConflictError ? err.message : "Failed to process payment." };
  }
};

export const getTeacherProfileBundle = async (teacherId: string) => {
  try {
    const schoolId = await getSchoolId();
    
    // Direct Prisma fetch to avoid Next.js unstable_cache deadlocks in Server Actions
    const [teacher, teacherExpenses] = await Promise.all([
      prisma.teacher.findUnique({
        where: { id: teacherId },
        include: {
          subjects: true,
          classes: true,
          payments: true,
          timetable: {
            where: { isDraft: false },
            include: { subject: true, class: true, room: true },
            orderBy: [{ day: "asc" }, { slotNumber: "asc" }],
          },
          lessons: { include: { subject: true, class: true } },
          _count: { select: { lessons: true, classes: true, subjects: true } },
        },
      }),
      prisma.expense.findMany({
        where: {
          schoolId,
          OR: [
            { referenceType: "TeacherSalary", referenceId: teacherId },
            // Note: If we need previous payments from pIds, we can fetch them, but for safety:
            { category: "Advance" }
          ]
        },
        orderBy: { date: "asc" },
      })
    ]);

    if (!teacher || teacher.schoolId !== schoolId) {
      return { success: false, error: "Teacher not found" };
    }

    const pIds = (teacher.payments || []).map((p: any) => p.id.toString());
    const filteredExpenses = teacherExpenses.filter(exp => {
      if (exp.referenceType === "TeacherSalary" && pIds.includes(exp.referenceId)) return true;
      if (exp.referenceType === "TeacherSalary" && exp.referenceId === teacher.id) return true;
      if (exp.category === "Advance" && exp.title?.includes(teacher.name)) return true;
      return false;
    });

    const uniqueSubjectsMap = new Map<number, string>();
    teacher.subjects.forEach((s: any) => {
      const cleanName = s.name.split("|")[0].trim();
      uniqueSubjectsMap.set(s.id, cleanName);
    });
    const cleanSubjects = Array.from(uniqueSubjectsMap.values());

    const scheduleItems = (teacher.timetable && teacher.timetable.length > 0)
      ? teacher.timetable.map((slot: any) => ({
          id: slot.id,
          day: (slot.day || "MONDAY").toUpperCase(),
          startTime: typeof slot.startTime === "string" && slot.startTime.trim() ? slot.startTime.trim() : "08:00",
          endTime: typeof slot.endTime === "string" && slot.endTime.trim() ? slot.endTime.trim() : "10:00",
          duration: slot.duration || 120,
          subjectName: slot.subject?.name ? slot.subject.name.split("|")[0].trim() : "Matière",
          subjectId: slot.subjectId || 0,
          className: slot.class?.name || "Classe",
          classId: slot.classId,
          roomName: slot.room?.name || undefined,
        }))
      : (teacher.lessons || []).map((l: any) => {
          let sh = "08"; let sm = "00"; let eh = "09"; let em = "00"; let dur = 60;
          try {
            if (l.startTime) {
              const start = new Date(l.startTime);
              if (!isNaN(start.getTime())) {
                sh = String(start.getHours()).padStart(2, "0");
                sm = String(start.getMinutes()).padStart(2, "0");
              }
            }
            if (l.endTime) {
              const end = new Date(l.endTime);
              if (!isNaN(end.getTime())) {
                eh = String(end.getHours()).padStart(2, "0");
                em = String(end.getMinutes()).padStart(2, "0");
                if (l.startTime) {
                  const start = new Date(l.startTime);
                  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
                  if (diff > 0) dur = diff;
                }
              }
            }
          } catch {}
          return {
            id: l.id,
            day: (l.day || "MONDAY").toUpperCase(),
            startTime: `${sh}:${sm}`,
            endTime: `${eh}:${em}`,
            duration: dur,
            subjectName: l.subject?.name ? l.subject.name.split("|")[0].trim() : (l.name || "Matière"),
            subjectId: l.subjectId || 0,
            className: l.class?.name || "Classe",
            classId: l.classId,
            roomName: undefined,
          };
        });

    const teacherFullName = `${teacher.name} ${teacher.surname}`;

    const totalWeeklyMinutes = scheduleItems.reduce((acc: number, curr: any) => {
      if (curr.duration) return acc + curr.duration;
      const [sh, sm] = curr.startTime.split(":").map(Number);
      const [eh, em] = curr.endTime.split(":").map(Number);
      const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
      return acc + (diff > 0 ? diff : 120);
    }, 0);

    const totalHours = Math.round(totalWeeklyMinutes / 60);

    return {
      success: true,
      data: {
        teacher,
        expenses: filteredExpenses,
        cleanSubjects,
        scheduleItems,
        teacherFullName,
        totalHours,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

