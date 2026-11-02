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
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let nameFont = "helvetica";
  try {
    const font = await readFile(
      path.join(process.cwd(), "public/fonts/Amiri-Regular.ttf"),
    );
    doc.addFileToVFS("Amiri-Regular.ttf", font.toString("base64"));
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    nameFont = "Amiri";
  } catch {
    // Keep the receipt downloadable if the optional font asset is unavailable.
  }
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const left = 20;
  const right = width - left;
  const receiptNumber = receipt.id.slice(-10).toUpperCase();
  const writeName = (value: string, x: number, position: number, maxWidth?: number) => {
    doc.setFont(/[\u0600-\u06FF]/.test(value) ? nameFont : "helvetica", "normal");
    doc.text(maxWidth ? doc.splitTextToSize(value, maxWidth)[0] : value, x, position);
    doc.setFont("helvetica", "normal");
  };
  let y = 49;
  const header = () => {
    doc.setFillColor(21, 75, 164);
    doc.rect(0, 0, width, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(23, 43, 76);
    writeName(school?.schoolName || "SnapSchool", left, 18, 110);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(92, 106, 124);
    if (school?.address) doc.text(school.address, left, 25);
    if (school?.phone) doc.text(school.phone, left, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(21, 75, 164);
    doc.text("REÇU DE PAIEMENT", right, 18, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(92, 106, 124);
    doc.text(`N° ${receiptNumber}`, right, 25, { align: "right" });
    doc.setDrawColor(217, 225, 235);
    doc.line(left, 35, width - left, 35);
  };
  header();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(23, 43, 76);
  doc.text("Reçu de paiement", left, y);
  y += 8;
  const paymentDate = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Tunis",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(receipt.paidAt);
  doc.setFillColor(240, 246, 253);
  doc.roundedRect(left, y, width - left * 2, 28, 2.5, 2.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(92, 106, 124);
  doc.text("MONTANT REÇU", left + 6, y + 7);
  doc.text("DATE DE PAIEMENT", right - 5, y + 7, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(21, 75, 164);
  doc.text(formatAmount(receipt.amount), left + 6, y + 21);
  doc.setFontSize(10);
  doc.setTextColor(23, 43, 76);
  doc.text(paymentDate, right - 5, y + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(92, 106, 124);
  doc.text(`Mode : ${receipt.paymentMethod}`, right - 5, y + 22, {
    align: "right",
  });
  y += 38;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(92, 106, 124);
  doc.text("ÉLÈVE", left, y);
  if (student.class?.name)
    doc.text("CLASSE", right, y, { align: "right" });
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(23, 43, 76);
  writeName(`${student.name} ${student.surname}`, left, y, 120);
  if (student.class?.name) {
    doc.setFont("helvetica", "bold");
    doc.text(student.class.name, right, y, { align: "right" });
  }
  y += 12;
  if (student.parent) {
    const parent = student.parent;
    const addressLines = parent.address
      ? doc.splitTextToSize(parent.address, width - left * 2 - 12).slice(0, 2)
      : [];
    const boxHeight = 24 + addressLines.length * 5;
    doc.setFillColor(247, 249, 252);
    doc.setDrawColor(224, 231, 239);
    doc.roundedRect(left, y, width - left * 2, boxHeight, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(48, 61, 82);
    doc.text("PARENT / TUTEUR ENREGISTRÉ", left + 5, y + 7);
    doc.setFontSize(11);
    writeName(`${parent.name} ${parent.surname}`, left + 5, y + 14, 120);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(83, 97, 116);
    doc.text(`Téléphone : ${parent.phone}`, left + 5, y + 21);
    if (addressLines.length) {
      doc.setFont(/[\u0600-\u06FF]/.test(parent.address) ? nameFont : "helvetica", "normal");
      doc.text(addressLines, left + 5, y + 27);
    }
    y += boxHeight + 11;
  } else {
    y += 3;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(23, 43, 76);
  doc.text("Détail du paiement", left, y);
  y += 8;
  doc.setFillColor(241, 246, 252);
  doc.roundedRect(left, y - 7, width - left * 2, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(92, 106, 124);
  doc.text("DÉSIGNATION", left + 4, y);
  doc.text("MONTANT", width - left - 4, y, { align: "right" });
  y += 11;
  doc.setFont("helvetica", "normal");
  for (const line of lines) {
    if (y > 257) {
      doc.addPage();
      header();
      y = 48;
    }
    doc.setFontSize(10);
    doc.setTextColor(23, 43, 76);
    doc.text(line.label, left + 4, y);
    doc.setFont("helvetica", "bold");
    doc.text(formatAmount(line.amount), width - left - 4, y, {
      align: "right",
    });
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(235, 239, 244);
    doc.line(left + 4, y + 3, width - left - 4, y + 3);
    y += 11;
  }
  if (y > 250) {
    doc.addPage();
    header();
    y = 48;
  }
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(23, 43, 76);
  doc.text("TOTAL REÇU", left + 4, y);
  doc.setFontSize(14);
  doc.setTextColor(21, 75, 164);
  doc.text(formatAmount(receipt.amount), width - left - 4, y, {
    align: "right",
  });
  // A detachable paper record is useful when the school keeps a physical ledger.
  let stubY = Math.max(y + 14, 212);
  if (stubY + 49 > height - 29) {
    doc.addPage();
    header();
    stubY = 51;
  }
  doc.setDrawColor(152, 165, 183);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(left, stubY, right, stubY);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(115, 127, 144);
  doc.text("DÉTACHER ICI", right, stubY - 2, { align: "right" });
  doc.setDrawColor(217, 225, 235);
  doc.roundedRect(left, stubY + 4, width - left * 2, 45, 2, 2, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(23, 43, 76);
  doc.text("TALON À CONSERVER PAR L'ÉCOLE", left + 5, stubY + 11);
  doc.setFontSize(8);
  doc.setTextColor(21, 75, 164);
  doc.text(`N° ${receiptNumber}`, right - 5, stubY + 11, { align: "right" });
  doc.setDrawColor(235, 239, 244);
  doc.line(left + 5, stubY + 15, right - 5, stubY + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(62, 74, 91);
  doc.text("Élève :", left + 5, stubY + 22);
  writeName(`${student.name} ${student.surname}`, left + 20, stubY + 22, 88);
  if (student.parent) {
    doc.text("Parent :", left + 5, stubY + 29);
    writeName(`${student.parent.name} ${student.parent.surname}`, left + 20, stubY + 29, 88);
  }
  doc.text("Objet :", left + 5, stubY + 36);
  const purpose = lines.map((line) => line.label).join(" ; ") || "Paiement";
  const purposeLines = doc.splitTextToSize(purpose, 88);
  doc.text(`${purposeLines[0]}${purposeLines.length > 1 ? "..." : ""}`, left + 20, stubY + 36);
  doc.setFont("helvetica", "bold");
  doc.text(formatAmount(receipt.amount), left + 5, stubY + 44);
  doc.setFont("helvetica", "normal");
  doc.text(`${paymentDate} · ${receipt.paymentMethod}`, left + 44, stubY + 44);
  doc.setDrawColor(217, 225, 235);
  doc.rect(right - 48, stubY + 19, 43, 25, "S");
  doc.setFontSize(7);
  doc.setTextColor(115, 127, 144);
  doc.text("CACHET / SIGNATURE", right - 26.5, stubY + 23, { align: "center" });
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(217, 225, 235);
    doc.line(left, height - 27, right, height - 27);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(115, 127, 144);
    doc.text(`Référence : ${receipt.id}`, left, height - 20);
    doc.text(
      "Document établi à partir du paiement enregistré dans SnapSchool.",
      left,
      height - 14,
    );
    doc.text(`${page} / ${pageCount}`, right, height - 14, { align: "right" });
  }
  const pdf = new Uint8Array(doc.output("arraybuffer"));
  const filename = `Recu-${paymentDate.replaceAll("/", "-")}-${receipt.id.slice(-8)}.pdf`;
  return { pdf, filename };
}
