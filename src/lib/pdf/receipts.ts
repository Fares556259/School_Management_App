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
  // 1. Top Decorative Brand Bar
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(0, 0, 210, 4, "F");

  // 2. School Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text(school.toUpperCase(), 15, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Établissement Scolaire Privé • Quittance & Recouvrement", 15, 17);

  // Top Right Meta Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229);
  doc.text(`QUITTANCE N° ${data.receiptNumber}`, 195, 12, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date : ${formatDateTime(data.paymentDate)} • Mode : ${methodLabel}`, 195, 17, { align: "right" });

  // 3. Document Title Banner
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(15, 21, 180, 7, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229);
  doc.text("VOLET N° 1 : EXEMPLAIRE PARENT / ÉLÈVE — REÇU DE SCOLARITÉ", 105, 25.5, { align: "center" });

  // 4. Beneficiary and Parent Info Container
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, 31, 180, 31, 2, 2, "DF");

  // Left column: Student details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("ÉLÈVE CONCERNÉ", 20, 37);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(data.studentName, 20, 43);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Classe : ${data.studentClass || "Non assignée"}  •  Période : ${data.periodFrench}`, 20, 49);
  doc.text(`Règlement : ${methodLabel}`, 20, 55);

  // Right column: Parent details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("PARENT & ENCAISSEMENT", 110, 37);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(data.parentName, 110, 43);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tél : ${data.parentPhone || "Non renseigné"}  •  Reçu par : ${data.adminName || "Direction"}`, 110, 49);
  doc.text(
    `Statut comptable : ${isFullyPaid ? "Soldé entièrement (0 DT restant)" : `Partiel (Reste dû : ${remaining.toFixed(2)} DT)`}`,
    110,
    55
  );

  // 5. Summary row
  doc.setFillColor(245, 247, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(15, 65, 180, 17, 2, 2, "DF");

  if (isFullyPaid) {
    doc.setFillColor(209, 250, 229); // Emerald 100
    doc.roundedRect(20, 68.5, 62, 10, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(5, 150, 105);
    doc.text("SOLDE ENTIÈREMENT RÉGLÉ", 51, 75, { align: "center" });
  } else {
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.roundedRect(20, 68.5, 68, 10, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`PAIEMENT PARTIEL (DÛ: ${remaining.toFixed(2)} DT)`, 54, 75, { align: "center" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL VERSÉ & ACQUITTÉ :", 145, 71.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.text(`${data.amountPaid.toFixed(2)} DT`, 190, 78.5, { align: "right" });

  // 6. Stamp & Signature
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.8);
  doc.roundedRect(135, 85, 60, 24, 2, 2, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  const truncatedSchool = school.length > 22 ? school.slice(0, 20) + "..." : school;
  doc.text(truncatedSchool.toUpperCase(), 165, 91, { align: "center" });
  doc.setFontSize(8.5);
  doc.text("• PAYÉ & ACQUITTÉ •", 165, 97, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`Le ${formatDate(data.paymentDate)} • Visa Direction`, 165, 103, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Visa & Signature Administration :", 20, 91);
  doc.setDrawColor(203, 213, 225);
  doc.line(20, 105, 80, 105);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
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
  doc.setTextColor(isFullyPaid ? 5 : 180, isFullyPaid ? 150 : 83, isFullyPaid ? 105 : 9);
  doc.text(`Solde restant dû : ${remaining.toFixed(2)} DT (${isFullyPaid ? "Soldé" : "Impayé"})`, 190, v2Y + 52, {
    align: "right",
  });

  // CHECK / PIECE ATTACHMENT BOX
  const checkY = v2Y + 59;
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(180, 190, 205);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.roundedRect(15, checkY, 180, 23, 2, 2, "DF");
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(79, 70, 229);
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

  const drawHeader = (pageNum: number) => {
    // Top brand stripe
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 4, "F");

    // School header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(school.toUpperCase(), 15, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Direction Financière & Comptabilité • Bordereau Journalier de Caisse", 15, 17);

    // Top Right Meta Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("CLÔTURE JOURNALIÈRE DE CAISSE", 195, 12, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Journée du ${dateFormatted} • Page ${pageNum}`, 195, 17, { align: "right" });

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 20, 195, 20);
  };

  let pageNum = 1;
  drawHeader(pageNum);

  // Document Title Banner
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(15, 23, 180, 7, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `ÉTAT DE CAISSE & SITUATION FINANCIÈRE DU ${dateFormatted.toUpperCase()}`,
    105,
    27.5,
    { align: "center" }
  );

  // 3 KPI Cards (Y = 33, height 18mm)
  const cardY = 33;
  const cardW = 57;
  const cardH = 18;

  // Card 1: Total Recettes (Inflows)
  doc.setFillColor(240, 253, 244); // Emerald 50
  doc.setDrawColor(167, 243, 208); // Emerald 200
  doc.roundedRect(15, cardY, cardW, cardH, 2, 2, "DF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL RECETTES (+)", 19, cardY + 5.5);
  doc.setFontSize(12);
  doc.setTextColor(5, 150, 105); // Emerald 600
  doc.text(`+${data.totalIncomes.toFixed(2)} DT`, 19, cardY + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.inflowItems.length} encaissement(s)`, 19, cardY + 16);

  // Card 2: Total Dépenses (Outflows)
  doc.setFillColor(254, 242, 242); // Rose 50
  doc.setDrawColor(254, 202, 202); // Rose 200
  doc.roundedRect(76.5, cardY, cardW, cardH, 2, 2, "DF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL DÉPENSES (-)", 80.5, cardY + 5.5);
  doc.setFontSize(12);
  doc.setTextColor(225, 29, 72); // Rose 600
  doc.text(`-${data.totalExpenses.toFixed(2)} DT`, 80.5, cardY + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.outflowItems.length} décaissement(s)`, 80.5, cardY + 16);

  // Card 3: Solde Net (Net Balance)
  const isNetPositive = data.netBalance >= 0;
  doc.setFillColor(isNetPositive ? 238 : 254, isNetPositive ? 242 : 242, isNetPositive ? 255 : 242);
  doc.setDrawColor(isNetPositive ? 199 : 254, isNetPositive ? 210 : 202, isNetPositive ? 254 : 202);
  doc.roundedRect(138, cardY, cardW, cardH, 2, 2, "DF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("SOLDE NET DU JOUR (=)", 142, cardY + 5.5);
  doc.setFontSize(12);
  doc.setTextColor(isNetPositive ? 79 : 225, isNetPositive ? 70 : 29, isNetPositive ? 229 : 72);
  doc.text(`${isNetPositive ? "+" : ""}${data.netBalance.toFixed(2)} DT`, 142, cardY + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(isNetPositive ? "Excédent de caisse" : "Déficit journalier", 142, cardY + 16);

  // Payment Breakdown Bar (Cash vs Checks)
  const breakY = 54;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, breakY, 180, 11, 2, 2, "DF");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("VENTILATION PAR MODE DE PAIEMENT :", 19, breakY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Espèces :", 20, breakY + 8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.totalCash.toFixed(2)} DT`, 35, breakY + 8.5);

  doc.setFont("helvetica", "normal");
  doc.text("Chèques au classeur :", 75, breakY + 8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.totalChecks.toFixed(2)} DT (${data.checkCount} chq)`, 108, breakY + 8.5);

  doc.setFont("helvetica", "normal");
  doc.text("Virements :", 155, breakY + 8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`${(data.totalTransfers ?? 0).toFixed(2)} DT`, 172, breakY + 8.5);

  let currentY = 70;

  const checkAddPage = (neededHeight: number) => {
    if (currentY + neededHeight > 248) {
      doc.addPage();
      pageNum++;
      drawHeader(pageNum);
      currentY = 28;
    }
  };

  // Section 1: Inflow Table
  checkAddPage(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105);
  doc.text(`1. RECETTES DU JOUR — ENTRÉES EN CAISSE (${data.inflowItems.length})`, 15, currentY);
  currentY += 3.5;

  // Table header
  doc.setFillColor(30, 41, 59);
  doc.rect(15, currentY, 180, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("HEURE", 18, currentY + 4.2);
  doc.text("LIBELLÉ / ÉLÈVE", 35, currentY + 4.2);
  doc.text("CLASSE / CATÉGORIE", 95, currentY + 4.2);
  doc.text("MODE & DÉTAILS", 140, currentY + 4.2);
  doc.text("MONTANT", 192, currentY + 4.2, { align: "right" });
  currentY += 6;

  if (data.inflowItems.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(15, currentY, 180, 7, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(15, currentY + 7, 195, currentY + 7);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Aucune recette enregistrée pour cette journée.", 105, currentY + 4.8, { align: "center" });
    currentY += 7;
  } else {
    data.inflowItems.forEach((item, index) => {
      checkAddPage(7);
      const isEven = index % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(15, currentY, 180, 6.5, "F");
      doc.setDrawColor(241, 245, 249);
      doc.line(15, currentY + 6.5, 195, currentY + 6.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(item.time || "—", 18, currentY + 4.5);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      const cleanLabel = item.label.length > 34 ? item.label.slice(0, 32) + "..." : item.label;
      doc.text(cleanLabel, 35, currentY + 4.5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const cleanCat = (item.categoryOrClass || "Scolarité").slice(0, 24);
      doc.text(cleanCat, 95, currentY + 4.5);

      const modeStr = item.checkDetails ? `Chq ${item.checkDetails}` : (item.method || "Espèces");
      doc.text(modeStr.slice(0, 24), 140, currentY + 4.5);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(5, 150, 105);
      doc.text(`+${item.amount.toFixed(2)} DT`, 192, currentY + 4.5, { align: "right" });

      currentY += 6.5;
    });
  }

  currentY += 4;

  // Section 2: Outflow Table
  checkAddPage(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(225, 29, 72);
  doc.text(`2. DÉPENSES DU JOUR — SORTIES DE CAISSE (${data.outflowItems.length})`, 15, currentY);
  currentY += 3.5;

  // Table header
  doc.setFillColor(30, 41, 59);
  doc.rect(15, currentY, 180, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("HEURE", 18, currentY + 4.2);
  doc.text("LIBELLÉ / MOTIF", 35, currentY + 4.2);
  doc.text("CATÉGORIE", 95, currentY + 4.2);
  doc.text("BÉNÉFICIAIRE / MODE", 140, currentY + 4.2);
  doc.text("MONTANT", 192, currentY + 4.2, { align: "right" });
  currentY += 6;

  if (data.outflowItems.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(15, currentY, 180, 7, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(15, currentY + 7, 195, currentY + 7);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Aucune dépense enregistrée pour cette journée.", 105, currentY + 4.8, { align: "center" });
    currentY += 7;
  } else {
    data.outflowItems.forEach((item, index) => {
      checkAddPage(7);
      const isEven = index % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(15, currentY, 180, 6.5, "F");
      doc.setDrawColor(241, 245, 249);
      doc.line(15, currentY + 6.5, 195, currentY + 6.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(item.time || "—", 18, currentY + 4.5);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      const cleanLabel = item.label.length > 34 ? item.label.slice(0, 32) + "..." : item.label;
      doc.text(cleanLabel, 35, currentY + 4.5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const cleanCat = (item.categoryOrClass || "Général").slice(0, 24);
      doc.text(cleanCat, 95, currentY + 4.5);

      const modeStr = item.method || "Espèces";
      doc.text(modeStr.slice(0, 24), 140, currentY + 4.5);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72);
      doc.text(`-${item.amount.toFixed(2)} DT`, 192, currentY + 4.5, { align: "right" });

      currentY += 6.5;
    });
  }

  // Signatures & Clôture box
  checkAddPage(38);
  const sigY = Math.max(currentY + 6, 238);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, sigY, 180, 28, 2, 2, "DF");

  // Left signature: Caissier
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Arrêté de Caisse par le Caissier / Secrétaire :", 20, sigY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Établi par : ${data.adminName || "Responsable Caisse"}`, 20, sigY + 9.5);
  doc.text("Certifie l'exactitude des espèces et chèques en caisse physique.", 20, sigY + 13.5);
  doc.setDrawColor(203, 213, 225);
  doc.line(20, sigY + 23, 85, sigY + 23);

  // Right signature: Direction
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Validation & Visa Direction Générale :", 115, sigY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Contrôle journalier arrêté le ${dateFormatted}`, 115, sigY + 9.5);
  doc.text("Signature et cachet officiel de l'établissement.", 115, sigY + 13.5);
  doc.line(115, sigY + 23, 185, sigY + 23);

  // Bottom footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Bordereau journalier officiel de caisse • Établissement : ${school} • Édité via SnapSchool Finance`,
    15,
    273
  );

  const cleanSchool = school.replace(/[^a-zA-Z0-9]/g, "_");
  const cleanDate = dateFormatted.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Bordereau_Caisse_${cleanSchool}_${cleanDate}.pdf`;

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, filename };
}

