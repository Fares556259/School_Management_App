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

const CATEGORY_CONFIGS: Record<
  string,
  { label: string; bg: [number, number, number]; accent: [number, number, number] }
> = {
  COMMUNIQUE: {
    label: "— COMMUNIQUÉ OFFICIEL —",
    bg: [15, 23, 42], // Slate 900 / Navy
    accent: [56, 189, 248], // Sky 400
  },
  AVIS_PARENTS: {
    label: "— AVIS AUX PARENTS D'ÉLÈVES —",
    bg: [15, 23, 42],
    accent: [56, 189, 248],
  },
  NOTE_INTERNE: {
    label: "— NOTE DE SERVICE INTERNE —",
    bg: [30, 41, 59], // Slate 800
    accent: [148, 163, 184],
  },
  DISCIPLINE: {
    label: "— AVIS DE DISCIPLINE & RÈGLEMENT —",
    bg: [153, 27, 27], // Red 800
    accent: [248, 113, 113],
  },
  EXAMENS: {
    label: "— CALENDRIER & CONSIGNES D'EXAMENS —",
    bg: [2, 132, 199], // Sky 600
    accent: [186, 230, 253],
  },
  EVENEMENT: {
    label: "— ÉVÉNEMENT & ACTIVITÉ SCOLAIRE —",
    bg: [5, 150, 105], // Emerald 600
    accent: [167, 243, 208],
  },
  URGENT: {
    label: "— AVIS URGENT & IMPORTANT —",
    bg: [185, 28, 28], // Red 700
    accent: [254, 202, 202],
  },
};

/**
 * Robust sanitizer for jsPDF Helvetica standard fonts (WinAnsi / Latin-1).
 * Eliminates character corruption (e.g. '&', 'p', weird symbols) and parses escaped newlines.
 */
