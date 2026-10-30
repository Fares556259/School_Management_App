import { schoolDate, schoolDayRange, schoolMonth, tuitionBalance, roundMoney } from "@/lib/agent/dataAccuracy";
import prisma from "@/lib/prisma";
import { resolveClassByName } from "./classResolver";
import { buildNameSearchConditions, cleanHonorifics } from "./nameSearch";
import { rankStudentMatch } from "./entityResolvers";
import { MONTHS, formatMonthFrench } from "@/lib/dateUtils";
import { computeTeacherPaymentStatus } from "@/lib/payrollUtils";

export interface ToolContext {
  schoolId: string;
  adminId: string;
  adminName: string;
  language: string;
  chatId?: string;
}

/**
 * Tool: get_students
 * Retrieves students filtered by query, class, or status with multi-tenant isolation.
 */
export async function getStudentsTool(
  args: {
    query?: string;
    className?: string;
    limit?: number;
    offset?: number;
  },
  context: ToolContext
) {
  const limit = Math.max(1, Math.min(Number.isInteger(args.limit) ? args.limit! : 100, 100));
  const offset = Math.max(0, Number.isInteger(args.offset) ? args.offset! : 0);
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.className) {
    const matched = await resolveClassByName(context.schoolId, args.className);
    if (matched) {
      where.classId = matched.id;
    } else {
      throw new Error(`Classe « ${args.className} » introuvable ou ambiguë. Précisez son nom exact.`);
    }
  }

  if (args.query) {
    const q = args.query.trim();
    const nameConds = buildNameSearchConditions(q);
    where.OR = [
      ...nameConds,
      { username: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      {
        parent: {
          OR: nameConds,
        },
      },
    ];
  }

  const [totalCount, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        surname: true,
        phone: true,
        customTuition: true,
        class: {
          select: { id: true, name: true },
        },
        level: {
          select: { level: true, tuitionFee: true },
        },
        parent: {
          select: { name: true, surname: true, phone: true },
        },
      },
    }),
  ]);

  const sortedStudents = args.query
    ? [...students].sort((a, b) => {
        const scoreA = rankStudentMatch(a, args.query!, args.className);
        const scoreB = rankStudentMatch(b, args.query!, args.className);
        return scoreB - scoreA;
      })
    : students;

  const topCandidate = sortedStudents.length > 0 ? sortedStudents[0] : null;
  const topScore = topCandidate && args.query ? rankStudentMatch(topCandidate, args.query, args.className) : 0;
  const secondScore = sortedStudents.length > 1 && args.query ? rankStudentMatch(sortedStudents[1], args.query, args.className) : 0;

  const exactMatch = topCandidate && topScore >= 900 && (sortedStudents.length === 1 || topScore > secondScore)
    ? {
        fullName: `${topCandidate.name} ${topCandidate.surname}`,
        class: topCandidate.class?.name || "Sans classe",
        parent: topCandidate.parent ? `${topCandidate.parent.name} ${topCandidate.parent.surname} (${topCandidate.parent.phone})` : null,
        tuitionFee: `${topCandidate.customTuition ?? topCandidate.level?.tuitionFee ?? 450} DT`,
      }
    : null;

  return {
    total: totalCount,
    classId: where.classId || null,
    returned: sortedStudents.length,
    offset,
    hasMore: offset + sortedStudents.length < totalCount,
    nextOffset: offset + sortedStudents.length < totalCount ? offset + sortedStudents.length : null,
    source: "school_database",
    fetchedAt: new Date().toISOString(),
    filters: { className: args.className || null, query: args.query || null },
    formattedText: `**Élèves${args.className ? ` — classe ${args.className}` : ""} : ${totalCount} au total**\n\n` + sortedStudents.map((student,index) => `${offset+index+1}. **${student.name} ${student.surname}** — ${student.class?.name || "Sans classe"}`).join("\n") + `\n\n**${sortedStudents.length} affiché(s) sur ${totalCount}**${offset+sortedStudents.length<totalCount ? " — dites « page suivante » pour continuer." : " — liste complète pour ce filtre, vérifiée en base."}`,
    exactMatch,
    students: sortedStudents.map((s) => ({
      fullName: `${s.name} ${s.surname}`,
      class: s.class?.name || "Sans classe",
      tuitionFee: `${s.customTuition ?? s.level?.tuitionFee ?? 450} DT`,
      parent: s.parent ? `${s.parent.name} ${s.parent.surname} (${s.parent.phone})` : null,
    })),
  };
}

/**
 * Tool: get_attendance
 * Query attendance for a specific date (or today), class, or status (e.g. absent).
 */
