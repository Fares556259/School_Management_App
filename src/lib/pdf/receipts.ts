import { jsPDF } from "jspdf";

export interface TuitionReceiptData {
  schoolName: string;
  receiptNumber: string;
  paymentDate: Date | string;
  studentName: string;
  studentClass?: string;
  parentName: string;
  parentPhone?: string;
  periodFrench: string;
  amountPaid: number;
  tuitionFee?: number;
  remainingDue?: number;
  paymentMethod?: string;
  adminName?: string;
  notes?: string;
}

export interface SalaryPayslipData {
  schoolName: string;
  payslipNumber: string;
  paymentDate: Date | string;
  employeeName: string;
  employeeRole: string;
  employeeType: "TEACHER" | "STAFF";
  periodFrench: string;
  baseSalary: number;
  hourlyRate?: number;
  hoursTracked?: number;
  missedHours?: number;
  deductionsAmount?: number;
  advancesAmount?: number;
  netPaid: number;
  remainingDue?: number;
  paymentMethod?: string;
  adminName?: string;
  notes?: string;
}

function formatDate(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return new Date().toLocaleDateString("fr-FR");
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return new Date().toLocaleString("fr-FR");
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Generates an official, high-fidelity Tuition Payment Receipt PDF.
 * Returns a Node.js Buffer and safe filename.
 */
export async function generateTuitionReceiptPdf(data: TuitionReceiptData): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const school = data.schoolName || "SnapSchool";
  const tuition = data.tuitionFee ?? data.amountPaid;
  const remaining = Math.max(0, data.remainingDue ?? 0);
  const isFullyPaid = remaining === 0;

  // 1. Top Decorative Brand Bar
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(0, 0, 210, 6, "F");

  // 2. School Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text(school.toUpperCase(), 18, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text("Établissement Scolaire Privé • Quittance & Recouvrement", 18, 28);
  doc.text("Système de Gestion Numérique Sécurisé SnapSchool", 18, 33);

  // Top Right Meta Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229);
  doc.text(`QUITTANCE N° ${data.receiptNumber}`, 192, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date : ${formatDateTime(data.paymentDate)}`, 192, 28, { align: "right" });
  doc.text(`Mode : ${data.paymentMethod || "Espèces"}`, 192, 33, { align: "right" });

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(18, 38, 192, 38);

  // 3. Document Title Banner
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(18, 43, 174, 13, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229);
  doc.text(
    "REÇU OFFICIEL DE PAIEMENT — FRAIS DE SCOLARITÉ",
    105,
    51.5,
    { align: "center" }
  );

  // 4. Beneficiary and Parent Info Container
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(18, 62, 174, 48, 3, 3, "DF");

  // Left column: Student details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text("ÉLÈVE CONCERNÉ", 24, 71);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(data.studentName, 24, 79);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Classe : ${data.studentClass || "Non assignée"}`, 24, 87);
  doc.text(`Période scolaire : ${data.periodFrench}`, 24, 94);
  doc.text(`Mode de versement : ${data.paymentMethod || "Espèces"}`, 24, 101);

  // Right column: Parent / Guardian details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text("PARENT / RESPONSABLE", 110, 71);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(data.parentName, 110, 79);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Téléphone : ${data.parentPhone || "Non renseigné"}`, 110, 87);
  doc.text(`Enregistré par : ${data.adminName || "Direction / Administration"}`, 110, 94);
  doc.text(`Statut : ${isFullyPaid ? "Soldé" : "Versement partiel"}`, 110, 101);

  // 5. Line items table
  // Table Header
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(18, 117, 174, 9, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("DÉSIGNATION", 24, 123);
  doc.text("PÉRIODE", 88, 123);
  doc.text("TARIF MENSUEL", 132, 123, { align: "right" });
  doc.text("MONTANT RÉGLÉ", 186, 123, { align: "right" });

  // Table Row 1
  doc.setFillColor(248, 250, 252);
  doc.rect(18, 126, 174, 14, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(18, 140, 192, 140);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Droits de scolarité & frais pédagogiques", 24, 134.5);

  doc.setFont("helvetica", "normal");
  doc.text(data.periodFrench, 88, 134.5);

  doc.text(`${tuition.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DT`, 132, 134.5, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(79, 70, 229);
  doc.text(`${data.amountPaid.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DT`, 186, 134.5, { align: "right" });

  // 6. Summary highlight card
  const cardY = 146;
  doc.setFillColor(245, 247, 255);
  doc.setDrawColor(199, 210, 254);
  doc.setLineWidth(0.6);
  doc.roundedRect(18, cardY, 174, 26, 2.5, 2.5, "DF");

  // Status badge inside card
  if (isFullyPaid) {
    doc.setFillColor(209, 250, 229); // Emerald 100
    doc.roundedRect(24, cardY + 7, 72, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105); // Emerald 600
    doc.text("SOLDE ENTIÈREMENT RÉGLÉ", 60, cardY + 14.5, { align: "center" });
  } else {
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.roundedRect(24, cardY + 7, 72, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text(`PAIEMENT PARTIEL (DÛ: ${remaining} DT)`, 60, cardY + 14.5, { align: "center" });
  }

  // Right: Total amount paid
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL VERSÉ & ACQUITTÉ :", 186, cardY + 9, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(79, 70, 229);
  doc.text(`${data.amountPaid.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DT`, 186, cardY + 20, { align: "right" });

  // 7. Official Seal & Signatures
  const sealY = 182;

  // Official Vector Stamp
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(1.2);
  doc.roundedRect(122, sealY, 70, 35, 3, 3, "S");

  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.4);
  doc.roundedRect(124, sealY + 2, 66, 31, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  const truncatedSchool = school.length > 24 ? school.slice(0, 22) + "..." : school;
  doc.text(truncatedSchool.toUpperCase(), 157, sealY + 10, { align: "center" });

  doc.setFontSize(9.5);
  doc.text("★ PAYÉ & ACQUITTÉ ★", 157, sealY + 18, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Le ${formatDate(data.paymentDate)}`, 157, sealY + 25, { align: "center" });
  doc.text("Visa Administration", 157, sealY + 30, { align: "center" });

  // Signatures on the left
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Émargement du Parent :", 24, sealY + 12);
  doc.setDrawColor(203, 213, 225);
  doc.line(24, sealY + 28, 85, sealY + 28);

  // 8. Footer & Security Certificate
  doc.setDrawColor(226, 232, 240);
  doc.line(18, 252, 192, 252);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Authentification SnapSchool : SEC-${data.receiptNumber} • Document officiel opposable`,
    18,
    258
  );
  doc.text(
    "Ce reçu électronique certifie le versement des frais de scolarité susmentionnés auprès de l'établissement.",
    18,
    263
  );

  const cleanStudentName = data.studentName.replace(/[^a-zA-Z0-9]/g, "_");
  const cleanPeriod = data.periodFrench.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Recu_${cleanStudentName}_${cleanPeriod}.pdf`;

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, filename };
}

/**
 * Generates an official, high-fidelity Salary Payslip PDF for Teachers and Staff.
 * Returns a Node.js Buffer and safe filename.
 */
export async function generateSalaryPayslipPdf(data: SalaryPayslipData): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const school = data.schoolName || "SnapSchool";
  const isTeacher = data.employeeType === "TEACHER";
  const deductions = Math.max(0, data.deductionsAmount ?? 0);
  const advances = Math.max(0, data.advancesAmount ?? 0);
  const remaining = Math.max(0, data.remainingDue ?? 0);
  const isFullyPaid = remaining === 0;

  // 1. Top Decorative Brand Bar
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 210, 6, "F");

  // 2. School Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text(school.toUpperCase(), 18, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Direction des Ressources Humaines & Comptabilité", 18, 28);
  doc.text("Gestion des Traitements & Rémunérations SnapSchool", 18, 33);

  // Top Right Meta Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`BULLETIN N° ${data.payslipNumber}`, 192, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date de paiement : ${formatDateTime(data.paymentDate)}`, 192, 28, { align: "right" });
  doc.text(`Mode : ${data.paymentMethod || "Virement / Espèces"}`, 192, 33, { align: "right" });

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(18, 38, 192, 38);

  // 3. Document Title Banner
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(18, 43, 174, 13, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `BULLETIN DE PAIE — ${data.periodFrench.toUpperCase()}`,
    105,
    51.5,
    { align: "center" }
  );

  // 4. Employee Information Container
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(18, 62, 174, 46, 3, 3, "DF");

  // Left column: Employee details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(isTeacher ? "ENSEIGNANT / FORMATEUR" : "MEMBRE DU PERSONNEL", 24, 71);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(data.employeeName, 24, 79);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Fonction : ${data.employeeRole || (isTeacher ? "Enseignant" : "Personnel")}`, 24, 87);
  doc.text(`Période de travail : ${data.periodFrench}`, 24, 94);
  if (data.hourlyRate && data.hourlyRate > 0) {
    doc.text(`Taux horaire de référence : ${data.hourlyRate.toFixed(2)} DT/h`, 24, 101);
  } else {
    doc.text(`Statut : Titulaire rémunéré au forfait`, 24, 101);
  }

  // Right column: Payment context
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text("DÉTAILS ADMINISTRATIFS", 110, 71);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Établissement : ${school}`, 110, 79);
  doc.text(`Établi par : ${data.adminName || "Direction"}`, 110, 87);
  doc.text(`Statut règlement : ${isFullyPaid ? "Clôturé & Soldé" : "Avance sur traitement"}`, 110, 94);
  doc.text(`Mode de versement : ${data.paymentMethod || "Espèces / Virement"}`, 110, 101);

  // 5. Line items table (Earnings & Deductions)
  let currentY = 116;
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(18, currentY, 174, 9, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("RUBRIQUE DE PAIE", 24, currentY + 6);
  doc.text("BASE", 95, currentY + 6);
  doc.text("GAIN BRUT (+)", 140, currentY + 6, { align: "right" });
  doc.text("RETENUE (-)", 186, currentY + 6, { align: "right" });

  currentY += 9;

  // Line 1: Base Salary
  doc.setFillColor(248, 250, 252);
  doc.rect(18, currentY, 174, 10, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(18, currentY + 10, 192, currentY + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Salaire mensuel de base contractuel", 24, currentY + 6.5);
  doc.setFont("helvetica", "normal");
  doc.text("Forfait mensuel", 95, currentY + 6.5);
  doc.text(`${data.baseSalary.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DT`, 140, currentY + 6.5, { align: "right" });
  doc.text("—", 186, currentY + 6.5, { align: "right" });

  currentY += 10;

  // Line 2: Absence Deductions (if any)
  if (deductions > 0 || (data.missedHours && data.missedHours > 0)) {
    doc.setFillColor(255, 255, 255);
    doc.rect(18, currentY, 174, 10, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(18, currentY + 10, 192, currentY + 10);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(225, 29, 72); // Rose 600
    doc.text(`Déduction absence (${data.missedHours || 0}h non justifiées)`, 24, currentY + 6.5);
    doc.text(`${data.missedHours || 0} heures`, 95, currentY + 6.5);
    doc.text("—", 140, currentY + 6.5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(`- ${deductions.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DT`, 186, currentY + 6.5, { align: "right" });

    currentY += 10;
  }

  // Line 3: Advances (if any)
  if (advances > 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(18, currentY, 174, 10, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(18, currentY + 10, 192, currentY + 10);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(147, 51, 234); // Purple 600
    doc.text("Avance sur salaire déjà perçue", 24, currentY + 6.5);
    doc.text("Acompte", 95, currentY + 6.5);
    doc.text("—", 140, currentY + 6.5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(`- ${advances.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DT`, 186, currentY + 6.5, { align: "right" });

    currentY += 10;
  }

  // 6. Net Pay Card
  const netCardY = currentY + 6;
  doc.setFillColor(240, 253, 244); // Emerald 50
  doc.setDrawColor(167, 243, 208); // Emerald 200
  doc.setLineWidth(0.6);
  doc.roundedRect(18, netCardY, 174, 26, 2.5, 2.5, "DF");

  // Badge inside Net Card
  if (isFullyPaid) {
    doc.setFillColor(209, 250, 229);
    doc.roundedRect(24, netCardY + 7, 65, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text("SALAIRE SOLDÉ DU MOIS", 56.5, netCardY + 14.5, { align: "center" });
  } else {
    doc.setFillColor(243, 232, 255); // Purple 100
    doc.roundedRect(24, netCardY + 7, 65, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(126, 34, 206);
    doc.text(`AVANCE VERSÉE (SOLDE: ${remaining} DT)`, 56.5, netCardY + 14.5, { align: "center" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("NET PAYÉ / VERSÉ CE JOUR :", 186, netCardY + 9, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(5, 150, 105); // Emerald 600
  doc.text(`${data.netPaid.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DT`, 186, netCardY + 20, { align: "right" });

  // 7. Official Seal & Signatures
  const sealY = netCardY + 34;

  // Official Vector Stamp
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(1.2);
  doc.roundedRect(122, sealY, 70, 35, 3, 3, "S");

  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.roundedRect(124, sealY + 2, 66, 31, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const truncatedSchool = school.length > 24 ? school.slice(0, 22) + "..." : school;
  doc.text(truncatedSchool.toUpperCase(), 157, sealY + 10, { align: "center" });

  doc.setFontSize(9);
  doc.text("★ SALAIRE ACQUITTÉ ★", 157, sealY + 18, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Le ${formatDate(data.paymentDate)}`, 157, sealY + 25, { align: "center" });
  doc.text("La Direction Générale", 157, sealY + 30, { align: "center" });

  // Signatures on the left
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Émargement du Salarié :", 24, sealY + 12);
  doc.setDrawColor(203, 213, 225);
  doc.line(24, sealY + 28, 85, sealY + 28);

  // 8. Footer & Security Certificate
  doc.setDrawColor(226, 232, 240);
  doc.line(18, 254, 192, 254);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Bulletin confidentiel émis via SnapSchool RH • Réf : ${data.payslipNumber} • Pour faire valoir ce que de droit`,
    18,
    260
  );

  const cleanEmployeeName = data.employeeName.replace(/[^a-zA-Z0-9]/g, "_");
  const cleanPeriod = data.periodFrench.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Bulletin_Paie_${cleanEmployeeName}_${cleanPeriod}.pdf`;

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, filename };
}
