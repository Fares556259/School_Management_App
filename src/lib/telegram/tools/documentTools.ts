import prisma from "@/lib/prisma";
import { MONTHS, formatMonthFrench } from "@/lib/dateUtils";
import { generateTuitionReceiptPdf, generateSalaryPayslipPdf } from "@/lib/pdf/receipts";
import { sendTelegramDocument } from "../telegram";
import { resolveStudentByName, resolveTeacherByName, resolveStaffByName } from "./entityResolvers";
import { ToolContext } from "./readTools";

export interface DocumentToolResult {
  success: boolean;
  message: string;
  summary: string;
  data?: any;
}

/**
 * Deliver a tuition payment receipt PDF to the chat.
 */
export async function deliverTuitionReceipt(params: {
  studentId: string;
  schoolId: string;
  schoolName: string;
  adminName?: string;
  chatId: string | number;
  month?: number;
  year?: number;
  amountOverride?: number;
}): Promise<boolean> {
  try {
    const student = await prisma.student.findFirst({
      where: { id: params.studentId, schoolId: params.schoolId },
      include: { class: true, level: true, parent: true },
    });
    if (!student) return false;

    const now = new Date();
    const targetMonth = params.month || now.getMonth() + 1;
    const targetYear = params.year || now.getFullYear();

    // Look for payment in database
    const payment = await prisma.payment.findFirst({
      where: {
        studentId: student.id,
        schoolId: params.schoolId,
        userType: "STUDENT",
        month: targetMonth,
        year: targetYear,
      },
    });

    const tuitionFee = student.customTuition || student.level?.tuitionFee || 450;
    const amountPaid = params.amountOverride !== undefined
      ? params.amountOverride
      : (payment?.amount || tuitionFee);

    const remainingDue = payment?.status === "PAID"
      ? 0
      : payment?.deferredAmount ?? Math.max(0, tuitionFee - amountPaid);

    const periodFrench = formatMonthFrench(`${MONTHS[targetMonth - 1]} ${targetYear}`);
    const receiptNumber = `REC-${targetYear}${String(targetMonth).padStart(2, "0")}-${String(
      payment?.id || Math.floor(Math.random() * 89999 + 10000)
    ).padStart(5, "0")}`;

    const { buffer, filename } = await generateTuitionReceiptPdf({
      schoolName: params.schoolName,
      receiptNumber,
      paymentDate: payment?.paidAt || new Date(),
      studentName: `${student.name} ${student.surname}`,
      studentClass: student.class?.name || "Non assignée",
      parentName: student.parent ? `${student.parent.name} ${student.parent.surname}` : "Parent / Tuteur",
      parentPhone: student.parent?.phone || undefined,
      periodFrench,
      amountPaid,
      tuitionFee,
      remainingDue,
      adminName: params.adminName,
    });

    const caption = `📄 <b>Reçu Officiel de Paiement</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 Élève : <b>${student.name} ${student.surname}</b> (${student.class?.name || "Sans classe"})\n📅 Mois : <code>${periodFrench}</code>\n💰 Montant : <code>${amountPaid} DT</code> ${remainingDue === 0 ? "🟢 (Soldé)" : `⏳ (Reste: ${remainingDue} DT)`}\n\n<i>Document officiel certifié SnapSchool</i>`;

    await sendTelegramDocument(params.chatId, buffer, filename, {
      caption,
      parse_mode: "HTML",
    });

    return true;
  } catch (err) {
    console.error("[deliverTuitionReceipt] Error generating/sending receipt:", err);
    return false;
  }
}

/**
 * Deliver a teacher or staff salary payslip PDF to the chat.
 */