export async function getAttendanceTool(
  args: { date?: string; className?: string; status?: "ABSENT" | "PRESENT" | "LATE" },
  context: ToolContext
) {
  const date = args.date || schoolDate();
  const day = schoolDayRange(date);
  let targetClass = null;
  if (args.className) {
    targetClass = await resolveClassByName(context.schoolId, args.className);
    if (!targetClass) throw new Error(`Classe « ${args.className} » introuvable ou ambiguë.`);
  }
  const where: any = { schoolId: context.schoolId, date: day, student: { schoolId: context.schoolId, ...(targetClass ? { classId: targetClass.id } : {}) } };
  const [totalEnrolled, allStatuses, records] = await Promise.all([
    prisma.student.count({ where: { schoolId: context.schoolId, ...(targetClass ? { classId: targetClass.id } : {}) } }),
    prisma.attendance.groupBy({ by: ["studentId", "status"], where, _count: { _all: true } }),
    prisma.attendance.findMany({
      where: { ...where, ...(args.status ? { status: args.status } : { status: { in: ["ABSENT", "LATE"] } }) },
      take: 100, orderBy: [{ date: "desc" }, { id: "asc" }],
      select: { id: true, status: true, note: true, date: true,
        student: { select: { id: true, name: true, surname: true, class: { select: { name: true } }, parent: { select: { phone: true, name: true } } } },
        lesson: { select: { name: true, subject: { select: { name: true } } } },
      },
    }),
  ]);
  const students = new Map<string, string>();
  const priority: Record<string,number> = { PRESENT: 1, LATE: 2, ABSENT: 3 };
  for (const row of allStatuses) if ((priority[row.status] || 0) > (priority[students.get(row.studentId) || ""] || 0)) students.set(row.studentId,row.status);
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0 };
  for (const status of students.values()) counts[status as keyof typeof counts]++;
  const unrecordedCount = Math.max(0,totalEnrolled-students.size);
  const attendanceRate = students.size ? `${Math.round((counts.PRESENT+counts.LATE)/students.size*100)}%` : "Non disponible";
  const mapStudent = (record: any) => ({ name: `${record.student.name} ${record.student.surname}`, class: record.student.class?.name || "Sans classe", lesson: record.lesson?.name || record.lesson?.subject?.name || "Séance", parentPhone: record.student.parent?.phone || null, note: record.note || null });
  const detailsCount = allStatuses.filter(row => args.status ? row.status === args.status : row.status !== "PRESENT").reduce((sum,row)=>sum+row._count._all,0);
  const formattedText = `**Présences — ${date}${targetClass ? ` · ${targetClass.name}` : ""}**\n\n` +
    `• Élèves inscrits : **${totalEnrolled}**\n• Présents sans retard : **${counts.PRESENT}**\n• Absents signalés : **${counts.ABSENT}**\n• Retards signalés : **${counts.LATE}**\n• Sans appel enregistré : **${unrecordedCount}**\n• Présence parmi les élèves avec appel : **${attendanceRate}**\n\n` +
    "Un élève est compté une seule fois, même avec plusieurs séances. Une absence dans une séance prime sur un retard ou une présence.\n" +
    (records.length ? "\n"+records.map(record=>`• ${mapStudent(record).name} — ${record.status} (${mapStudent(record).lesson})`).join("\n") : "\nAucun détail correspondant.") +
    (detailsCount>records.length ? `\n\n${records.length} enregistrements affichés sur ${detailsCount}. Les totaux incluent tous les appels.` : "");
  return { date, className: targetClass?.name || "Toute l’école", totalEnrolled, source: "school_database", fetchedAt: new Date().toISOString(),
    summary: { totalInscrits: totalEnrolled, presentCount: counts.PRESENT, absentCount: counts.ABSENT, lateCount: counts.LATE, unrecordedCount, attendanceRate },
    absentStudents: records.filter(record=>record.status==="ABSENT").map(mapStudent), lateStudents: records.filter(record=>record.status==="LATE").map(mapStudent),
    returned: records.length, totalRecords: detailsCount, hasMore: detailsCount>records.length, formattedText,
  };
}

/**
 * Tool: get_payments
 * Query tuition payment status for a specific month/year.
 * Authoritative: checks all enrolled students to identify fully paid, partial (reliquats), and completely unpaid (0 DT).
 */
