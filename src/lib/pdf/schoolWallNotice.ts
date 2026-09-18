import { jsPDF } from "jspdf";

export type NoticeCategory =
  | "COMMUNIQUE"
  | "AVIS_PARENTS"
  | "NOTE_INTERNE"
  | "DISCIPLINE"
  | "EXAMENS"
  | "EVENEMENT"
  | "URGENT";

export interface SchoolWallNoticeData {
  schoolName: string;
  title: string;
  category?: NoticeCategory | string;
  bodyText: string;
  importantNotice?: string;
  targetAudience?: string;
  dateStr?: string;
  referenceNumber?: string;
  signatory?: string;
  location?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  COMMUNIQUE: "★ COMMUNIQUÉ OFFICIEL ★",
  AVIS_PARENTS: "★ AVIS AUX PARENTS D'ÉLÈVES ★",
  NOTE_INTERNE: "★ NOTE DE SERVICE INTERNE ★",
  DISCIPLINE: "★ AVIS DE DISCIPLINE & RÈGLEMENT ★",
  EXAMENS: "★ CALENDRIER & CONSIGNES D'EXAMENS ★",
  EVENEMENT: "★ ÉVÉNEMENT & ACTIVITÉS PÉDAGOGIQUES ★",
  URGENT: "⚠️ AVIS URGENT & IMPORTANT ⚠️",
};

/**
 * Generate a high-resolution, institutional A4 portrait PDF notice designed
 * specifically to be printed and hung on the school wall / entrance / notice boards.
 */
