import { jsPDF } from "jspdf";
import { readFile } from "node:fs/promises";
import path from "node:path";

function formatAmount(value: number) {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} TND`;
}

type ReceiptLine = { label: string; amount: number };
type ReceiptPdfInput = {
  school: { schoolName: string; address: string; phone: string } | null;
  student: { name: string; surname: string; class: { name: string } | null };
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
  const left = 20;
  let y = 49;
  const header = () => {
    doc.setFillColor(21, 75, 164);
    doc.rect(0, 0, width, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(23, 43, 76);
    doc.setFont(nameFont, "normal");
    doc.text(school?.schoolName || "SnapSchool", left, 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(92, 106, 124);
    if (school?.address) doc.text(school.address, left, 25);
    if (school?.phone) doc.text(school.phone, left, 30);
    doc.setDrawColor(217, 225, 235);
    doc.line(left, 35, width - left, 35);
  };
  header();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(23, 43, 76);
  doc.text("REÇU DE PAIEMENT", left, y);
  y += 11;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(62, 74, 91);
  const paymentDate = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Tunis",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(receipt.paidAt);
  doc.text(`Date : ${paymentDate}`, left, y);
  doc.text(`Mode : ${receipt.paymentMethod}`, width - left, y, {
    align: "right",
  });
  y += 8;
  doc.text("Élève :", left, y);
  doc.setFont(nameFont, "normal");
  doc.text(`${student.name} ${student.surname}`, left + 14, y);
  doc.setFont("helvetica", "normal");
  if (student.class?.name)
    doc.text(`Classe : ${student.class.name}`, width - left, y, {
      align: "right",
    });
  y += 14;
  doc.setFillColor(241, 246, 252);
  doc.roundedRect(left, y - 7, width - left * 2, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.text("DÉTAIL DU PAIEMENT", left + 4, y);
  doc.text("MONTANT", width - left - 4, y, { align: "right" });
  y += 11;
  doc.setFont("helvetica", "normal");
  for (const line of lines) {
    if (y > 257) {
      doc.addPage();
      header();
      y = 48;
    }
    doc.text(line.label, left + 4, y);
    doc.text(formatAmount(line.amount), width - left - 4, y, {
      align: "right",
    });
    doc.setDrawColor(235, 239, 244);
    doc.line(left + 4, y + 3, width - left - 4, y + 3);
    y += 11;
  }
  if (y > 250) {
    doc.addPage();
    header();
    y = 48;
  }
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(21, 75, 164);
  doc.text("TOTAL REÇU", left + 4, y);
  doc.text(formatAmount(receipt.amount), width - left - 4, y, {
    align: "right",
  });
  y += 17;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(115, 127, 144);
  doc.text(`Référence : ${receipt.id}`, left, y);
  doc.text(
    "Document établi à partir du paiement enregistré dans SnapSchool.",
    left,
    y + 6,
  );
  const pdf = new Uint8Array(doc.output("arraybuffer"));
  const filename = `Recu-${paymentDate.replaceAll("/", "-")}-${receipt.id.slice(-8)}.pdf`;
  return { pdf, filename };
}