export async function getPaymentsTool(
  args: {
    month?: number; // 1-12
    year?: number;
    status?: "PENDING" | "PAID" | "PARTIAL" | "OVERDUE" | "UNPAID";
    className?: string;
    studentName?: string;
    parentName?: string;
  },
  context: ToolContext
) {
  const now = new Date();
  const { month, year } = schoolMonth(args.month, args.year);

  // 1. Build filter for students
  const studentWhere: any = {
    schoolId: context.schoolId,
  };

  if (args.className) {
    const matched = await resolveClassByName(context.schoolId, args.className);
    if (matched) {
      studentWhere.classId = matched.id;
    } else {
      throw new Error(`Classe « ${args.className} » introuvable ou ambiguë. Précisez son nom exact.`);
    }
  }

  if (args.studentName) {
    const q = args.studentName.trim();
    studentWhere.OR = buildNameSearchConditions(q);
  }

  if (args.parentName) {
    const parentQuery = args.parentName.trim();
    const phoneMatch = parentQuery.match(/(?:\+216\s*)?(\d{6,12})/);
    const phoneDigits = phoneMatch ? phoneMatch[1] : null;
    const nameWithoutPhone = cleanHonorifics(
      parentQuery
        .replace(/(?:\+216)?\s*\d{6,12}/g, " ")
        .replace(/\([^)]*\)/g, " ")
        .trim()
    ).trim();

    const parentConds: any[] = [];
    if (nameWithoutPhone) {
      parentConds.push(...buildNameSearchConditions(nameWithoutPhone));
    }
    if (phoneDigits) {
      parentConds.push({ phone: { contains: phoneDigits } });
    }

    if (parentConds.length > 0) {
      studentWhere.parent = {
        OR: parentConds,
      };
    }
  }

  // 2. Query all enrolled students with their class, level, parent, and payments for the target month
  const students = await prisma.student.findMany({
    where: studentWhere,
    select: {
      id: true,
      name: true,
      surname: true,
      customTuition: true,
      class: { select: { id: true, name: true } },
      level: { select: { id: true, level: true, tuitionFee: true } },
      parent: { select: { id: true, name: true, surname: true, phone: true } },
      payments: {
        where: {
          month,
          year,
          userType: { equals: "STUDENT", mode: "insensitive" },
        },
        select: {
          id: true,
          amount: true,
          status: true,
          month: true,
          year: true,
          paidAt: true,
          deferredAmount: true,
        },
      },
    },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  });

  const paidStudents: any[] = [];
  const partialStudents: any[] = [];
  const unpaidStudents: any[] = [];

  let totalCollected = 0;
  let totalOutstanding = 0;

  for (const s of students) {
    const payment = s.payments?.[0];
    const balance = tuitionBalance(s, payment);
    const tuitionFee = balance.fee;
    const baseInfo = {
      studentId: s.id,
      studentName: `${s.name} ${s.surname}`.trim(),
      class: s.class?.name || "Sans classe",
      tuitionFee,
      parentName: s.parent ? `${s.parent.name} ${s.parent.surname}`.trim() : "Non renseigné",
      parentPhone: s.parent?.phone || null,
      month,
      year,
      feePeriod: `${MONTHS[month - 1] || month} ${year}`,
    };

    const row = { ...baseInfo, paymentId: payment?.id, paidAmount: balance.received, dueAmount: balance.due,
      paidAt: payment?.paidAt ? payment.paidAt.toISOString().split("T")[0] : null };
    if (balance.due === 0) paidStudents.push({ ...row, status: "PAID" });
    else if (balance.received > 0) partialStudents.push({ ...row, status: "PARTIAL" });
    else unpaidStudents.push({ ...row, status: payment?.status || "UNPAID" });
    totalCollected += balance.received;
    totalOutstanding += balance.due;
  }

  totalCollected = roundMoney(totalCollected);
  totalOutstanding = roundMoney(totalOutstanding);
  const requestedStatus = (args.status || "").toUpperCase();
  let returnRecords: any[] = [];

  if (requestedStatus === "PAID") {
    returnRecords = paidStudents;
  } else if (requestedStatus === "PARTIAL") {
    returnRecords = partialStudents;
  } else if (requestedStatus === "UNPAID" || requestedStatus === "PENDING" || requestedStatus === "OVERDUE") {
    returnRecords = [...unpaidStudents, ...partialStudents];
  } else {
    // Default when general query: list those who owe money (unpaid + partials)
    returnRecords = [...unpaidStudents, ...partialStudents];
  }

  const feePeriodStr = `${MONTHS[month - 1] || month} ${year}`;
  const feePeriodFr = formatMonthFrench(feePeriodStr);
  const unpaidTotal = unpaidStudents.reduce((acc, u) => acc + u.dueAmount, 0);
  const partialRemaining = partialStudents.reduce((acc, p) => acc + p.dueAmount, 0);
  const totalOwingCount = unpaidStudents.length + partialStudents.length;

  let formattedText: string;

  if (args.studentName) {
    if (students.length === 0) {
      formattedText = `🔍 <b>SNAPSCHOOL │ RECHERCHE ÉLÈVE</b>\n━━━━━━━━━━━━━━━━━━━━━━\nAucun élève trouvé correspondant à "<b>${args.studentName}</b>" pour le mois de <b>${feePeriodFr}</b>.`;
    } else {
      const studentCards = students.map((s) => {
        const payment = s.payments?.[0];
        const fee = tuitionBalance(s).fee;
        const balance = tuitionBalance(s,payment);
        const paidAmt = balance.received;
        const dueAmt = balance.due;
        const statusBadge = dueAmt === 0 ? "🟢 À JOUR (Soldé)" : paidAmt > 0 ? `🟡 PARTIEL (Reste ${dueAmt} DT)` : "🔴 NON PAYÉ (0 DT)";
        const parentPhoneFormatted = s.parent?.phone ? `\n  └ 📞 +216 ${s.parent.phone.replace(/^\+?216\s*/, "")}` : "";
        const parentInfo = s.parent ? `👤 ${s.parent.name} ${s.parent.surname}${parentPhoneFormatted}` : "Non renseigné";

        return `👤 <b>${s.name} ${s.surname}</b> • Classe <code>${s.class?.name || "Sans classe"}</code>\n• Statut : ${statusBadge}\n• Versé : <code>${paidAmt} DT</code> / Tarif : <code>${fee} DT</code>\n• Reste dû : <code>${dueAmt} DT</code>\n• Tuteur : ${parentInfo}`;
      }).join("\n\n");

      formattedText = `🏛️ <b>SNAPSCHOOL │ SCOLARITÉ ÉLÈVE</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Mois : <b>${feePeriodFr}</b>\n\n${studentCards}\n\n<blockquote>💡 <b>Hnia :</b> Pour enregistrer un paiement, dites par exemple : <i>"enregistre paiement de ${students[0].name} ${students[0].surname}"</i>.</blockquote>`;
    }
  } else if (requestedStatus === "PAID") {
    const paidList = paidStudents.length === 0
      ? "<i>Aucun élève n'a encore payé pour ce mois.</i>"
      : paidStudents.map((p) => {
          const parentPhone = p.parentPhone ? ` • 📞 +216 ${p.parentPhone.replace(/^\+?216\s*/, "")}` : "";
          return `• 🟢 <b>${p.studentName}</b> (<code>${p.class}</code>) — <code>${p.paidAmount} DT</code>\n  👤 Tuteur : ${p.parentName}${parentPhone}`;
        }).join("\n");

    formattedText = `🏛️ <b>SNAPSCHOOL │ ÉLÈVES AYANT PAYÉ</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Mois : <b>${feePeriodFr}</b>${args.className ? ` • Classe : <code>${args.className}</code>` : ""}\n\n🟢 <b>${paidStudents.length}</b> élève(s) à jour sur <b>${students.length}</b>\n💰 Total encaissé : <code>+${totalCollected} DT</code>\n\n${paidList}\n\n<blockquote>💡 <b>Hnia :</b> ${paidStudents.length} élèves sont en règle pour ${feePeriodFr}. Il reste ${totalOwingCount} élève(s) avec un solde dû (${totalOutstanding} DT).</blockquote>`;
  } else if (requestedStatus === "PARTIAL") {
    const partialList = partialStudents.length === 0
      ? "<i>Aucun paiement partiel (reliquat) pour ce mois.</i>"
      : partialStudents.map((p) => {
          const parentPhone = p.parentPhone ? ` • 📞 +216 ${p.parentPhone.replace(/^\+?216\s*/, "")}` : "";
          return `• 🟡 <b>${p.studentName}</b> (<code>${p.class}</code>) — Reste <code>${p.dueAmount} DT</code> (Payé <code>${p.paidAmount} DT</code> / <code>${p.tuitionFee} DT</code>)\n  👤 Tuteur : ${p.parentName}${parentPhone}`;
        }).join("\n");

    formattedText = `🏛️ <b>SNAPSCHOOL │ PAIEMENTS PARTIELS (RELIQUATS)</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Mois : <b>${feePeriodFr}</b>${args.className ? ` • Classe : <code>${args.className}</code>` : ""}\n\n🟡 <b>${partialStudents.length}</b> élève(s) avec reliquat sur <b>${students.length}</b>\n💰 Total reliquats à recouvrer : <code>${partialRemaining} DT</code>\n\n${partialList}\n\n<blockquote>💡 <b>Hnia :</b> Pour solder l'un de ces reliquats, dites simplement : <i>"enregistre le solde restant de [nom de l'élève]"</i>.</blockquote>`;
  } else {
    // UNPAID, PENDING, OVERDUE or general inquiry (e.g. "qui n'a pas payé ce mois")
    const sections: string[] = [];

    if (totalOwingCount === 0) {
      sections.push(`✅ <b>Excellente nouvelle !</b> Tous les ${students.length} élèves sont 100% à jour de paiement pour <b>${feePeriodFr}</b>.`);
    } else {
      if (unpaidStudents.length > 0) {
        const listUnpaid = unpaidStudents.map((u) => {
          const parentPhone = u.parentPhone ? ` • 📞 +216 ${u.parentPhone.replace(/^\+?216\s*/, "")}` : "";
          return `• <b>${u.studentName}</b> (<code>${u.class}</code>) — <code>${u.dueAmount} DT</code>\n  👤 Tuteur : ${u.parentName}${parentPhone}`;
        }).join("\n");
        sections.push(`🔴 <b>Totalement impayés (0 DT versés) — ${unpaidStudents.length} élève(s) :</b>\n${listUnpaid}`);
      }

      if (partialStudents.length > 0) {
        const listPartial = partialStudents.map((p) => {
          const parentPhone = p.parentPhone ? ` • 📞 +216 ${p.parentPhone.replace(/^\+?216\s*/, "")}` : "";
          return `• <b>${p.studentName}</b> (<code>${p.class}</code>) — Reste <code>${p.dueAmount} DT</code> (Payé <code>${p.paidAmount} DT</code> / <code>${p.tuitionFee} DT</code>)\n  👤 Tuteur : ${p.parentName}${parentPhone}`;
        }).join("\n");
        sections.push(`🟡 <b>Paiements partiels (reliquats restants) — ${partialStudents.length} élève(s) :</b>\n${listPartial}`);
      }
    }

    formattedText = `🏛️ <b>SNAPSCHOOL │ IMPAYÉS DU MOIS</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Mois : <b>${feePeriodFr}</b>${args.className ? ` • Classe : <code>${args.className}</code>` : ""}\n\n🟢 <b>${paidStudents.length}</b> Payés │ 🔴 <b>${unpaidStudents.length}</b> Impayés │ 🟡 <b>${partialStudents.length}</b> Partiels\n📊 <b>${totalOwingCount}</b> élèves avec solde dû sur <b>${students.length}</b>\n\n${sections.join("\n\n")}\n\n━━━━━━━━━━━━━━━━━━━━━━\n💰 <b>Total restant dû :</b> <code>${totalOutstanding} DT</code> (dont <code>${unpaidTotal} DT</code> d'impayés et <code>${partialRemaining} DT</code> de reliquats)\n\n<blockquote>💡 <b>Hnia :</b> ${totalOwingCount} élève(s) ont un solde débiteur ce mois-ci. Vous pouvez relancer leurs tuteurs ou enregistrer un règlement directement par message.</blockquote>`;
  }

  return {
    month,
    year,
    totalOutstanding,
    unpaidCount: totalOwingCount,
    returned: returnRecords.length,
    source: "school_database",
    fetchedAt: new Date().toISOString(),
    feePeriod: `${MONTHS[month - 1] || month} ${year}`,
    feePeriodFrench: formatMonthFrench(`${MONTHS[month - 1] || month} ${year}`),
    totalStudents: students.length,
    overview: {
      totalEnrolledStudents: students.length,
      paidCount: paidStudents.length,
      paidAmount: totalCollected,
      unpaidCount: unpaidStudents.length,
      unpaidAmount: unpaidStudents.reduce((acc, u) => acc + u.dueAmount, 0),
      partialCount: partialStudents.length,
      partialRemainingAmount: partialStudents.reduce((acc, p) => acc + p.dueAmount, 0),
      totalStudentsOwingMoney: unpaidStudents.length + partialStudents.length,
      totalAmountDue: totalOutstanding,
    },
    // Explicit sections so the assistant NEVER misses anyone
    summaryHeadline: `${paidStudents.length} payés (${totalCollected} DT), ${partialStudents.length} partiels (${partialStudents.reduce((acc, p) => acc + p.dueAmount, 0)} DT restants), et ${unpaidStudents.length} non payés (${unpaidStudents.reduce((acc, u) => acc + u.dueAmount, 0)} DT restants). Total avec solde dû : ${unpaidStudents.length + partialStudents.length} élèves sur ${students.length}.`,
    completelyUnpaid: {
      count: unpaidStudents.length,
      description: "Élèves n'ayant encore rien versé (0 DT)",
      students: unpaidStudents.map((u) => ({
        studentName: u.studentName,
        class: u.class,
        tariff: `${u.tuitionFee} DT`,
        parentName: u.parentName,
        parentPhone: u.parentPhone,
      })),
    },
    partiallyPaid: {
      count: partialStudents.length,
      description: "Élèves ayant versé un acompte avec reliquat restant",
      students: partialStudents.map((p) => ({
        studentName: p.studentName,
        class: p.class,
        paid: `${p.paidAmount} DT`,
        remainingDue: `${p.dueAmount} DT`,
        tariff: `${p.tuitionFee} DT`,
        parentName: p.parentName,
        parentPhone: p.parentPhone,
      })),
    },
    records: returnRecords,
    formattedText,
  };
}