export async function generateSchoolWallNoticePdf(
  data: SchoolWallNoticeData
): Promise<{ buffer: Buffer; filename: string }> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const school = (data.schoolName || "SnapSchool Academy").trim();
  const dateStr = data.dateStr || new Date().toLocaleDateString("fr-FR");
  const refNum =
    data.referenceNumber ||
    `REF: AVIS-${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(
      100 + Math.random() * 900
    )}`;
  const location = data.location || "Tunis";
  const signatory = data.signatory || "La Direction de l'Établissement";

  const categoryKey = (data.category || "COMMUNIQUE").toUpperCase();
  const categoryLabel = CATEGORY_LABELS[categoryKey] || `★ ${data.category?.toUpperCase() || "AVIS OFFICIEL"} ★`;

  // ═════════════════════════════════════════════════════════════
  // 1. Double Outer Framing (Official Architectural Border)
  // ═════════════════════════════════════════════════════════════
  doc.setDrawColor(15, 23, 42); // Navy Slate 900
  doc.setLineWidth(1.0);
  doc.rect(8, 8, 194, 281); // Outer border

  doc.setDrawColor(148, 163, 184); // Slate 400
  doc.setLineWidth(0.35);
  doc.rect(10.5, 10.5, 189, 276); // Inner thin border

  // Corner decorative marks
  doc.setFillColor(15, 23, 42);
  doc.rect(8, 8, 4, 4, "F");
  doc.rect(198, 8, 4, 4, "F");
  doc.rect(8, 285, 4, 4, "F");
  doc.rect(198, 285, 4, 4, "F");

  // ═════════════════════════════════════════════════════════════
  // 2. Official Institutional Header Banner
  // ═════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(school.toUpperCase(), 105, 22, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("ÉTABLISSEMENT D'ENSEIGNEMENT & DE FORMATION • DIRECTION PÉDAGOGIQUE", 105, 27, { align: "center" });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(20, 31, 190, 31);

  // ═════════════════════════════════════════════════════════════
  // 3. Category Badge & Reference Line
  // ═════════════════════════════════════════════════════════════
  const isUrgent = categoryKey === "URGENT" || categoryKey === "DISCIPLINE";
  if (isUrgent) {
    doc.setFillColor(185, 28, 28); // Dark Red
  } else {
    doc.setFillColor(15, 23, 42); // Navy
  }

  doc.roundedRect(35, 36, 140, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(categoryLabel, 105, 42.5, { align: "center" });

  // Metadata: Ref left, Date right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(refNum, 20, 52);
  doc.text(`Date d'affichage : ${dateStr}`, 190, 52, { align: "right" });

  // ═════════════════════════════════════════════════════════════
  // 4. Large Wall Headline / Title (20-22pt)
  // ═════════════════════════════════════════════════════════════
  let currentY = 62;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);

  const titleLines = doc.splitTextToSize(data.title.toUpperCase(), 165);
  doc.text(titleLines, 105, currentY, { align: "center" });
  currentY += titleLines.length * 8 + 3;

  // Underline title
  doc.setDrawColor(56, 189, 248); // Sky blue accent
  doc.setLineWidth(1.2);
  doc.line(75, currentY, 135, currentY);
  currentY += 8;

  // Target audience badge if specified
  if (data.targetAudience) {
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Public concerné : ${data.targetAudience}`, 105, currentY, { align: "center" });
    currentY += 8;
  }

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(20, currentY, 190, currentY);
  currentY += 8;

  // ═════════════════════════════════════════════════════════════
  // 5. Main Body Content (Formatted for Wall Reading)
  // ═════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);

  // Split into paragraphs
  const rawParagraphs = data.bodyText.split(/\n\s*\n|\n/);
  for (const p of rawParagraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    // Bullet point
    if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("*")) {
      const cleanBullet = trimmed.replace(/^[-•*]\s*/, "");
      const lines = doc.splitTextToSize(cleanBullet, 155);

      // Draw dot
      doc.setFillColor(15, 23, 42);
      doc.circle(24, currentY - 1.2, 1.2, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11.5);
      doc.setTextColor(15, 23, 42);
      doc.text(lines, 28, currentY);
      currentY += lines.length * 6 + 2;
    } else {
      // Standard paragraph
      const lines = doc.splitTextToSize(trimmed, 168);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(lines, 21, currentY);
      currentY += lines.length * 6.5 + 4;
    }

    if (currentY > 215) break; // Keep room for important callout & signature
  }

  // ═════════════════════════════════════════════════════════════
  // 6. Highlight / Important Notice Callout Box
  // ═════════════════════════════════════════════════════════════
  if (data.importantNotice && currentY < 225) {
    currentY += 4;
    const boxWidth = 168;
    const alertLines = doc.splitTextToSize(data.importantNotice, boxWidth - 16);
    const boxHeight = alertLines.length * 5.5 + 12;

    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(217, 119, 6); // Amber 600
    doc.setLineWidth(0.6);
    doc.roundedRect(21, currentY, boxWidth, boxHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text("⚠️ RAPPEL IMPORTANT :", 26, currentY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(alertLines, 26, currentY + 12);

    currentY += boxHeight + 8;
  }

  // ═════════════════════════════════════════════════════════════
  // 7. Official Seal, Stamp & Signature Area
  // ═════════════════════════════════════════════════════════════
  const footerY = 240;

  // Left side: Display note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Document officiel certifié SnapSchool", 22, footerY + 15);
  doc.text("Affichage public autorisé dans les locaux de l'établissement", 22, footerY + 20);

  // Right side: Signatory
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Fait à ${location}, le ${dateStr}`, 145, footerY, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(signatory, 145, footerY + 6, { align: "center" });

  // Draw Official Stamp Seal (Double circle watermark graphic)
  const stampCenterX = 145;
  const stampCenterY = footerY + 24;

  doc.setDrawColor(30, 58, 138); // Royal Blue
  doc.setLineWidth(0.7);
  doc.circle(stampCenterX, stampCenterY, 15); // Outer circle
  doc.setLineWidth(0.3);
  doc.circle(stampCenterX, stampCenterY, 13.5); // Inner circle

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(30, 58, 138);
  doc.text("★ RÉPUBLIQUE TUNISIENNE ★", stampCenterX, stampCenterY - 7, { align: "center" });
  doc.setFontSize(7.5);
  doc.text("DIRECTION GÉNÉRALE", stampCenterX, stampCenterY - 1, { align: "center" });
  doc.setFontSize(6.5);
  doc.text("CERTIFIÉ CONFORME", stampCenterX, stampCenterY + 5, { align: "center" });
  doc.setFontSize(5.5);
  doc.text(school.slice(0, 24).toUpperCase(), stampCenterX, stampCenterY + 10, { align: "center" });

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);

  const cleanTitle = data.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const filename = `Affiche_${cleanTitle}_${new Date().toISOString().split("T")[0]}.pdf`;

  return {
    buffer,
    filename,
  };
}
