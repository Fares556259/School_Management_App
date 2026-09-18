import prisma from "@/lib/prisma";
import { sendTelegramDocument } from "../telegram";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { createStudentTool } from "./academicTools";
import { resolveClassByName } from "./classResolver";
import {
  generateSchoolExcelReport,
  transformExcelWorkbook,
  getUserExcelBuffer,
  storeUserExcelBuffer,
  inspectExcelBuffer,
  loadWorkbookFromBuffer,
  applyExecutiveThemeToWorksheet,
  ExcelTransformOptions,
  SchoolExcelReportType,
} from "@/lib/excel/excelEngine";

export interface ExcelToolResult {
  success: boolean;
  message: string;
  summary: string;
  data?: any;
}

function cleanSubj(name?: string | null): string {
  if (!name) return "Matière";
  const parts = name.split("|").map((p) => p.trim());
  return parts[1] || parts[0] || name;
}

/**
 * Tool: export_excel_report
 * Generates an executive, styled .xlsx file from school data and delivers it to Telegram.
 */
export async function exportExcelReportTool(
  args: {
    reportType:
      | "unpaid_students"
      | "students_list"
      | "daily_cash"
      | "teachers_salaries"
      | "class_timetable"
      | "timetable"
      | "planning";
    month?: number;
    year?: number;
    className?: string;
    dateStr?: string;
  },
  context: ToolContext
): Promise<ExcelToolResult> {
  if (!context.chatId) {
    return {
      success: false,
      message: "Identifiant de chat Telegram manquant pour l'envoi du document.",
      summary: "Chat ID manquant",
    };
  }
  const chatId = context.chatId;

  try {
    const school = await prisma.school.findUnique({
      where: { id: context.schoolId },
      select: { name: true },
    });
    const schoolName = school?.name || "SnapSchool Academy";

    const now = new Date();
    const targetMonth = args.month || now.getMonth() + 1;
    const targetYear = args.year || now.getFullYear();

    if (args.reportType === "unpaid_students") {
      let classFilterId: number | undefined;
      if (args.className) {
        const cls = await resolveClassByName(context.schoolId, args.className);
        if (cls) classFilterId = cls.id;
      }

      const students = await prisma.student.findMany({
        where: {
          schoolId: context.schoolId,
          ...(classFilterId ? { classId: classFilterId } : {}),
        },
        include: {
          class: true,
          level: true,
          parent: true,
          payments: {
            where: {
              month: targetMonth,
              year: targetYear,
              userType: "STUDENT",
            },
          },
        },
        orderBy: [
          { class: { name: "asc" } },
          { surname: "asc" },
        ],
      });

      const unpaidList = students
        .map((st) => {
          const p = st.payments[0];
          const tuitionFee = st.customTuition || st.level?.tuitionFee || 450;
          const amountPaid = p?.amount || 0;
          const remainingDue =
            p?.status === "PAID"
              ? 0
              : p?.deferredAmount !== null && p?.deferredAmount !== undefined
              ? p.deferredAmount
              : Math.max(0, tuitionFee - amountPaid);

          let status = "Non payé";
          if (p?.status === "PAID" || remainingDue === 0) {
            status = "Soldé";
          } else if (p?.deferredUntil) {
            status = "Différé";
          } else if (p?.status === "PARTIAL" || amountPaid > 0) {
            status = "Partiel";
          } else if (p?.status === "OVERDUE") {
            status = "En retard";
          }

          return {
            studentName: `${st.name} ${st.surname}`,
            className: st.class?.name || "Non assignée",
            parentName: st.parent ? `${st.parent.name} ${st.parent.surname}` : "Non renseigné",
            parentPhone: st.parent?.phone || "Non renseigné",
            tuitionFee,
            amountPaid,
            remainingDue,
            status,
          };
        })
        .filter((item) => item.remainingDue > 0);

      if (unpaidList.length === 0) {
        return {
          success: true,
          message: `🎉 <b>Aucun impayé trouvé !</b>\nTous les élèves${args.className ? ` de la classe <b>${args.className}</b>` : ""} sont à jour de paiement pour le mois <b>${targetMonth}/${targetYear}</b>.`,
          summary: "Aucun impayé pour cette période.",
        };
      }

      const { buffer, filename } = await generateSchoolExcelReport({
        type: "UNPAID_STUDENTS",
        schoolName,
        data: unpaidList,
        options: { month: targetMonth, year: targetYear, className: args.className },
      });

      const totalDue = unpaidList.reduce((acc, curr) => acc + curr.remainingDue, 0);
      const caption = `📊 <b>Fichier Excel des Impayés généré</b>\n━━━━━━━━━━━━━━━━━━━━━━\n🏫 École : <b>${schoolName}</b>\n📅 Période : <code>Mois ${targetMonth}/${targetYear}</code>\n👥 Élèves concernés : <b>${unpaidList.length}</b>\n💰 Total restant dû : <code>${totalDue.toFixed(2)} DT</code>\n\n<i>Tableau stylisé et téléchargeable pour Excel & Google Sheets</i>`;

      await sendTelegramDocument(chatId, buffer, filename, {
        caption,
        parse_mode: "HTML",
      });

      // Cache this generated spreadsheet so admin can chain modifications if requested
      storeUserExcelBuffer(chatId, buffer, filename);

      return {
        success: true,
        message: `✅ Le fichier Excel <b>${filename}</b> a été généré et envoyé directement dans ce chat. Total restant dû : <b>${totalDue.toFixed(2)} DT</b> pour <b>${unpaidList.length} élèves</b>.`,
        summary: `Fichier Excel envoyé : ${filename} (${unpaidList.length} élèves, ${totalDue} DT)`,
        data: { filename, totalDue, count: unpaidList.length },
      };
    }

    if (args.reportType === "students_list") {
      let classFilterId: number | undefined;
      let matchedClassName = args.className;
      if (args.className) {
        const cls = await resolveClassByName(context.schoolId, args.className);
        if (cls) {
          classFilterId = cls.id;
          matchedClassName = cls.name;
        }
      }

      const students = await prisma.student.findMany({
        where: {
          schoolId: context.schoolId,
          ...(classFilterId ? { classId: classFilterId } : {}),
        },
        include: {
          class: true,
          level: true,
          parent: true,
        },
        orderBy: [
          { class: { name: "asc" } },
          { surname: "asc" },
        ],
      });

      const formattedStudents = students.map((st) => ({
        id: st.id,
        fullName: `${st.name} ${st.surname}`,
        className: st.class?.name || "Non assignée",
        parentName: st.parent ? `${st.parent.name} ${st.parent.surname}` : "Non renseigné",
        parentPhone: st.parent?.phone || "Non renseigné",
        birthday: st.birthday ? new Date(st.birthday).toLocaleDateString("fr-FR") : "-",
        tuitionFee: st.customTuition || st.level?.tuitionFee || 0,
      }));

      const { buffer, filename } = await generateSchoolExcelReport({
        type: "STUDENTS_LIST",
        schoolName,
        data: formattedStudents,
        options: { className: matchedClassName },
      });

      const caption = `📋 <b>Liste des Élèves (Excel)</b>\n━━━━━━━━━━━━━━━━━━━━━━\n🏫 École : <b>${schoolName}</b>\n👥 Effectif exporté : <b>${students.length} élèves</b>\n${matchedClassName ? `📚 Classe : <b>${matchedClassName}</b>\n` : ""}\n<i>Tableau officiel SnapSchool</i>`;

      await sendTelegramDocument(chatId, buffer, filename, {
        caption,
        parse_mode: "HTML",
      });

      storeUserExcelBuffer(chatId, buffer, filename);

      return {
        success: true,
        message: `✅ Le fichier Excel de l'effectif (${students.length} élèves) a été envoyé avec succès.`,
        summary: `Fichier Excel envoyé : ${filename} (${students.length} élèves)`,
      };
    }

    if (args.reportType === "daily_cash") {
      const dateStr = args.dateStr || new Date().toISOString().split("T")[0];
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

      const payments = await prisma.payment.findMany({
        where: {
          schoolId: context.schoolId,
          paidAt: { gte: startOfDay, lte: endOfDay },
          status: "PAID",
        },
        include: { student: true },
      });

      const expenses = await prisma.expense.findMany({
        where: {
          schoolId: context.schoolId,
          date: { gte: startOfDay, lte: endOfDay },
        },
      });

      const transactions: Array<{
        time: string;
        type: "RECETTE" | "DÉPENSE";
        title: string;
        party: string;
        method: string;
        amount: number;
      }> = [];

      payments.forEach((p) => {
        const time = p.paidAt ? new Date(p.paidAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "-";
        const party = p.student ? `${p.student.name} ${p.student.surname}` : "Élève";
        transactions.push({
          time,
          type: "RECETTE",
          title: `Frais scolarité mois ${p.month}`,
          party,
          method: "Espèces / Caisse",
          amount: p.amount,
        });
      });

      expenses.forEach((e) => {
        const time = new Date(e.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        transactions.push({
          time,
          type: "DÉPENSE",
          title: e.title,
          party: e.category || "Fournisseur / Divers",
          method: "Caisse",
          amount: e.amount,
        });
      });

      const { buffer, filename } = await generateSchoolExcelReport({
        type: "DAILY_CASH",
        schoolName,
        data: transactions,
        options: { dateStr },
      });

      const totalRecettes = payments.reduce((sum, p) => sum + p.amount, 0);
      const totalDepenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      const soldeNet = totalRecettes - totalDepenses;

      const caption = `💰 <b>Caisse du Jour Excel (${dateStr})</b>\n━━━━━━━━━━━━━━━━━━━━━━\n🟢 Entrées : <code>+${totalRecettes.toFixed(2)} DT</code>\n🔴 Sorties : <code>-${totalDepenses.toFixed(2)} DT</code>\n📊 <b>Solde Net : <code>${soldeNet >= 0 ? "+" : ""}${soldeNet.toFixed(2)} DT</code></b>`;

      await sendTelegramDocument(chatId, buffer, filename, {
        caption,
        parse_mode: "HTML",
      });

      storeUserExcelBuffer(chatId, buffer, filename);

      return {
        success: true,
        message: `✅ Le fichier Excel de caisse du ${dateStr} a été envoyé dans le chat. Solde net : <b>${soldeNet.toFixed(2)} DT</b>.`,
        summary: `Fichier Excel envoyé : ${filename} (Solde: ${soldeNet} DT)`,
      };
    }

    if (
      args.reportType === "class_timetable" ||
      args.reportType === ("timetable" as any) ||
      args.reportType === ("planning" as any)
    ) {
      const className = args.className || "1A";
      const targetClass = await resolveClassByName(context.schoolId, className);
      if (!targetClass) {
        return {
          success: false,
          message: `Classe "${className}" introuvable.`,
          summary: "Classe introuvable",
        };
      }

      const slots = await prisma.timetableSlot.findMany({
        where: {
          classId: targetClass.id,
          isDraft: false,
        },
        orderBy: [{ day: "asc" }, { slotNumber: "asc" }],
        include: {
          subject: { select: { name: true } },
          teacher: { select: { name: true, surname: true } },
          room: { select: { name: true } },
        },
      });

      const dayLabels: Record<string, string> = {
        MONDAY: "Lundi",
        TUESDAY: "Mardi",
        WEDNESDAY: "Mercredi",
        THURSDAY: "Jeudi",
        FRIDAY: "Vendredi",
        SATURDAY: "Samedi",
      };

      const formattedSlots = slots.map((s) => ({
        day: dayLabels[s.day] || s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: cleanSubj(s.subject?.name),
        teacher: s.teacher ? `${s.teacher.name} ${s.teacher.surname}` : "Non assigné",
        room: s.room?.name || "Sans salle",
      }));

      const { buffer, filename } = await generateSchoolExcelReport({
        type: "CLASS_TIMETABLE",
        schoolName,
        data: formattedSlots,
        options: {
          className: targetClass.name,
          month: targetMonth,
          year: targetYear,
        },
      });

      const caption = `📅 <b>Emploi du Temps Excel — Classe ${targetClass.name}</b>\n━━━━━━━━━━━━━━━━━━━━━━\n🏫 École : <b>${schoolName}</b>\n📊 Total séances : <b>${formattedSlots.length}</b>\n📁 Fichier : <code>${filename}</code>\n\n<i>Deux feuilles incluses : Grille hebdomadaire & Liste détaillée</i>`;

      await sendTelegramDocument(chatId, buffer, filename, {
        caption,
        parse_mode: "HTML",
      });

      storeUserExcelBuffer(chatId, buffer, filename);

      return {
        success: true,
        message: `✅ Le fichier Excel de l'emploi du temps de la classe <b>${targetClass.name}</b> (<code>${filename}</code>) a été généré et envoyé directement dans ce chat Telegram !`,
        summary: `Fichier Excel envoyé : ${filename} (${formattedSlots.length} séances)`,
      };
    }

    return {
      success: false,
      message: `Type de rapport "${args.reportType}" non supporté pour le moment.`,
      summary: "Type de rapport non reconnu",
    };
  } catch (err: any) {
    console.error("[exportExcelReportTool] Error:", err);
    return {
      success: false,
      message: `Erreur lors de la génération du fichier Excel : ${err.message || String(err)}`,
      summary: "Échec de génération Excel",
    };
  }
}

/**
 * Tool: modify_excel_spreadsheet
 * Modifies an uploaded or previously generated spreadsheet according to the admin's instructions
 * and immediately sends the updated .xlsx back to Telegram.
 */
export async function modifyExcelSpreadsheetTool(
  args: {
    operations: ExcelTransformOptions;
    outputFileName?: string;
  },
  context: ToolContext
): Promise<ExcelToolResult> {
  if (!context.chatId) {
    return {
      success: false,
      message: "Identifiant de chat introuvable.",
      summary: "Chat ID manquant",
    };
  }
  const chatId = context.chatId;

  try {
    const cached = getUserExcelBuffer(chatId);
    if (!cached) {
      return {
        success: false,
        message: "⚠️ Aucun fichier Excel n'a été trouvé dans notre conversation récente. Veuillez envoyer ou partager le fichier Excel (.xlsx ou .csv) d'abord dans le chat !",
        summary: "Aucun fichier Excel en cache dans le chat",
      };
    }

    const { buffer: newBuffer, summary } = await transformExcelWorkbook(
      cached.buffer,
      cached.fileName,
      args.operations
    );

    const baseName = cached.fileName.replace(/\.[^/.]+$/, "");
    const outputFileName = args.outputFileName || `${baseName}_modifie.xlsx`;

    // Cache updated buffer so subsequent modifications chain seamlessly
    storeUserExcelBuffer(chatId, newBuffer, outputFileName);

    const caption = `📊 <b>Fichier Excel Modifié</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📁 Fichier : <code>${outputFileName}</code>\n⚡ Modifications : <i>${summary}</i>\n\n<i>Mis à jour avec succès par Hnia</i>`;

    await sendTelegramDocument(chatId, newBuffer, outputFileName, {
      caption,
      parse_mode: "HTML",
    });

    return {
      success: true,
      message: `✅ <b>Fichier Excel modifié et renvoyé avec succès !</b>\n\n📌 <b>Détail des opérations :</b>\n${summary}\n\nLe document <code>${outputFileName}</code> est prêt à être téléchargé ci-dessus.`,
      summary: `Excel modifié et renvoyé : ${summary}`,
      data: { outputFileName, summary },
    };
  } catch (err: any) {
    console.error("[modifyExcelSpreadsheetTool] Error:", err);
    return {
      success: false,
      message: `Erreur lors de la modification du fichier Excel : ${err.message || String(err)}`,
      summary: "Erreur modification Excel",
    };
  }
}

/**
 * Tool: import_students_from_excel
 * Reads the uploaded Excel spreadsheet and bulk imports students into the school database.
 */
export async function importStudentsFromExcelTool(
  args: {
    defaultClass?: string;
    defaultMonthlyFee?: number;
  },
  context: ToolContext
): Promise<ExcelToolResult> {
  if (!context.chatId) {
    return {
      success: false,
      message: "Identifiant de chat introuvable.",
      summary: "Chat ID manquant",
    };
  }
  const chatId = context.chatId;

  try {
    const cached = getUserExcelBuffer(chatId);
    if (!cached) {
      return {
        success: false,
        message: "⚠️ Aucun fichier Excel d'élèves n'a été détecté dans le chat. Veuillez m'envoyer le fichier Excel d'abord !",
        summary: "Aucun fichier Excel en cache",
      };
    }

    const inspection = await inspectExcelBuffer(cached.buffer, cached.fileName);
    if (!inspection.success || inspection.sheets.length === 0) {
      return {
        success: false,
        message: "Impossible de lire le contenu du fichier Excel.",
        summary: "Lecture Excel impossible",
      };
    }

    const sheet = inspection.sheets[0];
    // Read all rows from the workbook
    const { loadWorkbookFromBuffer } = await import("@/lib/excel/excelEngine");
    const wb = await loadWorkbookFromBuffer(cached.buffer, cached.fileName);
    const ws = wb.getWorksheet(1);
    if (!ws) {
      return {
        success: false,
        message: "Feuille de calcul vide ou introuvable.",
        summary: "Feuille introuvable",
      };
    }

    const headers = sheet.headers;
    const findColIndex = (regex: RegExp) => {
      const idx = headers.findIndex((h) => regex.test(h.toLowerCase()));
      return idx >= 0 ? idx + 1 : -1;
    };

    const nameCol = findColIndex(/^(nom|name|nom de famille|nom élève|last_?name)$/i);
    const surnameCol = findColIndex(/^(prénom|prenom|first_?name|prenom élève)$/i);
    const singleNameCol = findColIndex(/^(élève|eleve|nom complet|nom et prénom|student)$/i);
    const classCol = findColIndex(/^(classe|class|section|groupe)$/i);
    const parentNameCol = findColIndex(/^(parent|tuteur|nom parent|père|pere|mère|mere)$/i);
    const parentPhoneCol = findColIndex(/^(tél|tel|téléphone|telephone|mobile|gsm|contact parent|phone)$/i);
    const feeCol = findColIndex(/^(frais|tarif|prix|scolarité|montant)$/i);

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Header row is row 1 (or detected headerRow)
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      let name = "";
      let surname = "";

      if (nameCol > 0 && surnameCol > 0) {
        name = String(row.getCell(nameCol).value || "").trim();
        surname = String(row.getCell(surnameCol).value || "").trim();
      } else if (singleNameCol > 0) {
        const full = String(row.getCell(singleNameCol).value || "").trim();
        const parts = full.split(/\s+/);
        if (parts.length >= 2) {
          name = parts.slice(0, -1).join(" ");
          surname = parts[parts.length - 1];
        } else {
          name = full;
          surname = "";
        }
      } else if (nameCol > 0) {
        name = String(row.getCell(nameCol).value || "").trim();
      }

      if (!name) {
        skippedCount++;
        continue;
      }

      const targetClassName =
        (classCol > 0 ? String(row.getCell(classCol).value || "").trim() : "") ||
        args.defaultClass ||
        "";

      if (!targetClassName) {
        skippedCount++;
        errors.push(`Ligne ${r} : Pas de classe spécifiée pour ${name} ${surname}`);
        continue;
      }

      const parentName = parentNameCol > 0 ? String(row.getCell(parentNameCol).value || "").trim() : undefined;
      const parentPhone = parentPhoneCol > 0 ? String(row.getCell(parentPhoneCol).value || "").trim() : undefined;
      const customTuition = feeCol > 0 ? Number(row.getCell(feeCol).value) || undefined : args.defaultMonthlyFee;

      const res = await createStudentTool(
        {
          name,
          surname: surname || name,
          className: targetClassName,
          parentName,
          parentPhone,
          customTuition,
        },
        context
      );

      if (res.success) {
        importedCount++;
      } else {
        skippedCount++;
        errors.push(`Ligne ${r} (${name}) : ${res.message}`);
      }
    }

    return {
      success: true,
      message: `📥 <b>Importation terminée !</b>\n\n✅ <b>${importedCount} élève(s)</b> importé(s) et inscrit(s) avec succès dans SnapSchool.\n${skippedCount > 0 ? `⚠️ <b>${skippedCount} ligne(s)</b> ignorée(s) ou en erreur.` : ""}\n\n${errors.slice(0, 3).join("\n")}`,
      summary: `Importation Excel : ${importedCount} élèves créés, ${skippedCount} ignorés.`,
      data: { importedCount, skippedCount, errors },
    };
  } catch (err: any) {
    console.error("[importStudentsFromExcelTool] Error:", err);
    return {
      success: false,
      message: `Erreur lors de l'importation du fichier Excel : ${err.message || String(err)}`,
      summary: "Erreur import Excel",
    };
  }
}

/**
 * Tool: write_timetable_to_excel
 * Writes / integrates a class timetable into an uploaded spreadsheet (e.g. Planning.xlsx)
 * or creates a fresh planning spreadsheet for that class and sends it immediately to Telegram.
 */
export async function writeTimetableToExcelTool(
  args: {
    className?: string;
    month?: number;
    year?: number;
    outputFileName?: string;
  },
  context: ToolContext
): Promise<ExcelToolResult> {
  if (!context.chatId) {
    return {
      success: false,
      message: "Identifiant de chat Telegram manquant pour l'envoi du document.",
      summary: "Chat ID manquant",
    };
  }
  const chatId = context.chatId;

  try {
    const school = await prisma.school.findUnique({
      where: { id: context.schoolId },
      select: { name: true },
    });
    const schoolName = school?.name || "SnapSchool Academy";

    const now = new Date();
    const targetMonth = args.month || now.getMonth() + 1;
    const targetYear = args.year || now.getFullYear();
    const className = args.className || "1A";

    const targetClass = await resolveClassByName(context.schoolId, className);
    if (!targetClass) {
      return {
        success: false,
        message: `Classe "${className}" introuvable.`,
        summary: "Classe introuvable",
      };
    }

    const slots = await prisma.timetableSlot.findMany({
      where: {
        classId: targetClass.id,
        isDraft: false,
      },
      orderBy: [{ day: "asc" }, { slotNumber: "asc" }],
      include: {
        subject: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
        room: { select: { name: true } },
      },
    });

    const dayLabels: Record<string, string> = {
      MONDAY: "Lundi",
      TUESDAY: "Mardi",
      WEDNESDAY: "Mercredi",
      THURSDAY: "Jeudi",
      FRIDAY: "Vendredi",
      SATURDAY: "Samedi",
    };

    const formattedSlots = slots.map((s) => ({
      day: dayLabels[s.day] || s.day,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: cleanSubj(s.subject?.name),
      teacher: s.teacher ? `${s.teacher.name} ${s.teacher.surname}` : "Non assigné",
      room: s.room?.name || "Sans salle",
    }));

    const cached = getUserExcelBuffer(chatId);
    let buffer: Buffer;
    let filename: string;

    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
    ];
    const monthName = monthNames[targetMonth - 1] || "Septembre";
    const defaultOutName = `Planning_${targetClass.name}_${monthName}_${targetYear}.xlsx`;

    if (cached) {
      // Load user's uploaded workbook and enrich with timetable
      const wb = await loadWorkbookFromBuffer(cached.buffer, cached.fileName);

      // Check if a timetable sheet already exists, or create a fresh one
      const sheetName = `Emploi du Temps ${targetClass.name}`;
      let ws = wb.getWorksheet(sheetName);
      if (!ws) {
        ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
      }

      // Title
      ws.mergeCells("A1:F1");
      const titleCell = ws.getCell("A1");
      titleCell.value = `🎓 ${schoolName.toUpperCase()} — EMPLOI DU TEMPS • CLASSE ${targetClass.name}`;
      titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(1).height = 34;

      const headers = ["N°", "Jour", "Créneau Horaire", "Matière", "Enseignant", "Salle"];
      const headerRow = ws.getRow(3);
      headerRow.values = headers;
      headerRow.height = 26;

      formattedSlots.forEach((s, idx) => {
        const r = ws.addRow([
          idx + 1,
          s.day,
          `${s.startTime} - ${s.endTime}`,
          s.subject,
          s.teacher,
          s.room,
        ]);
        r.height = 22;
      });

      applyExecutiveThemeToWorksheet(ws, 3);
      buffer = Buffer.from(await wb.xlsx.writeBuffer());
      filename = args.outputFileName || defaultOutName;
    } else {
      const generated = await generateSchoolExcelReport({
        type: "CLASS_TIMETABLE",
        schoolName,
        data: formattedSlots,
        options: {
          className: targetClass.name,
          month: targetMonth,
          year: targetYear,
        },
      });
      buffer = generated.buffer;
      filename = args.outputFileName || defaultOutName;
    }

    const caption = `📊 <b>Fichier Excel Mis à Jour : Emploi du Temps ${targetClass.name}</b>\n━━━━━━━━━━━━━━━━━━━━━━\n🏫 École : <b>${schoolName}</b>\n📅 Période : <code>${monthName} ${targetYear}</code>\n⚡ Intégration effectuée : <b>${formattedSlots.length} séances</b>\n📁 Fichier : <code>${filename}</code>\n\n<i>Prêt à être téléchargé et imprimé directement !</i>`;

    await sendTelegramDocument(chatId, buffer, filename, {
      caption,
      parse_mode: "HTML",
    });

    storeUserExcelBuffer(chatId, buffer, filename);

    return {
      success: true,
      message: `✅ <b>Fichier Excel envoyé avec succès !</b>\n\nLe fichier <code>${filename}</code> intégrant l'emploi du temps de la classe <b>${targetClass.name}</b> (${formattedSlots.length} séances pour ${monthName} ${targetYear}) a été transmis directement dans ce chat Telegram.`,
      summary: `Fichier Excel envoyé : ${filename} (${formattedSlots.length} séances)`,
      data: { filename, totalSlots: formattedSlots.length },
    };
  } catch (err: any) {
    console.error("[writeTimetableToExcelTool] Error:", err);
    return {
      success: false,
      message: `Erreur lors de l'intégration de l'emploi du temps dans le fichier Excel : ${err.message || String(err)}`,
      summary: "Échec intégration emploi du temps Excel",
    };
  }
}