function sanitizeForPdf(str?: string): string {
  if (!str) return "";
  return str
    // Parse escaped newlines and mangled artifacts like 'n\n or \r\n
    .replace(/['",]?\\r\\n/g, "\n")
    .replace(/['",]?\\n/g, "\n")
    .replace(/['",]?\\r/g, "\n")
    .replace(/['"]n\\n/g, "\n")
    .replace(/['"]n\s*/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    // Standardize smart quotes, apostrophes and dashes
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2022\u25CF\u25CB]/g, "- ")
    // Strip variation selectors (e.g. \uFE0F in warning emoji)
    .replace(/[\uFE00-\uFE0F]/g, "")
    // Strip surrogate pairs (emojis)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    // Strip miscellaneous symbols, dingbats, stars, box drawings
    .replace(/[\u25A0-\u25FF\u2600-\u27BF]/g, "")
    .replace(/[★☆✦✧]/g, "")
    // Normalize spaces and excessive blank lines
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Draws a real vector warning triangle icon with an exclamation mark.
 */
function drawWarningTriangle(doc: jsPDF, x: number, y: number, size: number = 7): void {
  doc.setFillColor(217, 119, 6); // Amber 600
  doc.setDrawColor(180, 83, 9);
  doc.setLineWidth(0.3);

  const h = size * 0.866;
  const x1 = x;
  const y1 = y - h * 0.6;
  const x2 = x - size / 2;
  const y2 = y + h * 0.4;
  const x3 = x + size / 2;
  const y3 = y + h * 0.4;

  doc.triangle(x1, y1, x2, y2, x3, y3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(size * 1.05);
  doc.setTextColor(255, 255, 255);
  doc.text("!", x, y + h * 0.25, { align: "center" });
}

/**
 * Draws an authentic, vector circular stamp seal for school administration.
 */
function drawOfficialStamp(doc: jsPDF, cx: number, cy: number, schoolName: string): void {
  doc.setDrawColor(30, 58, 138); // Royal Blue #1E3A8A
  doc.setLineWidth(0.85);
  doc.circle(cx, cy, 16); // Outer border

  doc.setLineWidth(0.3);
  doc.circle(cx, cy, 14.2); // Inner circle

  const cleanSchool = schoolName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .slice(0, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(30, 58, 138);
  doc.text("REPUBLIQUE TUNISIENNE", cx, cy - 8, { align: "center" });

  doc.setFontSize(8);
  doc.text("DIRECTION", cx, cy - 2, { align: "center" });
  doc.text("GENERALE", cx, cy + 3, { align: "center" });

  doc.setFontSize(6);
  doc.text("CERTIFIE CONFORME", cx, cy + 8, { align: "center" });

  doc.setFontSize(5.5);
  doc.setTextColor(59, 130, 246);
  doc.text(cleanSchool, cx, cy + 12, { align: "center" });
}

/**
 * Generate an executive, poster-grade A4 portrait PDF notice designed
 * specifically to be printed and hung on school walls / entrance / bulletin boards.
 */
export async function generateSchoolWallNoticePdf(
  data: SchoolWallNoticeData
): Promise<{ buffer: Buffer; filename: string }> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const school = sanitizeForPdf(data.schoolName || "SnapSchool Academy");
  const title = sanitizeForPdf(data.title);
  const bodyText = sanitizeForPdf(data.bodyText);
  const importantNotice = sanitizeForPdf(data.importantNotice);
  const targetAudience = sanitizeForPdf(data.targetAudience);
  const dateStr = data.dateStr || new Date().toLocaleDateString("fr-FR");
  const location = data.location || "Tunis";
  const signatory = sanitizeForPdf(data.signatory || "La Direction de l'Établissement");

  const refNum =
    data.referenceNumber ||
    `REF: AVIS-${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(
      100 + Math.random() * 900
    )}`;

  const categoryKey = (data.category || "COMMUNIQUE").toUpperCase();
  const catConfig = CATEGORY_CONFIGS[categoryKey] || CATEGORY_CONFIGS.COMMUNIQUE;
  const categoryLabel = catConfig.label;

  // ═════════════════════════════════════════════════════════════
  // 1. Executive Poster Framing & Brand Bar
  // ═════════════════════════════════════════════════════════════
  // Outer border
  doc.setDrawColor(15, 23, 42); // Slate 900
  doc.setLineWidth(1.0);
  doc.rect(8, 8, 194, 281);

  // Top Navy Brand Header Ribbon
  doc.setFillColor(15, 23, 42);
  doc.rect(8, 8, 194, 5.0, "F");

  // Sky Blue accent line
  doc.setFillColor(56, 189, 248);
  doc.rect(8, 13.0, 194, 1.2, "F");

  // Inner subtle framing
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.35);
  doc.rect(10.5, 15.5, 189, 271.0);

  // Corner decorative squares
  doc.setFillColor(15, 23, 42);
  doc.rect(8, 8, 4, 4, "F");
  doc.rect(198, 8, 4, 4, "F");
  doc.rect(8, 285, 4, 4, "F");
  doc.rect(198, 285, 4, 4, "F");

  // ═════════════════════════════════════════════════════════════
  // 2. Institutional School Header
  // ═════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(school.toUpperCase(), 105, 25.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("ÉTABLISSEMENT D'ENSEIGNEMENT & DE FORMATION • DIRECTION PÉDAGOGIQUE", 105, 30.5, { align: "center" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(25, 34.5, 185, 34.5);

  // ═════════════════════════════════════════════════════════════
  // 3. Notice Category Ribbon
  // ═════════════════════════════════════════════════════════════
  doc.setFillColor(catConfig.bg[0], catConfig.bg[1], catConfig.bg[2]);
  doc.roundedRect(40, 38.5, 130, 10, 2.5, 2.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(categoryLabel, 105, 45, { align: "center" });

  // Ref & Date bar
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(refNum, 18, 54.5);
  doc.text(`Date d'affichage : ${dateStr}`, 192, 54.5, { align: "right" });

  // ═════════════════════════════════════════════════════════════
  // 4. Hero Headline Box (Readable from distance on school wall)
  // ═════════════════════════════════════════════════════════════
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(title.toUpperCase(), 162);
  const titleBoxHeight = Math.max(22, titleLines.length * 8.5 + 10);

  doc.roundedRect(18, 58.5, 174, titleBoxHeight, 3, 3, "FD");

  doc.setTextColor(15, 23, 42);
  const titleStartY = 58.5 + (titleBoxHeight - (titleLines.length - 1) * 8.5) / 2 + 1;
  doc.text(titleLines, 105, titleStartY, { align: "center" });

  let currentY = 58.5 + titleBoxHeight + 6;

  // ═════════════════════════════════════════════════════════════
  // 5. Target Audience Pill
  // ═════════════════════════════════════════════════════════════
  if (targetAudience) {
    doc.setFillColor(224, 242, 254); // Sky 100
    doc.setDrawColor(186, 230, 253);
    doc.roundedRect(50, currentY, 110, 7.5, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(3, 105, 161); // Sky 700
    doc.text(`Public concerné : ${targetAudience}`, 105, currentY + 5.2, { align: "center" });
    currentY += 13;
  }

  // ═════════════════════════════════════════════════════════════
  // 6. Main Announcement Container Card (Fills space proportionally)
  // ═════════════════════════════════════════════════════════════
  const paragraphs = bodyText
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const cardWidth = 174;
  const cardStartX = 18;
  const cardStartY = currentY;

  // Measure content to size the card dynamically
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.5);
  let estimatedTextHeight = 0;

  paragraphs.forEach((p) => {
    const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
    lines.forEach((line) => {
      const isBullet = /^[-•*]\s*/.test(line);
      const textToWrap = isBullet ? line.replace(/^[-•*]\s*/, "") : line;
      const wrapped = doc.splitTextToSize(textToWrap, cardWidth - (isBullet ? 28 : 20));
      estimatedTextHeight += wrapped.length * 6.5 + (isBullet ? 2.5 : 4);
    });
    estimatedTextHeight += 3;
  });

  // Calculate available space before footer (footer starts at y = 238)
  const maxCardSpace = importantNotice ? 100 : 130;
  const cardHeight = Math.max(55, Math.min(estimatedTextHeight + 16, maxCardSpace));

  // Container Card Styling
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.6);
  doc.roundedRect(cardStartX, cardStartY, cardWidth, cardHeight, 3.5, 3.5, "FD");

  // Left solid accent bar
  doc.setFillColor(15, 23, 42);
  doc.rect(cardStartX, cardStartY, 2.5, cardHeight, "F");

  let textY = cardStartY + 10;

  paragraphs.forEach((p, pIdx) => {
    const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);

    lines.forEach((line) => {
      if (textY > cardStartY + cardHeight - 8) return;

      const isBullet = /^[-•*]\s*/.test(line);

      if (isBullet) {
        const bulletText = line.replace(/^[-•*]\s*/, "");
        doc.setFillColor(15, 23, 42);
        doc.circle(cardStartX + 10, textY - 1.2, 1.2, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);

        const wrapped = doc.splitTextToSize(bulletText, cardWidth - 28);
        doc.text(wrapped, cardStartX + 14, textY);
        textY += wrapped.length * 6.5 + 2.5;
      } else {
        if (pIdx === 0 && (line.toLowerCase().startsWith("cher") || line.toLowerCase().startsWith("madame") || line.toLowerCase().startsWith("monsieur"))) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13.5);
          doc.setTextColor(15, 23, 42);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(12.5);
          doc.setTextColor(30, 41, 59);
        }

        const wrapped = doc.splitTextToSize(line, cardWidth - 20);
        doc.text(wrapped, cardStartX + 9, textY);
        textY += wrapped.length * 6.8 + 4;
      }
    });

    textY += 3;
  });

  currentY = cardStartY + cardHeight + 8;

  // ═════════════════════════════════════════════════════════════
  // 7. Important Callout Card (Highlighted Warning Banner)
  // ═════════════════════════════════════════════════════════════
  if (importantNotice) {
    const alertBoxWidth = 174;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const alertLines = doc.splitTextToSize(importantNotice, alertBoxWidth - 32);
    const alertHeight = Math.max(22, alertLines.length * 6.5 + 14);

    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(217, 119, 6); // Amber 600
    doc.setLineWidth(0.8);
    doc.roundedRect(18, currentY, alertBoxWidth, alertHeight, 3, 3, "FD");

    // Left thick amber accent bar
    doc.setFillColor(217, 119, 6);
    doc.rect(18, currentY, 3.5, alertHeight, "F");

    // Real Vector Warning Icon
    drawWarningTriangle(doc, 27, currentY + 11, 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text("RAPPEL IMPORTANT :", 35, currentY + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(alertLines, 35, currentY + 15);

    currentY += alertHeight + 8;
  }

  // ═════════════════════════════════════════════════════════════
  // 8. Signatory & Official Stamp Block (Vertically Anchored)
  // ═════════════════════════════════════════════════════════════
  const footerY = 242;

  // Left certification note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Document officiel pour affichage public dans l'établissement", 18, footerY + 18);
  doc.text("SnapSchool Administration • Certifié conforme", 18, footerY + 22);

  // Right Signatory
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Fait à ${location}, le ${dateStr}`, 150, footerY, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(signatory, 150, footerY + 6, { align: "center" });

  // Official Circular Stamp Seal
  drawOfficialStamp(doc, 150, footerY + 24, school);

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);

  const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const filename = `Affiche_${cleanTitle}_${new Date().toISOString().split("T")[0]}.pdf`;

  return {
    buffer,
    filename,
  };
}
