import prisma from "@/lib/prisma";
import { MONTHS, formatMonthFrench } from "@/lib/dateUtils";
import {
  generateTuitionReceiptPdf,
  generateSalaryPayslipPdf,
  generateDailyCashRegisterPdf,
} from "@/lib/pdf/receipts";
import {
  generateSchoolWallNoticePdf,
  NoticeCategory,
  containsArabic,
} from "@/lib/pdf/schoolWallNotice";
import { generateSchoolWordDocument, WordSection } from "@/lib/word/wordEngine";
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
  paymentMethod?: string;
  checkNumber?: string;
  bankName?: string;
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
      paymentMethod: params.paymentMethod || (params.checkNumber ? "Chèque" : "Espèces"),
      checkNumber: params.checkNumber,
      bankName: params.bankName,
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

/**
 * Deliver a daily cash register & financial summary PDF to the chat.
 */
export async function deliverDailyCashReport(params: {
  schoolId: string;
  schoolName: string;
  adminName?: string;
  chatId: string | number;
  date?: string;
}): Promise<boolean> {
  try {
    const targetDate = params.date ? new Date(params.date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [incomesToday, expensesToday, paymentsToday] = await Promise.all([
      prisma.income.findMany({
        where: {
          schoolId: params.schoolId,
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { date: "asc" },
      }),
      prisma.expense.findMany({
        where: {
          schoolId: params.schoolId,
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { date: "asc" },
      }),
      prisma.payment.findMany({
        where: {
          schoolId: params.schoolId,
          paidAt: { gte: startOfDay, lte: endOfDay },
          userType: "STUDENT",
        },
        include: {
          student: {
            select: { name: true, surname: true, class: { select: { name: true } } },
          },
        },
        orderBy: { paidAt: "asc" },
      }),
    ]);

    // Build inflow items
    const inflowItems: Array<{
      time?: string;
      label: string;
      categoryOrClass?: string;
      method?: string;
      checkDetails?: string;
      amount: number;
    }> = [];

    // Track income reference IDs to avoid duplication if payment also generated an Income record
    const recordedIncomeRefIds = new Set(
      incomesToday.map((inc) => inc.referenceId).filter(Boolean)
    );

    for (const inc of incomesToday) {
      const isCheck = inc.title.toLowerCase().includes("chèque") || inc.title.toLowerCase().includes("cheque");
      const isTransfer = inc.title.toLowerCase().includes("virement") || inc.category.toLowerCase().includes("transfer");
      const method = isCheck ? "Chèque" : isTransfer ? "Virement" : "Espèces";

      // Check if check number is mentioned in title (e.g. "Chèque N° 123456")
      const checkMatch = inc.title.match(/ch[eè]que\s*(?:n[°o]?)?\s*([0-9a-zA-Z_-]+)/i);
      const checkDetails = checkMatch ? checkMatch[1] : undefined;

      inflowItems.push({
        time: inc.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        label: inc.title,
        categoryOrClass: inc.category,
        method,
        checkDetails,
        amount: inc.amount,
      });
    }

    // Include any student payments that were not recorded as an Income record
    for (const pmt of paymentsToday) {
      if (recordedIncomeRefIds.has(pmt.id.toString())) continue;
      const studentName = pmt.student ? `${pmt.student.name} ${pmt.student.surname}` : "Élève";
      const className = pmt.student?.class?.name || "Sans classe";
      const time = pmt.paidAt ? pmt.paidAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

      inflowItems.push({
        time,
        label: `Scolarité : ${studentName}`,
        categoryOrClass: className,
        method: "Espèces",
        amount: pmt.amount,
      });
    }

    // Build outflow items
    const outflowItems = expensesToday.map((exp) => {
      const isTransfer = exp.title.toLowerCase().includes("virement");
      const isCheck = exp.title.toLowerCase().includes("chèque") || exp.title.toLowerCase().includes("cheque");
      const method = isCheck ? "Chèque" : isTransfer ? "Virement" : "Espèces / Caisse";

      return {
        time: exp.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        label: exp.title,
        categoryOrClass: exp.category,
        method,
        amount: exp.amount,
      };
    });

    const totalIncomes = inflowItems.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = outflowItems.reduce((sum, item) => sum + item.amount, 0);
    const netBalance = totalIncomes - totalExpenses;

    const totalChecks = inflowItems
      .filter((i) => i.method === "Chèque" || Boolean(i.checkDetails))
      .reduce((sum, i) => sum + i.amount, 0);
    const checkCount = inflowItems.filter((i) => i.method === "Chèque" || Boolean(i.checkDetails)).length;

    const totalTransfers = inflowItems
      .filter((i) => i.method === "Virement")
      .reduce((sum, i) => sum + i.amount, 0);

    const totalCash = Math.max(0, totalIncomes - totalChecks - totalTransfers);

    const { buffer, filename } = await generateDailyCashRegisterPdf({
      schoolName: params.schoolName,
      date: targetDate,
      adminName: params.adminName,
      totalIncomes,
      totalExpenses,
      netBalance,
      totalCash,
      totalChecks,
      checkCount,
      totalTransfers,
      inflowItems,
      outflowItems,
    });

    const dateFormatted = targetDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const caption = `📊 <b>Bordereau Officiel de Caisse Journalière</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Date : <code>${dateFormatted}</code>\n🏢 Établissement : <b>${params.schoolName}</b>\n💰 Recettes : <code>+${totalIncomes.toFixed(2)} DT</code>\n💸 Dépenses : <code>-${totalExpenses.toFixed(2)} DT</code>\n⚖️ Solde Net : <b>${netBalance >= 0 ? "+" : ""}${netBalance.toFixed(2)} DT</b>\n🏦 Chèques : <code>${totalChecks.toFixed(2)} DT (${checkCount})</code> | 💵 Espèces : <code>${totalCash.toFixed(2)} DT</code>\n\n<i>Bordereau certifié pour classement physique et archives comptables.</i>`;

    await sendTelegramDocument(params.chatId, buffer, filename, {
      caption,
      parse_mode: "HTML",
    });

    return true;
  } catch (err) {
    console.error("[deliverDailyCashReport] Error generating/sending daily cash PDF:", err);
    return false;
  }
}

/**
 * On-demand Tool: get_daily_cash_pdf
 * Generates and delivers the official Daily Cash Register PDF for today or a specific date.
 */
export async function getDailyCashPdfTool(
  args: { date?: string },
  context: ToolContext
): Promise<DocumentToolResult> {
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

  const targetDate = args.date ? new Date(args.date) : new Date();
  const dateFormatted = targetDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const delivered = await deliverDailyCashReport({
    schoolId: context.schoolId,
    schoolName,
    adminName: context.adminName,
    chatId: context.chatId,
    date: args.date,
  });

  if (!delivered) {
    return {
      success: false,
      message: `⚠️ Impossible de générer le bordereau de caisse pour le <b>${dateFormatted}</b>.`,
      summary: "Échec bordereau caisse",
    };
  }

  return {
    success: true,
    message: `📊 <b>Bordereau officiel de caisse transmis</b>
━━━━━━━━━━━━━━━━━━━━━━
📅 Date : <code>${dateFormatted}</code>
🏢 Établissement : <b>${schoolName}</b>

<blockquote>💡 <b>Hnia :</b> Le bordereau de caisse au format A4 a été envoyé ci-dessus en pièce jointe PDF. Vous pouvez l'imprimer directement pour votre classeur de caisse physique.</blockquote>`,
    summary: `Bordereau PDF (${dateFormatted})`,
    data: { date: dateFormatted },
  };
}

/**
 * Tool: generate_school_wall_notice_pdf
 * Generates an executive, printable A4 PDF poster / wall notice (affiche murale / panneau d'affichage)
 * ready to be printed and pinned to the school wall, entrance, or classrooms.
 */
export async function generateSchoolWallNoticePdfTool(
  args: {
    title: string;
    bodyText: string;
    language?: "fr" | "ar" | "en" | string;
    category?: NoticeCategory | string;
    importantNotice?: string;
    targetAudience?: string;
    dateStr?: string;
    signatory?: string;
    referenceNumber?: string;
  },
  context: ToolContext
): Promise<DocumentToolResult> {
  if (!context.chatId) {
    return {
      success: false,
      message: "Identifiant de chat manquant pour l'envoi du document.",
      summary: "Chat ID manquant",
    };
  }

  try {
    let schoolName = "SnapSchool Academy";
    try {
      if (context.schoolId) {
        const school = await prisma.school.findUnique({
          where: { id: context.schoolId },
          select: { name: true },
        });
        if (school?.name) schoolName = school.name;
      }
    } catch (dbErr) {
      console.warn("[generateSchoolWallNoticePdfTool] School lookup skipped:", dbErr);
    }

    const requestedLang = (args.language || "").toLowerCase().trim();
    const isArabic =
      requestedLang === "ar" ||
      requestedLang.startsWith("ar") ||
      containsArabic(args.title) ||
      containsArabic(args.bodyText);
    const isEnglish = !isArabic && (requestedLang === "en" || requestedLang.startsWith("en"));

    const { buffer, filename } = await generateSchoolWallNoticePdf({
      schoolName,
      title: args.title,
      language: args.language,
      category: args.category, // Do not default: keep clean Title + Description only
      bodyText: args.bodyText,
      importantNotice: args.importantNotice,
      targetAudience: args.targetAudience,
      dateStr: args.dateStr,
      signatory: args.signatory,
      referenceNumber: args.referenceNumber,
    });

    let caption: string;
    let returnMessage: string;

    if (isArabic) {
      const displayDate = args.dateStr || new Intl.DateTimeFormat("ar-TN", { dateStyle: "long" }).format(new Date());
      caption = `🏛️ <b>إشعار رسمي للتعليق الحائطي (صيغة A4 للطباعة)</b>
━━━━━━━━━━━━━━━━━━━━━━
📌 العنوان : <b>${args.title}</b>
🏫 المؤسسة : <b>${schoolName}</b>
${args.targetAudience ? `👥 المعنيون : <i>${args.targetAudience}</i>\n` : ""}📅 التاريخ : <code>${displayDate}</code>

<i>جاهز للطباعة والتعليق على جدران المدرسة أو لوحة الإعلانات.</i>`;

      returnMessage = `📄 <b>تم إنشاء الإشعار الحائطي PDF وإرساله بنجاح!</b>\n\nتم إرسال الملف الرسمي <code>${filename}</code> عالي الجودة إلى المحادثة. يمكنكم طباعته فوراً لتعليقه على جدران المدرسة أو لوحة الإعلانات.`;
    } else if (isEnglish) {
      const displayDate = args.dateStr || new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date());
      caption = `🏛️ <b>Official Wall Notice (Printable A4 PDF)</b>
━━━━━━━━━━━━━━━━━━━━━━
📌 Title: <b>${args.title}</b>
🏫 School: <b>${schoolName}</b>
${args.targetAudience ? `👥 Target Audience: <i>${args.targetAudience}</i>\n` : ""}📅 Date: <code>${displayDate}</code>

<i>Ready to print and display on school notice boards and walls.</i>`;

      returnMessage = `📄 <b>Official wall notice PDF generated and sent!</b>\n\nThe printable document <code>${filename}</code> (high resolution A4) has been delivered to your chat. You can print it immediately for display on notice boards.`;
    } else {
      const displayDate = args.dateStr || new Date().toLocaleDateString("fr-FR");
      caption = `🏛️ <b>Affiche Murale Officielle (Format A4 Imprimable)</b>
━━━━━━━━━━━━━━━━━━━━━━
📌 Titre : <b>${args.title}</b>
🏫 Établissement : <b>${schoolName}</b>
${args.targetAudience ? `👥 Public concerné : <i>${args.targetAudience}</i>\n` : ""}📅 Date : <code>${displayDate}</code>

<i>Prête à imprimer pour affichage au mur, tableau d'affichage ou entrée de l'école.</i>`;

      returnMessage = `📄 <b>Affiche murale PDF générée et transmise !</b>\n\nLe document officiel <code>${filename}</code> (A4 haute résolution) a été envoyé dans le chat. Vous pouvez l'imprimer directement pour l'afficher sur le mur ou le tableau d'affichage de l'école.`;
    }

    await sendTelegramDocument(context.chatId, buffer, filename, {
      caption,
      parse_mode: "HTML",
    });

    return {
      success: true,
      message: returnMessage,
      summary: `Affiche murale générée : ${filename}`,
      data: { filename },
    };
  } catch (err: any) {
    console.error("[generateSchoolWallNoticePdfTool] Error:", err);
    return {
      success: false,
      message: `Erreur lors de la génération de l'affiche PDF : ${err.message || String(err)}`,
      summary: "Échec génération affiche PDF",
    };
  }
}

/**
 * Tool: generate_word_document
 * Generates an executive Microsoft Word (.docx) document (lettre officielle, PV, note de service).
 */
export async function generateWordDocumentTool(
  args: {
    title: string;
    sections: WordSection[];
    documentType?: "administrative_letter" | "circular" | "internal_memo" | "meeting_minutes" | "custom";
    recipient?: string;
    dateStr?: string;
    signatory?: string;
    referenceNumber?: string;
  },
  context: ToolContext
): Promise<DocumentToolResult> {
  if (!context.chatId) {
    return {
      success: false,
      message: "Identifiant de chat manquant pour l'envoi du document.",
      summary: "Chat ID manquant",
    };
  }

  try {
    const school = await prisma.school.findUnique({
      where: { id: context.schoolId },
      select: { name: true },
    });
    const schoolName = school?.name || "SnapSchool Academy";

    const { buffer, filename } = await generateSchoolWordDocument({
      schoolName,
      title: args.title,
      documentType: args.documentType || "administrative_letter",
      recipient: args.recipient,
      dateStr: args.dateStr,
      referenceNumber: args.referenceNumber,
      sections: args.sections,
      signatory: args.signatory || "La Direction de l'Établissement",
    });

    const caption = `📝 <b>Document Word (.docx) Officiel</b>
━━━━━━━━━━━━━━━━━━━━━━
📄 Titre : <b>${args.title}</b>
🏫 Établissement : <b>${schoolName}</b>
${args.recipient ? `👤 Destinataire : <i>${args.recipient}</i>\n` : ""}
<i>Fichier Word modifiable certifié SnapSchool</i>`;

    await sendTelegramDocument(context.chatId, buffer, filename, {
      caption,
      parse_mode: "HTML",
    });

    return {
      success: true,
      message: `📝 <b>Document Word (.docx) généré et envoyé !</b>\n\nLe fichier <code>${filename}</code> est disponible au téléchargement dans ce chat. Vous pouvez l'ouvrir et l'éditer directement dans Microsoft Word ou Google Docs.`,
      summary: `Document Word généré : ${filename}`,
      data: { filename },
    };
  } catch (err: any) {
    console.error("[generateWordDocumentTool] Error:", err);
    return {
      success: false,
      message: `Erreur lors de la génération du document Word : ${err.message || String(err)}`,
      summary: "Échec document Word",
    };
  }
}