/**
 * Tool: get_financial_summary
 * Overall school finances for month/year: revenue, expenses, profit margin, total outstanding tuition.
 */
export async function getFinancialSummaryTool(
  args: {
    month?: number;
    year?: number;
  },
  context: ToolContext
) {
  const now = new Date();
  const { month, year } = schoolMonth(args.month, args.year);

  const { gte: startDate, lt: endDate } = schoolMonth(month,year).range;

  const [incomes, expenses, allStudents] = await Promise.all([
    prisma.income.aggregate({
      where: {
        schoolId: context.schoolId,
        date: { gte: startDate, lt: endDate },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.expense.aggregate({
      where: {
        schoolId: context.schoolId,
        date: { gte: startDate, lt: endDate },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.student.findMany({
      where: { schoolId: context.schoolId },
      select: {
        id: true,
        customTuition: true,
        level: { select: { tuitionFee: true } },
        payments: {
          where: { month, year, userType: "STUDENT" },
          select: { amount: true, status: true, deferredAmount: true },
        },
      },
    }),
  ]);

  const totalIncome = incomes._sum.amount || 0;
  const totalExpense = expenses._sum.amount || 0;
  const netProfit = totalIncome - totalExpense;

  let unpaidTuition = 0;
  let unpaidStudentsCount = 0;

  for (const student of allStudents) {
    const due = tuitionBalance(student,student.payments?.[0]).due;
    unpaidTuition += due;
    if (due > 0) unpaidStudentsCount++;
  }
  unpaidTuition = roundMoney(unpaidTuition);

  // Top expense categories
  const expenseCategories = await prisma.expense.groupBy({
    by: ["category"],
    where: {
      schoolId: context.schoolId,
      date: { gte: startDate, lt: endDate },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 5,
  });

  const periodFrench = formatMonthFrench(`${MONTHS[month - 1]} ${year}`);
  const marginPercentage = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  const topExpensesFormatted = expenseCategories.length > 0
    ? `\n\n📊 <b>Principales dépenses :</b>\n` + expenseCategories.map((c) => `• ${c.category} : <code>${c._sum.amount || 0} DT</code>`).join("\n")
    : "";

  const formattedText = `🏛️ <b>SNAPSCHOOL │ BILAN FINANCIER GLOBAL</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Mois : <b>${periodFrench}</b>\n\n💰 <b>Recettes encaissées :</b> <code>+${totalIncome} DT</code>\n💸 <b>Dépenses décaissées :</b> <code>-${totalExpense} DT</code>\n📈 <b>Bénéfice Net :</b> <code>${netProfit >= 0 ? "+" : ""}${netProfit} DT</code> (Marge : <code>${marginPercentage}%</code>)\n⏳ <b>Impayés de scolarité :</b> <code>${unpaidTuition} DT</code> (${unpaidStudentsCount} élève(s))${topExpensesFormatted}\n\n<blockquote>💡 <b>Hnia :</b> ${netProfit >= 0 ? `La trésorerie du mois est positive (+${netProfit} DT). Poursuivez le recouvrement des ${unpaidTuition} DT d'impayés.` : `Attention : les dépenses dépassent les recettes ce mois-ci. Priorité au recouvrement des ${unpaidTuition} DT d'impayés.`}</blockquote>`;

  return {
    period: `${month}/${year}`,
    periodFrench,
    source: "school_database",
    fetchedAt: new Date().toISOString(),
    incomeCount: incomes._count.id,
    totalIncome,
    totalExpense,
    netProfit,
    marginPercentage,
    unpaidTuition,
    unpaidStudentsCount,
    topExpenses: expenseCategories.map((c) => ({
      category: c.category,
      amount: c._sum.amount || 0,
    })),
    formattedText,
  };
}

/**
 * Tool: get_school_stats
 * Returns the exact, live entity counts for the school directory directly from PostgreSQL:
 * teachers, parents, students, staff, and classes.
 */
export async function getSchoolStatsTool(
  _args: Record<string, any>,
  context: ToolContext
) {
  const [teachers, parents, students, staff, classes] = await Promise.all([
    prisma.teacher.count({ where: { schoolId: context.schoolId } }),
    prisma.parent.count({ where: { schoolId: context.schoolId } }),
    prisma.student.count({ where: { schoolId: context.schoolId } }),
    prisma.staff.count({ where: { schoolId: context.schoolId } }),
    prisma.class.count({ where: { schoolId: context.schoolId } }),
  ]);

  const formattedText = `🏛️ <b>SNAPSCHOOL │ EFFECTIFS DE L'ÉTABLISSEMENT</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👥 <b>Effectifs réels enregistrés en base de données :</b>\n\n• 👨‍🏫 <b>Enseignants :</b> <code>${teachers}</code>\n• 👨‍👩‍👧‍👦 <b>Parents d'élèves :</b> <code>${parents}</code>\n• 🎓 <b>Élèves inscrits :</b> <code>${students}</code>\n• 💼 <b>Personnel (Staff) :</b> <code>${staff}</code>\n• 🏫 <b>Classes actives :</b> <code>${classes}</code>\n\n━━━━━━━━━━━━━━━━━━━━━━\n<blockquote>💡 <b>Hnia :</b> Effectifs consultés dans les dossiers de cet établissement.</blockquote>`;

  return {
    teachers,
    parents,
    students,
    staff,
    classes,
    formattedText,
  };
}

/**
 * Tool: get_teachers
 * List teachers, their subjects, and assigned classes with strict database accuracy.
 */
export async function getTeachersTool(
  args: {
    query?: string;
    subjectName?: string;
    month?: number;
    year?: number;
  },
  context: ToolContext
) {
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.query) {
    const q = args.query.trim();
    where.OR = buildNameSearchConditions(q);
  }

  if (args.subjectName) {
    where.subjects = {
      some: {
        name: { contains: args.subjectName.trim(), mode: "insensitive" },
      },
    };
  }

  const now = new Date();
  const targetMonth = args.month ? Number(args.month) : (now.getMonth() + 1);
  const targetYear = args.year ? Number(args.year) : now.getFullYear();
  const targetMonthName = MONTHS[targetMonth - 1] || `Mois ${targetMonth}`;

  const [totalCount, teachers] = await Promise.all([
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        surname: true,
        phone: true,
        salary: true,
        hourlyRate: true,
        hoursPerMonth: true,
        subjects: { select: { id: true, name: true } },
        classes: { select: { id: true, name: true } },
        payments: {
          where: { schoolId: context.schoolId, month: targetMonth, year: targetYear, userType: { equals: "TEACHER", mode: "insensitive" } },
          select: { id: true, amount: true, status: true, missedHours: true, paidAt: true, month: true, year: true },
        },
      },
    }),
  ]);

  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;

  const teacherRows = teachers.map((t) => {
    const calc = computeTeacherPaymentStatus(t, targetMonth, targetYear);
    const { isPaid, isPartial, isUnpaid, remaining, netDue, amountPaid, baseSalary, effectiveRate: rate, missedHours, deduction } = calc;

    if (isPaid) paidCount++;
    else if (isPartial) partialCount++;
    else unpaidCount++;

    let monthlyStatus = "Non payé 🔴";
    if (isPaid) {
      monthlyStatus = `Soldé (${amountPaid} DT) ✅`;
    } else if (isPartial) {
      monthlyStatus = `Avance : ${amountPaid} DT (Reste net : ${remaining} DT) 🟡`;
    }

    return {
      name: `${t.name} ${t.surname}`,
      phone: t.phone || "Non renseigné",
      subjects: t.subjects.map((s) => s.name).join(", ") || "Aucune",
      supervisedClasses: t.classes.map((c) => c.name).join(", ") || "Aucune",
      salary: `${baseSalary} DT`,
      hourlyRate: `${rate} DT/h`,
      hoursPerMonth: t.hoursPerMonth ? `${t.hoursPerMonth}h` : "Non fixé",
      paymentStatus: isPaid ? "PAID" : isPartial ? "PARTIAL" : "UNPAID",
      currentMonthPayroll: {
        targetMonth: `${targetMonthName} ${targetYear}`,
        status: monthlyStatus,
        baseSalary: `${baseSalary} DT`,
        missedHours: missedHours > 0 ? `${missedHours}h (-${deduction} DT)` : "0h",
        amountPaid: `${amountPaid} DT`,
        netRemainingDue: `${remaining} DT`,
      },
    };
  });

  let formattedText: string;
  if (teacherRows.length === 1 && args.query) {
    const t = teacherRows[0];
    const phoneFormatted = t.phone && t.phone !== "Non renseigné" ? `\n  └ 📞 +216 ${t.phone.replace(/^\+?216\s*/, "")}` : "";
    formattedText = `🏛️ <b>SNAPSCHOOL │ FICHE ENSEIGNANT</b>\n━━━━━━━━━━━━━━━━━━━━━━\n👨‍🏫 <b>${t.name}</b>${phoneFormatted}\n• 📚 Matières : <code>${t.subjects}</code>\n• 🏫 Classes : <code>${t.supervisedClasses}</code>\n• 💰 Salaire de base : <code>${t.salary}</code> (Taux : <code>${t.hourlyRate}</code>, Volume : <code>${t.hoursPerMonth}</code>)\n\n📅 <b>Situation paie (${targetMonthName} ${targetYear}) :</b>\n• Statut : ${t.currentMonthPayroll.status}\n• Heures d'absence : <code>${t.currentMonthPayroll.missedHours}</code>\n• Montant versé : <code>${t.currentMonthPayroll.amountPaid}</code>\n• Reste net dû : <code>${t.currentMonthPayroll.netRemainingDue}</code>\n\n<blockquote>💡 <b>Hnia :</b> Pour verser un acompte ou solder le salaire, dites : <i>"verse une avance de 100 DT à ${t.name}"</i>.</blockquote>`;
  } else if (teacherRows.length === 0) {
    formattedText = `🏛️ <b>SNAPSCHOOL │ ENSEIGNANTS</b>\n━━━━━━━━━━━━━━━━━━━━━━\n<i>Aucun enseignant trouvé pour cette recherche.</i>`;
  } else {
    const paidTeachers = teacherRows.filter((r) => r.paymentStatus === "PAID");
    const partialTeachers = teacherRows.filter((r) => r.paymentStatus === "PARTIAL");
    const unpaidTeachers = teacherRows.filter((r) => r.paymentStatus === "UNPAID");

    const sections: string[] = [];

    if (unpaidTeachers.length > 0) {
      const list = unpaidTeachers
        .map((t) => `• <b>${t.name}</b> — <code>${t.salary}</code>${t.phone !== "Non renseigné" ? ` (📞 +216 ${t.phone.replace(/^\+?216\s*/, "")})` : ""}`)
        .join("\n");
      sections.push(`🔴 <b>Non payés (0 DT versés) — ${unpaidTeachers.length} enseignant(s) :</b>\n${list}`);
    }

    if (partialTeachers.length > 0) {
      const list = partialTeachers
        .map(
          (t) =>
            `• <b>${t.name}</b> — Avance : <code>${t.currentMonthPayroll.amountPaid}</code> (Reste dû : <code>${t.currentMonthPayroll.netRemainingDue}</code>)`
        )
        .join("\n");
      sections.push(`🟡 <b>Avances en cours — ${partialTeachers.length} enseignant(s) :</b>\n${list}`);
    }

    if (paidTeachers.length > 0) {
      const list = paidTeachers
        .map((t) => `• <b>${t.name}</b> — <code>${t.currentMonthPayroll.amountPaid}</code> (Soldé ✅)`)
        .join("\n");
      sections.push(`🟢 <b>Soldés — ${paidTeachers.length} enseignant(s) :</b>\n${list}`);
    }

    formattedText = `🏛️ <b>SNAPSCHOOL │ PAIE ENSEIGNANTS</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Mois : <b>${targetMonthName} ${targetYear}</b>\n\n🟢 <b>${paidCount}</b> Payés │ 🟡 <b>${partialCount}</b> Avances │ 🔴 <b>${unpaidCount}</b> Non payés\n📊 <b>${totalCount}</b> enseignants au total en base\n\n${sections.join("\n\n")}\n\n<blockquote>💡 <b>Hnia :</b> Données issues directement de la base. Pour enregistrer une avance ou solder un enseignant, donnez-moi simplement son nom et le montant.</blockquote>`;
  }

  return {
    targetMonth: `${targetMonthName} ${targetYear}`,
    total: totalCount,
    summary: {
      total: totalCount,
      paidCount,
      partialCount,
      unpaidCount,
      breakdown: `${paidCount} Payés │ ${partialCount} Avances │ ${unpaidCount} Non payés sur ${totalCount} enseignants`,
    },
    teachers: teacherRows,
    formattedText,
  };
}

/**
 * Tool: get_morning_briefing
 * Gathers a 360° executive morning briefing for the school director:
 * - Today's timetable slots and load
 * - Unjustified absences from yesterday
 * - Partial recovery / promises due today
 * - Upcoming exams or tests scheduled today
 * - Active urgent announcements
 */
export async function getMorningBriefingTool(
  args: { date?: string },
  context: ToolContext
) {
  const targetDate = args.date ? new Date(args.date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Day of week enum
  const dayIndex = targetDate.getDay(); // 0 = Sunday, 1 = Monday...
  const dayEnumMap: Record<number, any> = {
    1: "MONDAY",
    2: "TUESDAY",
    3: "WEDNESDAY",
    4: "THURSDAY",
    5: "FRIDAY",
    6: "SATURDAY",
  };
  const todayEnum = dayEnumMap[dayIndex] || "MONDAY";

  // Yesterday
  const yesterdayStart = new Date(startOfDay);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(endOfDay);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

  const [
    timetableSlots,
    unjustifiedAbsencesYesterday,
    dueRecoveriesToday,
    urgentAnnouncements,
    totalEnrolled,
  ] = await Promise.all([
    // 1. Timetable slots for today
    prisma.timetableSlot.findMany({
      where: {
        schoolId: context.schoolId,
        day: todayEnum,
        isDraft: false,
      },
      orderBy: { startTime: "asc" },
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
        room: { select: { name: true } },
      },
    }),
    // 2. Unjustified absences from yesterday
    prisma.attendance.findMany({
      where: {
        schoolId: context.schoolId,
        date: { gte: yesterdayStart, lte: yesterdayEnd },
        status: "ABSENT",
        justificationStatus: { not: "APPROVED" },
      },
      include: {
        student: {
          select: {
            name: true,
            surname: true,
            class: { select: { name: true } },
            parent: { select: { phone: true, name: true } },
          },
        },
      },
      take: 10,
    }),
    // 3. Partial recoveries / promises due today
    prisma.payment.findMany({
      where: {
        schoolId: context.schoolId,
        status: "PARTIAL",
        deferredUntil: { lte: endOfDay },
      },
      include: {
        student: {
          select: {
            name: true,
            surname: true,
            class: { select: { name: true } },
            parent: { select: { phone: true } },
          },
        },
      },
      take: 10,
    }),
    // 4. Urgent announcements
    prisma.notice.findMany({
      where: {
        schoolId: context.schoolId,
        important: true,
      },
      orderBy: { date: "desc" },
      take: 3,
    }),
    // 5. Total enrolled students
    prisma.student.count({
      where: { schoolId: context.schoolId },
    }),
  ]);

  const dateStr = targetDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    date: dateStr,
    totalEnrolled,
    sessionsCountToday: timetableSlots.length,
    activeClassesCount: new Set(timetableSlots.map((s) => s.class?.name).filter(Boolean)).size,
    schedulePreview: timetableSlots.slice(0, 8).map((s) => ({
      time: `${s.startTime} - ${s.endTime}`,
      class: s.class?.name || "N/A",
      subject: s.subject?.name || "Cours",
      teacher: s.teacher ? `${s.teacher.name} ${s.teacher.surname}` : "Non assigné",
      room: s.room?.name || null,
    })),
    followUpsNeeded: {
      unjustifiedAbsencesYesterdayCount: unjustifiedAbsencesYesterday.length,
      unjustifiedAbsencesList: unjustifiedAbsencesYesterday.map((a) => ({
        student: `${a.student.name} ${a.student.surname}`,
        class: a.student.class?.name || "N/A",
        parentPhone: a.student.parent?.phone || null,
      })),
      recoveriesDueTodayCount: dueRecoveriesToday.length,
      recoveriesDueTodayList: dueRecoveriesToday.map((p) => ({
        student: p.student ? `${p.student.name} ${p.student.surname}` : "Élève",
        class: p.student?.class?.name || "N/A",
        dueAmount: `${p.deferredAmount || 0} DT`,
        parentPhone: p.student?.parent?.phone || null,
      })),
    },
    urgentNotices: urgentAnnouncements.map((n) => ({
      title: n.title,
      message: n.message.slice(0, 100),
    })),
  };
}