/**
 * Tool: send_cached_excel
 * Sends or re-sends the active / cached Excel spreadsheet to the Telegram chat.
 * Trigger when the user asks: "where s the Planning.xlsx send it", "send it", "renvoie le fichier",
 * "where can I download it", "télécharger", "donne-moi le fichier".
 */
export async function sendCachedExcelTool(
  args: {
    customFileName?: string;
    className?: string;
  },
  context: ToolContext
): Promise<ExcelToolResult> {
  if (!context.chatId) {
    return {
      success: false,
      message: "Identifiant de chat introuvable.",
      summary: "Chat ID manquant",
    };
  }
  const chatId = context.chatId;

  try {
    const cached = getUserExcelBuffer(chatId);
    if (cached) {
      const outName = args.customFileName || cached.fileName;
      const caption = `📁 <b>Document Excel Téléchargeable</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📄 Fichier : <code>${outName}</code>\n\n<i>Cliquez sur le document ci-dessus pour le télécharger sur votre appareil.</i>`;

      await sendTelegramDocument(chatId, cached.buffer, outName, {
        caption,
        parse_mode: "HTML",
      });

      return {
        success: true,
        message: `✅ Le fichier <code>${outName}</code> a été envoyé dans le chat en pièce jointe téléchargeable !`,
        summary: `Fichier envoyé : ${outName}`,
        data: { filename: outName },
      };
    }

    // Fallback: If className is provided or inferred (e.g. 1A), generate and send on the fly!
    if (args.className || /1[A-Z]|2[A-Z]|3[A-Z]|4[A-Z]|5[A-Z]|6[A-Z]/i.test(args.customFileName || "")) {
      const detectedClass = args.className || "1A";
      return await writeTimetableToExcelTool({ className: detectedClass }, context);
    }

    return {
      success: false,
      message:
        "⚠️ Aucun fichier Excel n'est actuellement en mémoire dans notre conversation. Veuillez renvoyer le fichier .xlsx dans le chat pour que je puisse vous le renvoyer !",
      summary: "Aucun fichier Excel en cache",
    };
  } catch (err: any) {
    console.error("[sendCachedExcelTool] Error:", err);
    return {
      success: false,
      message: `Erreur lors de l'envoi du fichier : ${err.message || String(err)}`,
      summary: "Erreur envoi Excel",
    };
  }
}
