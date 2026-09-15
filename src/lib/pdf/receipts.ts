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
  checkNumber?: string;
  bankName?: string;
  adminName?: string;
  notes?: string;
}

export interface DailyCashRegisterItem {
  time?: string;
  reference?: string;
  label: string;
  categoryOrClass?: string;
  method?: string;
  checkDetails?: string;
  amount: number;
}

export interface DailyCashRegisterData {
  schoolName: string;
  date: Date | string;
  adminName?: string;
  totalIncomes: number;
  totalExpenses: number;
  netBalance: number;
  totalCash: number;
  totalChecks: number;
  checkCount: number;
  totalTransfers?: number;
  inflowItems: DailyCashRegisterItem[];
  outflowItems: DailyCashRegisterItem[];
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
 * Generates an official, high-fidelity Tuition Payment Receipt PDF in Double-Volet format (A4):
 * - Top half: VOLET N° 1 (EXEMPLAIRE PARENT / ÉLÈVE)
 * - Middle: Dotted scissors cutting line ✂️
 * - Bottom half: VOLET N° 2 (SOUCHE ADMINISTRATION & ARCHIVES COMPTABLES with check attachment box)
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

  // Determine method label and check details
  let methodLabel = data.paymentMethod || "Espèces";
  if (data.checkNumber) {
    methodLabel = `Chèque N° ${data.checkNumber}${data.bankName ? ` (${data.bankName})` : ""}`;
  }

  // ═════════════════════════════════════════════════════════════
  // VOLET 1 : EXEMPLAIRE PARENT / ÉLÈVE (HAUT DE PAGE)
  // ═════════════════════════════════════════════════════════════
  // 1. Top Decorative Brand Bar (Subtle Black Rule)
  doc.setFillColor(17, 24, 39); // Deep Slate / Black
  doc.rect(0, 0, 210, 2.5, "F");

  // 2. School Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(school.toUpperCase(), 15, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text("Établissement Scolaire Privé • Quittance & Recouvrement", 15, 17);

  // Top Right Meta Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`QUITTANCE N° ${data.receiptNumber}`, 195, 12, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text(`Date : ${formatDateTime(data.paymentDate)} • Mode : ${methodLabel}`, 195, 17, { align: "right" });

  // 3. Document Title Banner (Clean Monochrome Frame)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.7);
  doc.roundedRect(15, 21, 180, 7, 1, 1, "DF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("VOLET N° 1 : EXEMPLAIRE PARENT / ÉLÈVE — REÇU DE SCOLARITÉ", 105, 25.5, { align: "center" });

  // 4. Beneficiary and Parent Info Container
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, 31, 180, 31, 1.5, 1.5, "DF");

  // Left column: Student details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text("ÉLÈVE CONCERNÉ", 20, 37);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(data.studentName, 20, 43);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(`Classe : ${data.studentClass || "Non assignée"}  •  Période : ${data.periodFrench}`, 20, 49);
  doc.text(`Règlement : ${methodLabel}`, 20, 55);

  // Right column: Parent details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text("PARENT & ENCAISSEMENT", 110, 37);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(data.parentName, 110, 43);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(`Tél : ${data.parentPhone || "Non renseigné"}  •  Reçu par : ${data.adminName || "Direction"}`, 110, 49);
  doc.text(
    `Statut comptable : ${isFullyPaid ? "Soldé entièrement (0 DT restant)" : `Partiel (Reste dû : ${remaining.toFixed(2)} DT)`}`,
    110,
    55
  );