export async function deliverSalaryPayslip(params: {
  employeeId: string;
  employeeType: "TEACHER" | "STAFF";
  schoolId: string;
  schoolName: string;
  adminName?: string;
  chatId: string | number;
  month?: number;
  year?: number;
  amountOverride?: number;
  isAdvance?: boolean;
  missedHours?: number;
  deductionsAmount?: number;
  remainingAfter?: number;
}): Promise<boolean> {
  try {
    const now = new Date();
    const targetMonth = params.month || now.getMonth() + 1;
    const targetYear = params.year || now.getFullYear();
    const periodFrench = formatMonthFrench(`${MONTHS[targetMonth - 1]} ${targetYear}`);

    if (params.employeeType === "TEACHER") {
      const teacher = await prisma.teacher.findFirst({
        where: { id: params.employeeId, schoolId: params.schoolId },
        include: { subjects: true },
      });
      if (!teacher) return false;

      const payment = await prisma.payment.findFirst({
        where: {
          teacherId: teacher.id,
          schoolId: params.schoolId,
          month: targetMonth,
          year: targetYear,
          userType: "TEACHER",
        },
      });

      const baseSalary = teacher.salary || 600;
      const netPaid = params.amountOverride !== undefined
        ? params.amountOverride
        : (payment?.amount || baseSalary);

      const payslipNumber = `BUL-${targetYear}${String(targetMonth).padStart(2, "0")}-${String(
        payment?.id || Math.floor(Math.random() * 89999 + 10000)
      ).padStart(5, "0")}`;

      const { buffer, filename } = await generateSalaryPayslipPdf({
        schoolName: params.schoolName,
        payslipNumber,
        paymentDate: payment?.paidAt || new Date(),
        employeeName: `${teacher.name} ${teacher.surname}`,
        employeeRole: teacher.subjects?.[0]?.name ? `Enseignant ${teacher.subjects[0].name}` : "Enseignant",
        employeeType: "TEACHER",
        periodFrench,
        baseSalary,
        hourlyRate: teacher.hourlyRate || undefined,
        missedHours: params.missedHours !== undefined ? params.missedHours : (payment?.missedHours || 0),
        deductionsAmount: params.deductionsAmount,
        advancesAmount: params.isAdvance ? netPaid : undefined,
        netPaid,
        remainingDue: params.remainingAfter ?? (payment?.status === "PAID" ? 0 : undefined),
        adminName: params.adminName,
      });

      const caption = `📑 <b>Bulletin de Paie Officiel</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👨‍🏫 Enseignant : <b>${teacher.name} ${teacher.surname}</b>\n📅 Période : <code>${periodFrench}</code>\n💰 Net versé : <code>${netPaid} DT</code>\n\n<i>Document officiel certifié SnapSchool</i>`;

      await sendTelegramDocument(params.chatId, buffer, filename, {
        caption,
        parse_mode: "HTML",
      });

      return true;
    } else {
      // STAFF
      const staff = await prisma.staff.findFirst({
        where: { id: params.employeeId, schoolId: params.schoolId },
      });
      if (!staff) return false;

      const payment = await prisma.payment.findFirst({
        where: {
          staffId: staff.id,
          schoolId: params.schoolId,
          month: targetMonth,
          year: targetYear,
          userType: "STAFF",
        },
      });

      const baseSalary = staff.salary || 1500;
      const netPaid = params.amountOverride !== undefined
        ? params.amountOverride
        : (payment?.amount || baseSalary);

      const payslipNumber = `BUL-${targetYear}${String(targetMonth).padStart(2, "0")}-${String(
        payment?.id || Math.floor(Math.random() * 89999 + 10000)
      ).padStart(5, "0")}`;

      const { buffer, filename } = await generateSalaryPayslipPdf({
        schoolName: params.schoolName,
        payslipNumber,
        paymentDate: payment?.paidAt || new Date(),
        employeeName: `${staff.name} ${staff.surname}`,
        employeeRole: staff.role || "Membre du personnel",
        employeeType: "STAFF",
        periodFrench,
        baseSalary,
        netPaid,
        remainingDue: params.remainingAfter ?? (payment?.status === "PAID" ? 0 : undefined),
        adminName: params.adminName,
      });

      const caption = `📑 <b>Bulletin de Paie Officiel</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👤 Personnel : <b>${staff.name} ${staff.surname}</b> (${staff.role || "Staff"})\n📅 Période : <code>${periodFrench}</code>\n💰 Net versé : <code>${netPaid} DT</code>\n\n<i>Document officiel certifié SnapSchool</i>`;

      await sendTelegramDocument(params.chatId, buffer, filename, {
        caption,
        parse_mode: "HTML",
      });

      return true;
    }
  } catch (err) {
    console.error("[deliverSalaryPayslip] Error generating/sending payslip:", err);
    return false;
  }
}

/**
 * On-demand Tool: get_payment_receipt
 * Finds a student's payment record, generates official PDF receipt, and delivers it to Telegram.
 */
