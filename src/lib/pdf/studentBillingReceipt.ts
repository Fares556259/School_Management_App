import { jsPDF } from "jspdf";
import { readFile } from "node:fs/promises";
import path from "node:path";

function formatAmount(value: number) {
  const amount = value
    .toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })
    .replace(/[\u00a0\u202f]/g, " ");
  return `${amount} TND`;
}

type ReceiptLine = { label: string; amount: number };
type ReceiptPdfInput = {
  school: { schoolName: string; address: string; phone: string } | null;
  student: {
    name: string;
    surname: string;
    class: { name: string } | null;
    parent?: {
      name: string;
      surname: string;
      phone: string;
      address: string;
    } | null;
  };
  receipt: { id: string; amount: number; paymentMethod: string; paidAt: Date };
  lines: ReceiptLine[];
};

export async function renderStudentBillingReceiptPdf({
  school,
  student,
  receipt,
  lines,
}: ReceiptPdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  let arabicFont = "times";
  try {
    const font = await readFile(
      path.join(process.cwd(), "public/fonts/Amiri-Regular.ttf"),
    );
    doc.addFileToVFS("Amiri-Regular.ttf", font.toString("base64"));
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    arabicFont = "Amiri";
  } catch {
    // The receipt remains downloadable without the optional Arabic font.
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const frameLeft = 12;
  const frameRight = pageWidth - 12;
  const cutX = 87;
  const mainLeft = 96;
  const mainRight = pageWidth - 19;
  const receiptNumber = receipt.id.slice(-10).toUpperCase();
  const studentName = `${student.name} ${student.surname}`;
  const parentName = student.parent
    ? `${student.parent.name} ${student.parent.surname}`
    : "";
  const paymentDate = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Tunis",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(receipt.paidAt);
  const ink: [number, number, number] = [0, 0, 0];
  const lineColor: [number, number, number] = [150, 150, 150];

  const writeName = (value: string, x: number, y: number, maxWidth: number, size = 10) => {
    doc.setFont(/[\u0600-\u06FF]/.test(value) ? arabicFont : "times", "normal");
    doc.setFontSize(size);
    doc.text(doc.splitTextToSize(value, maxWidth)[0] || "", x, y);
    doc.setFont("times", "normal");
  };

  const field = (label: string, value: string, x: number, y: number, maxWidth: number) => {
    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...ink);
    doc.text(label, x, y);
    doc.setTextColor(...ink);
    writeName(value, x, y + 6, maxWidth, 10);
  };

  const drawFrame = () => {
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);
    doc.rect(frameLeft, 12, frameRight - frameLeft, pageHeight - 24);
    doc.setDrawColor(...lineColor);
    doc.setLineDashPattern([1.7, 1.7], 0);
    doc.line(cutX, 12, cutX, pageHeight - 12);
    doc.setLineDashPattern([], 0);
  };

  drawFrame();

  // The school keeps the left talon after cutting along the dotted line.
  const stubLeft = 18;
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...ink);
  doc.text("TALON À CONSERVER", stubLeft, 25);
  doc.setFontSize(8);
  doc.setTextColor(...ink);
  doc.text("PAR L'ÉCOLE", stubLeft, 31);
  doc.setDrawColor(...lineColor);
  doc.line(stubLeft, 36, cutX - 6, 36);
  field("REÇU N°", receiptNumber, stubLeft, 44, 62);
  field("REMIS POUR L'ÉLÈVE", studentName, stubLeft, 60, 62);
  if (parentName) field("PARENT / TUTEUR ENREGISTRÉ", parentName, stubLeft, 76, 62);
  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...ink);
  doc.text("OBJET", stubLeft, 96);
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...ink);
  const stubPurpose = lines.map((line) => line.label).join(" ; ") || "Paiement";
  doc.text(doc.splitTextToSize(stubPurpose, 62).slice(0, 3), stubLeft, 103);
  doc.setDrawColor(...lineColor);
  doc.line(stubLeft, 129, cutX - 6, 129);
  field("MONTANT REÇU", formatAmount(receipt.amount), stubLeft, 139, 62);
  field("DATE", paymentDate, stubLeft, 155, 62);
  field("MODE DE PAIEMENT", receipt.paymentMethod, stubLeft, 171, 62);
  doc.setFont("times", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...ink);
  doc.text("Cachet / signature", stubLeft, 193);
  doc.setDrawColor(...lineColor);
  doc.line(stubLeft + 31, 193, cutX - 6, 193);

  // The right side is handed to the family.
  doc.setTextColor(...ink);
  writeName(school?.schoolName || "SnapSchool", mainLeft, 25, 130, 14);
  doc.setFontSize(8.5);
  doc.setTextColor(...ink);
  if (school?.address) doc.text(doc.splitTextToSize(school.address, 130)[0], mainLeft, 32);
  if (school?.phone) doc.text(school.phone, mainLeft, 38);
  doc.setDrawColor(...lineColor);
  doc.rect(mainRight - 40, 19, 40, 25);
  doc.setFont("times", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...ink);
  doc.text("CACHET DE L'ÉCOLE", mainRight - 20, 24, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...ink);
  doc.text("REÇU DE PAIEMENT", mainLeft, 55);
  doc.setFontSize(9);
  doc.setTextColor(...ink);
  doc.text(`N° ${receiptNumber}`, mainRight, 55, { align: "right" });
  doc.setDrawColor(...lineColor);
  doc.line(mainLeft, 59, mainRight, 59);
  field("DATE DU VERSEMENT", paymentDate, mainLeft, 67, 54);
  field("MODE DE PAIEMENT", receipt.paymentMethod, mainLeft + 74, 67, 62);
  field("ÉLÈVE", studentName, mainLeft, 83, 118);
  if (student.class?.name) field("CLASSE", student.class.name, mainRight - 45, 83, 45);
  if (parentName) {
    field("PARENT / TUTEUR ENREGISTRÉ", parentName, mainLeft, 99, 118);
    if (student.parent?.phone) field("TÉLÉPHONE", student.parent.phone, mainRight - 62, 99, 62);
  }

  const tableTop = parentName ? 115 : 99;
  doc.setDrawColor(...lineColor);
  doc.line(mainLeft, tableTop, mainRight, tableTop);
  doc.line(mainLeft, tableTop + 9, mainRight, tableTop + 9);
  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...ink);
  doc.text("OBJET DU VERSEMENT", mainLeft + 4, tableTop + 6);
  doc.text("MONTANT", mainRight - 4, tableTop + 6, { align: "right" });
  let rowY = tableTop + 14;
  let firstPageCount = 0;
  for (const line of lines) {
    if (rowY > 150) break;
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...ink);
    doc.text(doc.splitTextToSize(line.label, 125)[0], mainLeft + 4, rowY);
    doc.setFont("times", "bold");
    doc.text(formatAmount(line.amount), mainRight - 4, rowY, { align: "right" });
    doc.setDrawColor(...lineColor);
    doc.line(mainLeft + 4, rowY + 2, mainRight - 4, rowY + 2);
    rowY += 8;
    firstPageCount++;
  }
  if (firstPageCount < lines.length) {
    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...ink);
    doc.text(`Détail poursuivi en page suivante (${lines.length - firstPageCount} ligne(s)).`, mainLeft + 4, 155);
  }
  doc.setDrawColor(...lineColor);
  doc.line(mainLeft, 160, mainRight, 160);
  doc.line(mainLeft, 177, mainRight, 177);
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text("TOTAL REÇU", mainLeft + 5, 171);
  doc.setFontSize(14);
  doc.setTextColor(...ink);
  doc.text(formatAmount(receipt.amount), mainRight - 5, 171, { align: "right" });
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ink);
  doc.text("Reçu établi par :", mainLeft, 188);
  doc.setDrawColor(...lineColor);
  doc.line(mainLeft + 30, 188, mainLeft + 91, 188);
  doc.text("Signature :", mainRight - 55, 188);
  doc.line(mainRight - 34, 188, mainRight, 188);

  // Extra items continue on a full-width page; the original talon stays on page one.
  let index = firstPageCount;
  while (index < lines.length) {
    doc.addPage("a4", "landscape");
    doc.setDrawColor(...lineColor);
    doc.line(20, 13, pageWidth - 20, 13);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...ink);
    doc.text("Suite du reçu de paiement", 20, 24);
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    doc.text(`N° ${receiptNumber}`, pageWidth - 20, 24, { align: "right" });
    doc.line(20, 34, pageWidth - 20, 34);
    doc.line(20, 44, pageWidth - 20, 44);
    doc.setFontSize(8);
    doc.setTextColor(...ink);
    doc.text("OBJET DU VERSEMENT", 24, 40.5);
    doc.text("MONTANT", pageWidth - 24, 40.5, { align: "right" });
    let continuationY = 52;
    while (index < lines.length && continuationY < 176) {
      const line = lines[index];
      doc.setFont("times", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(doc.splitTextToSize(line.label, 190)[0], 24, continuationY);
      doc.setFont("times", "bold");
      doc.text(formatAmount(line.amount), pageWidth - 24, continuationY, { align: "right" });
      doc.setDrawColor(...lineColor);
      doc.line(24, continuationY + 3, pageWidth - 24, continuationY + 3);
      continuationY += 9;
      index++;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont("times", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...ink);
    if (page === 1) {
      doc.text(`Référence complète : ${receipt.id}`, mainLeft, 195);
    } else {
      doc.text(`Référence complète : ${receipt.id}`, 20, pageHeight - 13);
    }
    doc.text(`${page} / ${pageCount}`, pageWidth - 20, pageHeight - 7, { align: "right" });
  }

  const pdf = new Uint8Array(doc.output("arraybuffer"));
  const filename = `Recu-${paymentDate.replaceAll("/", "-")}-${receipt.id.slice(-8)}.pdf`;
  return { pdf, filename };
}