  // 5. Summary row
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.6);
  doc.roundedRect(15, 65, 180, 17, 1.5, 1.5, "DF");

  // Status badge inside card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  const badgeW = isFullyPaid ? 62 : 68;
  doc.roundedRect(20, 68.5, badgeW, 10, 1.5, 1.5, "DF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(
    isFullyPaid ? "SOLDE ENTIÈREMENT RÉGLÉ" : `PAIEMENT PARTIEL (DÛ: ${remaining.toFixed(2)} DT)`,
    20 + badgeW / 2,
    75,
    { align: "center" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text("TOTAL VERSÉ & ACQUITTÉ :", 145, 71.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`${data.amountPaid.toFixed(2)} DT`, 190, 78.5, { align: "right" });

  // 6. Stamp & Signature
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(1.0);
  doc.roundedRect(135, 85, 60, 24, 2, 2, "S");
  doc.setLineWidth(0.4);
  doc.roundedRect(136.5, 86.5, 57, 21, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  const truncatedSchool = school.length > 22 ? school.slice(0, 20) + "..." : school;
  doc.text(truncatedSchool.toUpperCase(), 165, 91, { align: "center" });
  doc.setFontSize(8.5);
  doc.text("• PAYÉ & ACQUITTÉ •", 165, 97, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(75, 85, 99);
  doc.text(`Le ${formatDate(data.paymentDate)} • Visa Direction`, 165, 103, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Visa & Signature Administration :", 20, 91);
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.5);
  doc.line(20, 105, 80, 105);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text(
    "* Règlement sous réserve de bon encaissement bancaire. Quittance officielle opposable émise par SnapSchool.",
    15,
    115
  );

  // ═════════════════════════════════════════════════════════════
  // LIGNE MÉDIANE DE DÉCOUPE (CISEAUX)
  // ═════════════════════════════════════════════════════════════
  const cutY = 122;
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(15, cutY, 195, cutY);
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "- - - - - - - - - - -   LIGNE DE DÉCOUPE : DÉTACHER LE VOLET PARENT (HAUT) ET CONSERVER LA SOUCHE (BAS)   - - - - - - - - - - -",
    105,
    cutY + 3.5,
    { align: "center" }
  );

  // ═════════════════════════════════════════════════════════════
  // VOLET 2 : SOUCHE ADMINISTRATION & ARCHIVES COMPTABLES (BAS)
  // ═════════════════════════════════════════════════════════════
  const v2Y = 131;
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, v2Y, 210, 3.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(school.toUpperCase(), 15, v2Y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Souche Interne d'Archive Comptable • Registre des Quittances de Caisse", 15, v2Y + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`SOUCHE N° ${data.receiptNumber}`, 195, v2Y + 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Encaissé le ${formatDateTime(data.paymentDate)} • Par : ${data.adminName || "Direction"}`, 195, v2Y + 16, {
    align: "right",
  });

  // Banner Volet 2
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(15, v2Y + 20, 180, 7, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text("VOLET N° 2 : SOUCHE ADMINISTRATION & CLASSEUR DE CAISSE (ARCHIVE)", 105, v2Y + 24.5, { align: "center" });

  // Details box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, v2Y + 30, 180, 26, 2, 2, "DF");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("DOSSIER ÉLÈVE & PARENT", 20, v2Y + 36);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.studentName} (Classe ${data.studentClass || "N/A"})`, 20, v2Y + 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Parent : ${data.parentName} • Tél : ${data.parentPhone || "Non renseigné"}`, 20, v2Y + 48);
  doc.text(`Période : ${data.periodFrench} • Tarif mensuel : ${tuition.toFixed(2)} DT`, 20, v2Y + 53);

  // Right: Montant Encaissé
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("MONTANT ENCAISSÉ :", 150, v2Y + 38, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(`${data.amountPaid.toFixed(2)} DT`, 190, v2Y + 46, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Solde restant dû : ${remaining.toFixed(2)} DT (${isFullyPaid ? "Soldé" : "Impayé"})`, 190, v2Y + 52, {
    align: "right",
  });

  // CHECK / PIECE ATTACHMENT BOX
  const checkY = v2Y + 59;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(107, 114, 128);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.roundedRect(15, checkY, 180, 23, 2, 2, "DF");
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(0, 0, 0);
  doc.text("[ARCHIVE] RÈGLEMENT PAR CHÈQUE & JUSTIFICATIF (Emplacement chèque) :", 20, checkY + 5.5);

  const isCheck = Boolean(data.checkNumber || data.paymentMethod?.toLowerCase().includes("chèque"));
  const checkNum = data.checkNumber || "______________";
  const bankStr = data.bankName || "______________";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  doc.text(`[ ${isCheck ? "X" : " "} ] CHÈQUE N° : ${checkNum}     BANQUE : ${bankStr}     ÉCHÉANCE : ${formatDate(data.paymentDate)}`, 20, checkY + 11.5);
  doc.text(`[ ${!isCheck ? "X" : " "} ] ESPÈCES         [   ] VIREMENT BANCAIRE         [   ] DÉPÔT DIRECT`, 20, checkY + 16.5);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text("* Agrafer le chèque physique ou la copie de pièce ici pour le classeur comptable.", 20, checkY + 21);

  // Signatures on souche
  const sigY = checkY + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Signature / Décharge du Parent (Pour acquit) :", 20, sigY + 4);
  doc.setDrawColor(203, 213, 225);
  doc.line(20, sigY + 16, 85, sigY + 16);

  doc.text("Visa Caissier & Approbation Direction :", 120, sigY + 4);
  doc.line(120, sigY + 16, 190, sigY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Archive physique SnapSchool • Classé au registre de caisse de l'établissement.", 15, 266);

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
    doc.setTextColor(0, 0, 0);
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
    doc.setTextColor(0, 0, 0);
    doc.text("Avance sur salaire déjà perçue", 24, currentY + 6.5);
    doc.text("Acompte", 95, currentY + 6.5);
    doc.text("—", 140, currentY + 6.5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(`- ${advances.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DT`, 186, currentY + 6.5, { align: "right" });

    currentY += 10;
  }

  // 6. Net Pay Card
  const netCardY = currentY + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(1.0);
  doc.roundedRect(18, netCardY, 174, 26, 2.5, 2.5, "DF");

  // Badge inside Net Card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.roundedRect(24, netCardY + 7, 72, 12, 2, 2, "DF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  if (isFullyPaid) {
    doc.text("SALAIRE SOLDÉ DU MOIS", 60, netCardY + 14.5, { align: "center" });
  } else {
    doc.text(`AVANCE VERSÉE (SOLDE: ${remaining} DT)`, 60, netCardY + 14.5, { align: "center" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  doc.text("NET PAYÉ / VERSÉ CE JOUR :", 186, netCardY + 9, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
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

/**
 * Generates an official, high-fidelity Daily Cash Register & Financial Report PDF (A4).
 * Includes KPI cards, cash vs check breakdown, itemized inflows and outflows tables,
 * cashier & direction sign-off sections.
 * Returns a Node.js Buffer and safe filename.
 */
export async function generateDailyCashRegisterPdf(data: DailyCashRegisterData): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const school = data.schoolName || "SnapSchool";
  const dateFormatted = formatDate(data.date);

  // 1. Helper to extract Client/Tiers vs Description from item label
  const parseTransactionLabel = (item: {
    label: string;
    categoryOrClass?: string;
    type: "IN" | "OUT";
  }): { client: string; description: string } => {
    let client = "";
    let description = "";

    const clean = item.label.trim();
    if (clean.toLowerCase().startsWith("scolarité")) {
      // E.g. "Scolarité Wiem Marzouki (Septembre 2026)"
      const parts = clean.replace(/^scolarit[ée]\s*[:\-]?\s*/i, "").trim();
      const parenMatch = parts.match(/^(.*?)\s*\((.*?)\)$/);
      if (parenMatch) {
        client = parenMatch[1].trim();
        description = parenMatch[2].trim();
      } else {
        client = parts;
        description = "Scolarité mensuelle";
      }
      if (item.categoryOrClass && !client.includes(item.categoryOrClass)) {
        client += ` (${item.categoryOrClass})`;
      }
    } else if (clean.toLowerCase().startsWith("frais")) {
      client = item.categoryOrClass || "Élève / Adhérent";
      description = clean;
    } else if (clean.toLowerCase().startsWith("fournitures") || clean.toLowerCase().startsWith("achat")) {
      client = "Fournisseur Bureau";
      description = clean;
    } else if (clean.toLowerCase().startsWith("réparation") || clean.toLowerCase().startsWith("maintenance")) {
      client = "Prestataire Maintenance";
      description = clean;
    } else {
      client = item.categoryOrClass || (item.type === "IN" ? "Client / Parent" : "Fournisseur");
      description = clean;
    }

    return { client, description };
  };

  // 2. Merge and chronologically sort all transactions
  type UnifiedTx = {
    time: string;
    type: "IN" | "OUT";
    client: string;
    description: string;
    method: string;
    amount: number;
    runningBalance: number;
  };

  const rawTxList = [
    ...data.inflowItems.map((item) => {
      const parsed = parseTransactionLabel({ label: item.label, categoryOrClass: item.categoryOrClass, type: "IN" });
      const methodStr = item.checkDetails ? `Chq ${item.checkDetails}` : (item.method || "Espèces");
      return {
        time: item.time || "",
        type: "IN" as const,
        client: parsed.client,
        description: parsed.description,
        method: methodStr,
        amount: item.amount,
      };
    }),
    ...data.outflowItems.map((item) => {
      const parsed = parseTransactionLabel({ label: item.label, categoryOrClass: item.categoryOrClass, type: "OUT" });
      return {
        time: item.time || "",
        type: "OUT" as const,
        client: parsed.client,
        description: parsed.description,
        method: item.method || "Espèces",
        amount: item.amount,
      };
    }),
  ].sort((a, b) => a.time.localeCompare(b.time));

  let running = 0;
  const allTransactions: UnifiedTx[] = rawTxList.map((item) => {
    if (item.type === "IN") {
      running += item.amount;
    } else {
      running -= item.amount;
    }
    return {
      ...item,
      runningBalance: running,
    };
  });

  const drawHeader = (pageNum: number, totalPages: number) => {
    // Top brand stripe (Slate 900)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 4, "F");

    // Left: School & Subtitle
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(school.toUpperCase(), 15, 12.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(75, 85, 99);
    doc.text("Établissement Scolaire Privé • Direction & Comptabilité", 15, 17.5);

    // Right: Date & Meta Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`DATE : ${dateFormatted.toUpperCase()}`, 195, 12.5, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(75, 85, 99);
    doc.text(`Caisse Principale • Page ${pageNum}/${totalPages}`, 195, 17.5, { align: "right" });
    doc.text(`Responsable : ${data.adminName || "Direction"}`, 195, 22, { align: "right" });

    // Center Title Banner (Dedicated, no collision)
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.5);
    doc.rect(15, 24.5, 180, 8, "DF");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text("LIVRE DE CAISSE  —  JOURNAL DES ENTRÉES ET SORTIES", 105, 29.8, { align: "center" });

    // Sub-Banner: Instruction on left + Solde on right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(17, 24, 39);
    doc.text("Entrez les montants dans l'ordre chronologique :", 15, 36.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const netSign = data.netBalance >= 0 ? "+" : "";
    doc.text(`SOLDE DE CAISSE : ${netSign}${data.netBalance.toFixed(2)} DT`, 195, 36.5, { align: "right" });
  };

  // Table Column geometry matching media_1789452942313.png + Solde:
  // 1. Date (16mm) [15 -> 31]
  // 2. Client ou Fournisseur (38mm) [31 -> 69]
  // 3. Description (44mm) [69 -> 113]
  // 4. Sortie de caisse (20mm) [113 -> 133]
  // 5. Entrée de caisse (20mm) [133 -> 153]
  // 6. Type (21mm) [153 -> 174]
  // 7. Solde (21mm) [174 -> 195]
  // Total = 16 + 38 + 44 + 20 + 20 + 21 + 21 = 180mm.
  const COL_X = [15, 31, 69, 113, 133, 153, 174, 195];
  const ROW_HEIGHT = 6.4;
  const ROWS_PER_PAGE = 22;

  const totalPages = Math.max(1, Math.ceil(Math.max(allTransactions.length, 1) / ROWS_PER_PAGE));

  let pageNum = 1;
  drawHeader(pageNum, totalPages);

  let tableStartY = 39.5;
  const HEADER_HEIGHT = 8.5;

  const drawTableHeader = (startY: number) => {
    // Header background: Charcoal Slate
    doc.setFillColor(31, 41, 55);
    doc.rect(15, startY, 180, HEADER_HEIGHT, "F");

    // Header grid borders
    doc.setDrawColor(17, 24, 39);
    doc.setLineWidth(0.5);
    doc.rect(15, startY, 180, HEADER_HEIGHT, "S");
    for (let i = 1; i < COL_X.length - 1; i++) {
      doc.line(COL_X[i], startY, COL_X[i], startY + HEADER_HEIGHT);
    }

    // Header titles in white bold (stacked matching media_1789452942313.png)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.text("Date", 23, startY + 5.4, { align: "center" });
    doc.text("Client ou Fournisseur", 50, startY + 5.4, { align: "center" });
    doc.text("Description", 91, startY + 5.4, { align: "center" });

    // Stacked Sortie de caisse (-)
    doc.setFontSize(6.8);
    doc.text("Sortie de", 123, startY + 3.6, { align: "center" });
    doc.text("caisse (-)", 123, startY + 7.0, { align: "center" });

    // Stacked Entrée de caisse (+)
    doc.text("Entrée de", 143, startY + 3.6, { align: "center" });
    doc.text("caisse (+)", 143, startY + 7.0, { align: "center" });

    doc.setFontSize(7.2);
    doc.text("Type", 163.5, startY + 5.4, { align: "center" });
    doc.text("Solde", 184.5, startY + 5.4, { align: "center" });
  };

  drawTableHeader(tableStartY);

  let currentY = tableStartY + HEADER_HEIGHT;
  let txIndex = 0;

  for (let r = 0; r < ROWS_PER_PAGE; r++) {
    const hasTx = txIndex < allTransactions.length;
    const item = hasTx ? allTransactions[txIndex] : null;

    // Alternating subtle background fill
    const isEven = r % 2 === 0;
    doc.setFillColor(isEven ? 255 : 250, isEven ? 255 : 250, isEven ? 255 : 250);
    doc.rect(15, currentY, 180, ROW_HEIGHT, "F");

    // Grid cell lines (exact accounting book grid)
    doc.setDrawColor(180, 185, 195);
    doc.setLineWidth(0.35);
    doc.rect(15, currentY, 180, ROW_HEIGHT, "S");
    for (let i = 1; i < COL_X.length - 1; i++) {
      doc.line(COL_X[i], currentY, COL_X[i], currentY + ROW_HEIGHT);
    }

    if (item) {
      // 1. Date / Heure
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(75, 85, 99);
      doc.text(item.time || "—", 23, currentY + 4.4, { align: "center" });

      // 2. Client ou Fournisseur
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      const cleanClient = item.client.length > 25 ? item.client.slice(0, 23) + "..." : item.client;
      doc.text(cleanClient, 33, currentY + 4.4);

      // 3. Description
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(55, 65, 81);
      const cleanDesc = item.description.length > 32 ? item.description.slice(0, 30) + "..." : item.description;
      doc.text(cleanDesc, 71, currentY + 4.4);

      // 4. Sortie de caisse
      if (item.type === "OUT") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text(`${item.amount.toFixed(2)} DT`, 131, currentY + 4.4, { align: "right" });
      }

      // 5. Entrée de caisse
      if (item.type === "IN") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text(`${item.amount.toFixed(2)} DT`, 151, currentY + 4.4, { align: "right" });
      }

      // 6. Type (Espèces, Chèque...)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(75, 85, 99);
      const cleanMethod = item.method.length > 14 ? item.method.slice(0, 12) + ".." : item.method;
      doc.text(cleanMethod, 163.5, currentY + 4.4, { align: "center" });

      // 7. Solde
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.setTextColor(0, 0, 0);
      const soldePrefix = item.runningBalance >= 0 ? "" : "-";
      doc.text(`${soldePrefix}${Math.abs(item.runningBalance).toFixed(2)} DT`, 193, currentY + 4.4, {
        align: "right",
      });

      txIndex++;
    }

    currentY += ROW_HEIGHT;
  }

  // ═════════════════════════════════════════════════════════════
  // BOTTOM SECTION : RÉCAPITULATIF & CADRE DE TOTALISATION (IMAGE RÉFÉRENCE 2)
  // ═════════════════════════════════════════════════════════════
  const bottomY = currentY + 4;

  // 1. Right side: The exact 3-row Summary Table from media_1789452880108.png
  // Total des entrées | Total des sorties | Solde total
  const sumBoxX = 110;
  const sumBoxW = 85;
  const sumRowH = 7;

  // Outer border & background
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.8);
  doc.rect(sumBoxX, bottomY, sumBoxW, sumRowH * 3, "DF");

  // Middle horizontal lines
  doc.setLineWidth(0.4);
  doc.line(sumBoxX, bottomY + sumRowH, sumBoxX + sumBoxW, bottomY + sumRowH);
  doc.line(sumBoxX, bottomY + sumRowH * 2, sumBoxX + sumBoxW, bottomY + sumRowH * 2);

  // Vertical separator between label and amount
  doc.line(sumBoxX + 48, bottomY, sumBoxX + 48, bottomY + sumRowH * 3);

  // Row 1: Total des entrées
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("Total des entrées", sumBoxX + 3, bottomY + 4.8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`+${data.totalIncomes.toFixed(2)} DT`, sumBoxX + sumBoxW - 3, bottomY + 4.8, { align: "right" });

  // Row 2: Total des sorties
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("Total des sorties", sumBoxX + 3, bottomY + sumRowH + 4.8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`-${data.totalExpenses.toFixed(2)} DT`, sumBoxX + sumBoxW - 3, bottomY + sumRowH + 4.8, {
    align: "right",
  });

  // Row 3: Solde total (Prominent high contrast row)
  doc.setFillColor(245, 245, 245);
  doc.rect(sumBoxX, bottomY + sumRowH * 2, sumBoxW, sumRowH, "F");
  doc.setLineWidth(0.8);
  doc.rect(sumBoxX, bottomY + sumRowH * 2, sumBoxW, sumRowH, "S");
  doc.line(sumBoxX + 48, bottomY + sumRowH * 2, sumBoxX + 48, bottomY + sumRowH * 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Solde total", sumBoxX + 3, bottomY + sumRowH * 2 + 5);

  doc.setFontSize(10);
  const netPrefix = data.netBalance >= 0 ? "+" : "";
  doc.text(`${netPrefix}${data.netBalance.toFixed(2)} DT`, sumBoxX + sumBoxW - 3, bottomY + sumRowH * 2 + 5, {
    align: "right",
  });

  // 2. Left side: Situation des Espèces et Chèques physiques
  const sitBoxX = 15;
  const sitBoxW = 90;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.5);
  doc.rect(sitBoxX, bottomY, sitBoxW, sumRowH * 3, "DF");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text("SITUATION DES ESPÈCES & CHÈQUES :", sitBoxX + 3, bottomY + 4.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(55, 65, 81);
  doc.text(`• Espèces en caisse physique : ${data.totalCash.toFixed(2)} DT`, sitBoxX + 3, bottomY + 10.5);
  doc.text(
    `• Chèques physiques au classeur : ${data.totalChecks.toFixed(2)} DT (${data.checkCount} chèque(s))`,
    sitBoxX + 3,
    bottomY + 15.5
  );
  doc.text(
    `• Virements / Dépôts bancaires : ${(data.totalTransfers ?? 0).toFixed(2)} DT`,
    sitBoxX + 3,
    bottomY + 19.5
  );

  // ═════════════════════════════════════════════════════════════
  // SIGNATURES & ARRETÉ OFFICIEL DE CAISSE
  // ═════════════════════════════════════════════════════════════
  const sigY = bottomY + sumRowH * 3 + 4;
  const sigH = 25;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.5);
  doc.rect(15, sigY, 180, sigH, "DF");

  // Vertical line separating Caissier and Direction
  doc.line(105, sigY, 105, sigY + sigH);

  // Left signature: Caissier
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Arrêté de Caisse par le Caissier / Secrétaire :", 20, sigY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(75, 85, 99);
  doc.text(`Établi par : ${data.adminName || "Responsable Caisse"}`, 20, sigY + 9.5);
  doc.text("Certifie la régularité et l'exactitude des opérations.", 20, sigY + 13);
  doc.setDrawColor(156, 163, 175);
  doc.line(20, sigY + 21, 95, sigY + 21);

  // Right signature: Direction
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Validation & Visa Direction Générale :", 110, sigY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(75, 85, 99);
  doc.text(`Contrôle journalier arrêté le ${dateFormatted}`, 110, sigY + 9.5);
  doc.text("Signature et cachet officiel de l'établissement.", 110, sigY + 13);
  doc.line(110, sigY + 21, 185, sigY + 21);

  // Bottom footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text(
    `Livre de caisse officiel • Document comptable de référence • Établissement : ${school} • SnapSchool Finance`,
    105,
    278,
    { align: "center" }
  );

  const cleanSchool = school.replace(/[^a-zA-Z0-9]/g, "_");
  const cleanDate = dateFormatted.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Bordereau_Caisse_${cleanSchool}_${cleanDate}.pdf`;

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, filename };
}