export async function getPaymentReceiptTool(
  args: {
    studentNameOrId: string;
    month?: number;
    year?: number;
  },
  context: ToolContext
): Promise<DocumentToolResult> {
  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return {
      success: false,
      message: `❌ Élève "<b>${args.studentNameOrId}</b>" introuvable dans l'établissement.`,
      summary: "Élève introuvable",
    };
  }

  const now = new Date();
  const targetMonth = args.month || now.getMonth() + 1;
  const targetYear = args.year || now.getFullYear();
  const targetMonthLabel = formatMonthFrench(`${MONTHS[targetMonth - 1]} ${targetYear}`);

  // Fetch school details
  const school = await prisma.school.findUnique({
    where: { id: context.schoolId },
    select: { name: true },
  });
  const schoolName = school?.name || "SnapSchool";

  if (!context.chatId) {
    return {
      success: false,
      message: "Chat ID non disponible pour l'envoi du document.",
      summary: "Chat ID manquant",
    };
  }

  const delivered = await deliverTuitionReceipt({
    studentId: student.id,
    schoolId: context.schoolId,
    schoolName,
    adminName: context.adminName,
    chatId: context.chatId,
    month: targetMonth,
    year: targetYear,
  });

  if (!delivered) {
    return {
      success: false,
      message: `⚠️ Impossible de générer le reçu pour <b>${student.name} ${student.surname}</b> (${targetMonthLabel}). Vérifie qu'un paiement existe pour ce mois.`,
      summary: "Échec génération reçu",
    };
  }

  return {
    success: true,
    message: `📄 <b>Reçu officiel généré avec succès</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 Élève : <b>${student.name} ${student.surname}</b> (<code>${student.class?.name || "Sans classe"}</code>)
📅 Période : <code>${targetMonthLabel}</code>
🏢 Établissement : <b>${schoolName}</b>

<blockquote>💡 <b>Hnia :</b> Le reçu PDF officiel a été envoyé ci-dessus en pièce jointe. Vous pouvez le transférer directement au parent en 1 clic.</blockquote>`,
    summary: `Reçu PDF ${student.name} (${targetMonthLabel})`,
    data: { studentId: student.id, month: targetMonth, year: targetYear },
  };
}

/**
 * On-demand Tool: get_salary_payslip
 * Finds a teacher/staff salary record, generates official PDF payslip, and delivers it to Telegram.
 */
export async function getSalaryPayslipTool(
  args: {
    nameOrId: string;
    userType?: "TEACHER" | "STAFF";
    month?: number;
    year?: number;
  },
  context: ToolContext
): Promise<DocumentToolResult> {
  const now = new Date();
  const targetMonth = args.month || now.getMonth() + 1;
  const targetYear = args.year || now.getFullYear();
  const targetMonthLabel = formatMonthFrench(`${MONTHS[targetMonth - 1]} ${targetYear}`);

  const school = await prisma.school.findUnique({
    where: { id: context.schoolId },
    select: { name: true },
  });
  const schoolName = school?.name || "SnapSchool";

  if (!context.chatId) {
    return {
      success: false,
      message: "Chat ID non disponible pour l'envoi du document.",
      summary: "Chat ID manquant",
    };
  }

  // Try Teacher first if userType not specified or TEACHER
  let isTeacher = args.userType !== "STAFF";
  let teacher = isTeacher ? await resolveTeacherByName(context.schoolId, args.nameOrId) : null;
  let staff = null;

  if (!teacher) {
    staff = await resolveStaffByName(context.schoolId, args.nameOrId);
    if (staff) isTeacher = false;
  }

  if (!teacher && !staff) {
    return {
      success: false,
      message: `❌ Employé (enseignant ou personnel) "<b>${args.nameOrId}</b>" introuvable.`,
      summary: "Employé introuvable",
    };
  }

  const employeeId = isTeacher ? teacher!.id : staff!.id;
  const employeeName = isTeacher ? `${teacher!.name} ${teacher!.surname}` : `${staff!.name} ${staff!.surname}`;

  const delivered = await deliverSalaryPayslip({
    employeeId,
    employeeType: isTeacher ? "TEACHER" : "STAFF",
    schoolId: context.schoolId,
    schoolName,
    adminName: context.adminName,
    chatId: context.chatId,
    month: targetMonth,
    year: targetYear,
  });

  if (!delivered) {
    return {
      success: false,
      message: `⚠️ Impossible de générer le bulletin de paie pour <b>${employeeName}</b> (${targetMonthLabel}).`,
      summary: "Échec bulletin de paie",
    };
  }

  return {
    success: true,
    message: `📑 <b>Bulletin de paie généré avec succès</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 Salarié : <b>${employeeName}</b> (${isTeacher ? "Enseignant" : "Personnel"})
📅 Période : <code>${targetMonthLabel}</code>
🏢 Établissement : <b>${schoolName}</b>

<blockquote>💡 <b>Hnia :</b> Le bulletin PDF officiel a été envoyé ci-dessus en pièce jointe. Vous pouvez le transférer directement au salarié.</blockquote>`,
    summary: `Fiche de paie ${employeeName} (${targetMonthLabel})`,
    data: { employeeId, employeeType: isTeacher ? "TEACHER" : "STAFF", month: targetMonth, year: targetYear },
  };
}
