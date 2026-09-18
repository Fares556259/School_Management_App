import fs from "fs";
import path from "path";
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
  language?: "fr" | "ar" | "en" | string;
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
  {
    labels: { fr: string; en: string; ar: string };
    bg: [number, number, number];
    accent: [number, number, number];
  }
> = {
  COMMUNIQUE: {
    labels: {
      fr: "— COMMUNIQUÉ OFFICIEL —",
      en: "— OFFICIAL COMMUNIQUÉ —",
      ar: "— بلاغ رسمي —",
    },
    bg: [15, 23, 42], // Slate 900 / Navy
    accent: [56, 189, 248], // Sky 400
  },
  AVIS_PARENTS: {
    labels: {
      fr: "— AVIS AUX PARENTS D'ÉLÈVES —",
      en: "— NOTICE TO PARENTS —",
      ar: "— إعلام إلى كافة الأولياء —",
    },
    bg: [15, 23, 42],
    accent: [56, 189, 248],
  },
  NOTE_INTERNE: {
    labels: {
      fr: "— NOTE DE SERVICE INTERNE —",
      en: "— INTERNAL MEMORANDUM —",
      ar: "— مذكرة مصلحة داخلية —",
    },
    bg: [30, 41, 59],
    accent: [148, 163, 184],
  },
  DISCIPLINE: {
    labels: {
      fr: "— AVIS DE DISCIPLINE & RÈGLEMENT —",
      en: "— DISCIPLINE & SCHOOL RULES NOTICE —",
      ar: "— إشعار انضباط والنظام الداخلي —",
    },
    bg: [153, 27, 27],
    accent: [248, 113, 113],
  },
  EXAMENS: {
    labels: {
      fr: "— CALENDRIER & CONSIGNES D'EXAMENS —",
      en: "— EXAM SCHEDULE & GUIDELINES —",
      ar: "— جدول الامتحانات والتعليمات —",
    },
    bg: [2, 132, 199],
    accent: [186, 230, 253],
  },
  EVENEMENT: {
    labels: {
      fr: "— ÉVÉNEMENT & ACTIVITÉ SCOLAIRE —",
      en: "— SCHOOL EVENT & ACTIVITIES —",
      ar: "— تظاهرة ونشاط مدرسي —",
    },
    bg: [5, 150, 105],
    accent: [167, 243, 208],
  },
  URGENT: {
    labels: {
      fr: "— AVIS URGENT & IMPORTANT —",
      en: "— URGENT & IMPORTANT NOTICE —",
      ar: "— إعلام عاجل وهام —",
    },
    bg: [185, 28, 28],
    accent: [254, 202, 202],
  },
};

let cachedAmiriBase64: string | null = null;

/**
 * Loads the Amiri Regular font as Base64 for jsPDF.
 * Searches public/fonts first, then src/lib/pdf/fonts.
 */
function getAmiriFontBase64(): string | null {
  if (cachedAmiriBase64) return cachedAmiriBase64;

  const candidatePaths = [
    path.join(process.cwd(), "public", "fonts", "Amiri-Regular.ttf"),
    path.join(process.cwd(), "src", "lib", "pdf", "fonts", "Amiri-Regular.ttf"),
  ];

  for (const fontPath of candidatePaths) {
    if (fs.existsSync(fontPath)) {
      try {
        cachedAmiriBase64 = fs.readFileSync(fontPath).toString("base64");
        return cachedAmiriBase64;
      } catch (err) {
        console.error(`[schoolWallNotice] Failed to read font at ${fontPath}:`, err);
      }
    }
  }

  return null;
}

/**
 * Check if a string contains Arabic Unicode characters.
 */
export function containsArabic(str?: string): boolean {
  if (!str) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str);
}

/**
 * Robust sanitizer for notice text.
 * Preserves Arabic characters when isArabic is true.
 * Cleans up newline encodings and unprintable artifacts.
 */
function sanitizeNoticeText(str?: string, isArabic: boolean = false): string {
  if (!str) return "";

  let cleaned = str
    // Parse escaped newlines and mangled artifacts like \r\n or 'n\n
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
    .replace(/[★☆✦✧]/g, "");

  if (!isArabic) {
    cleaned = cleaned.replace(/[ \t]+/g, " ");
  }

  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Split Arabic text into visually wrapped lines respecting word boundaries,
 * calculating shaped widths with doc.processArabic and doc.getTextWidth.
 */
function splitArabicToLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentWords: string[] = [];

  for (const word of words) {
    const testLine = [...currentWords, word].join(" ");
    const shaped = doc.processArabic(testLine);
    const width = doc.getTextWidth(shaped);
    if (width > maxWidth && currentWords.length > 0) {
      lines.push(doc.processArabic(currentWords.join(" ")));
      currentWords = [word];
    } else {
      currentWords.push(word);
    }
  }

  if (currentWords.length > 0) {
    lines.push(doc.processArabic(currentWords.join(" ")));
  }

  return lines;
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
 * Supports Arabic, English, and French.
 */
function drawOfficialStamp(
  doc: jsPDF,
  cx: number,
  cy: number,
  schoolName: string,
  isArabic: boolean,
  isEnglish: boolean
): void {
  doc.setDrawColor(30, 58, 138); // Royal Blue #1E3A8A
  doc.setLineWidth(0.85);
  doc.circle(cx, cy, 16); // Outer border

  doc.setLineWidth(0.3);
  doc.circle(cx, cy, 14.2); // Inner circle

  doc.setTextColor(30, 58, 138);

  if (isArabic) {
    doc.setFont("Amiri", "normal");
    doc.setFontSize(8);
    doc.text(doc.processArabic("الجمهورية التونسية"), cx, cy - 8, { align: "center" });

    doc.setFontSize(9);
    doc.text(doc.processArabic("الإدارة العامة"), cx, cy - 1, { align: "center" });

    doc.setFontSize(7.5);
    doc.text(doc.processArabic("مطابق للأصل"), cx, cy + 6, { align: "center" });

    doc.setFontSize(6.5);
    doc.setTextColor(59, 130, 246);
    const shortSchool = schoolName.slice(0, 26);
    doc.text(doc.processArabic(shortSchool), cx, cy + 12, { align: "center" });
  } else if (isEnglish) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text("REPUBLIC OF TUNISIA", cx, cy - 8, { align: "center" });

    doc.setFontSize(8);
    doc.text("GENERAL", cx, cy - 2, { align: "center" });
    doc.text("DIRECTION", cx, cy + 3, { align: "center" });

    doc.setFontSize(6);
    doc.text("CERTIFIED TRUE COPY", cx, cy + 8, { align: "center" });

    doc.setFontSize(5.5);
    doc.setTextColor(59, 130, 246);
    const cleanSchool = schoolName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .slice(0, 22);
    doc.text(cleanSchool, cx, cy + 12, { align: "center" });
  } else {
    // French (default)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text("REPUBLIQUE TUNISIENNE", cx, cy - 8, { align: "center" });

    doc.setFontSize(8);
    doc.text("DIRECTION", cx, cy - 2, { align: "center" });
    doc.text("GENERALE", cx, cy + 3, { align: "center" });

    doc.setFontSize(6);
    doc.text("CERTIFIE CONFORME", cx, cy + 8, { align: "center" });

    doc.setFontSize(5.5);
    doc.setTextColor(59, 130, 246);
    const cleanSchool = schoolName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .slice(0, 22);
    doc.text(cleanSchool, cx, cy + 12, { align: "center" });
  }
}

/**
 * Generate an executive, poster-grade A4 portrait PDF notice designed
 * specifically to be printed and hung on school walls / entrance / bulletin boards.
 *
 * Minimalist & Clean: strictly renders Title + Text Description by default.
 * Optional sections (category ribbon, target audience, warning callout, ref number)
 * are ONLY rendered if explicitly supplied by the caller.
 *
 * Supports Arabic (with Amiri font & RTL layout), English, and French.
 */
export async function generateSchoolWallNoticePdf(
  data: SchoolWallNoticeData
): Promise<{ buffer: Buffer; filename: string }> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // 1. Language Resolution
  const requestedLang = (data.language || "").toLowerCase().trim();
  const isArabic =
    requestedLang === "ar" ||
    requestedLang.startsWith("ar") ||
    containsArabic(data.title) ||
    containsArabic(data.bodyText);

  const isEnglish = !isArabic && (requestedLang === "en" || requestedLang.startsWith("en"));
  const isFrench = !isArabic && !isEnglish;

  // 2. Font Setup
  if (isArabic) {
    const amiriBase64 = getAmiriFontBase64();
    if (amiriBase64) {
      doc.addFileToVFS("Amiri-Regular.ttf", amiriBase64);
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      doc.setFont("Amiri");
    } else {
      console.warn("[schoolWallNotice] Amiri font not found on disk, fallback to standard font");
      doc.setFont("helvetica");
    }
  } else {
    doc.setFont("helvetica");
  }

  // 3. Text Sanitization
  const school = sanitizeNoticeText(
    data.schoolName || (isArabic ? "مدرسة النخبة النموذجية" : "SnapSchool Academy"),
    isArabic
  );
  const title = sanitizeNoticeText(data.title, isArabic);
  const bodyText = sanitizeNoticeText(data.bodyText, isArabic);
  const importantNotice = sanitizeNoticeText(data.importantNotice, isArabic);
  const targetAudience = sanitizeNoticeText(data.targetAudience, isArabic);
  const referenceNumber = data.referenceNumber ? sanitizeNoticeText(data.referenceNumber, isArabic) : undefined;

  // Date formatting according to language
  const defaultDateStr = isArabic
    ? new Intl.DateTimeFormat("ar-TN", { dateStyle: "long" }).format(new Date())
    : isEnglish
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date())
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());

  const dateStr = data.dateStr || defaultDateStr;

  // Signatory & Location defaults
  const location = data.location || (isArabic ? "تونس" : "Tunis");
  const signatory = sanitizeNoticeText(
    data.signatory ||
      (isArabic
        ? "إدارة المؤسسة"
        : isEnglish
        ? "School Board & Administration"
        : "La Direction de l'Établissement"),
    isArabic
  );

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
  if (isArabic) {
    doc.setFont("Amiri", "normal");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.processArabic(school), 105, 25.5, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(doc.processArabic("المؤسسة التربوية والتعليمية • الإدارة البيداغوجية"), 105, 31, {
      align: "center",
    });
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(school.toUpperCase(), 105, 25.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const subtitle = isEnglish
      ? "EDUCATIONAL & TRAINING INSTITUTION • ACADEMIC ADMINISTRATION"
      : "ÉTABLISSEMENT D'ENSEIGNEMENT & DE FORMATION • DIRECTION PÉDAGOGIQUE";
    doc.text(subtitle, 105, 30.5, { align: "center" });
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(25, 34.5, 185, 34.5);

  let currentY = 38.0;

  // ═════════════════════════════════════════════════════════════
  // 3. Optional Category Ribbon (ONLY IF EXPLICITLY PROVIDED)
  // ═════════════════════════════════════════════════════════════
  if (data.category && data.category.trim().length > 0) {
    const categoryKey = data.category.toUpperCase().trim();
    const catConfig = CATEGORY_CONFIGS[categoryKey] || CATEGORY_CONFIGS.COMMUNIQUE;
    const catLabel = isArabic
      ? catConfig.labels.ar
      : isEnglish
      ? catConfig.labels.en
      : catConfig.labels.fr;

    doc.setFillColor(catConfig.bg[0], catConfig.bg[1], catConfig.bg[2]);
    doc.roundedRect(40, currentY, 130, 9.5, 2.5, 2.5, "F");

    if (isArabic) {
      doc.setFont("Amiri", "normal");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(doc.processArabic(catLabel), 105, currentY + 6.5, { align: "center" });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(catLabel, 105, currentY + 6.2, { align: "center" });
    }

    currentY += 13.5;
  }

  // ═════════════════════════════════════════════════════════════
  // 4. Date & Reference Bar (Clean & uncluttered)
  // ═════════════════════════════════════════════════════════════
  if (isArabic) {
    doc.setFont("Amiri", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);

    if (referenceNumber) {
      doc.text(doc.processArabic(`المرجع: ${referenceNumber}`), 18, currentY + 3);
    }
    doc.text(doc.processArabic(`تاريخ النشر: ${dateStr}`), 192, currentY + 3, { align: "right" });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    if (referenceNumber) {
      const refLabel = isEnglish ? `Ref: ${referenceNumber}` : `Réf : ${referenceNumber}`;
      doc.text(refLabel, 18, currentY + 3);
    }
    const dateLabel = isEnglish ? `Notice Date: ${dateStr}` : `Date d'affichage : ${dateStr}`;
    doc.text(dateLabel, 192, currentY + 3, { align: "right" });
  }

  currentY += 7.0;

  // ═════════════════════════════════════════════════════════════
  // 5. Hero Headline Box (Readable from distance on school wall)
  // ═════════════════════════════════════════════════════════════
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.5);

  let titleLines: string[];
  let titleLineHeight: number;

  if (isArabic) {
    doc.setFont("Amiri", "normal");
    doc.setFontSize(18);
    titleLines = splitArabicToLines(doc, title, 160);
    titleLineHeight = 9.0;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    titleLines = doc.splitTextToSize(title.toUpperCase(), 162);
    titleLineHeight = 8.5;
  }

  const titleBoxHeight = Math.max(20, titleLines.length * titleLineHeight + 10);
  doc.roundedRect(18, currentY, 174, titleBoxHeight, 3, 3, "FD");

  doc.setTextColor(15, 23, 42);
  const titleStartY = currentY + (titleBoxHeight - (titleLines.length - 1) * titleLineHeight) / 2 + 1;

  if (isArabic) {
    doc.text(titleLines, 105, titleStartY, { align: "center" });
  } else {
    doc.text(titleLines, 105, titleStartY, { align: "center" });
  }

  currentY += titleBoxHeight + 6;

  // ═════════════════════════════════════════════════════════════
  // 6. Optional Target Audience Pill (ONLY IF EXPLICITLY PROVIDED)
  // ═════════════════════════════════════════════════════════════
  if (targetAudience && targetAudience.trim().length > 0) {
    doc.setFillColor(224, 242, 254); // Sky 100
    doc.setDrawColor(186, 230, 253);
    doc.roundedRect(45, currentY, 120, 7.5, 3, 3, "FD");

    if (isArabic) {
      doc.setFont("Amiri", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(3, 105, 161);
      doc.text(doc.processArabic(`المعنيون: ${targetAudience}`), 105, currentY + 5.2, {
        align: "center",
      });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(3, 105, 161);
      const audLabel = isEnglish
        ? `Target Audience: ${targetAudience}`
        : `Public concerné : ${targetAudience}`;
      doc.text(audLabel, 105, currentY + 5.2, { align: "center" });
    }
    currentY += 12;
  }

  // ═════════════════════════════════════════════════════════════
  // 7. Main Announcement Container Card (Fills space gracefully)
  // ═════════════════════════════════════════════════════════════
  const paragraphs = bodyText
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const cardWidth = 174;
  const cardStartX = 18;
  const cardStartY = currentY;
  const footerY = 242;

  // Calculate available space down to footer
  const availableBottomSpace = importantNotice ? footerY - currentY - 32 : footerY - currentY - 6;
  const cardHeight = Math.max(70, Math.min(155, availableBottomSpace));

  // Container Card Styling
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.6);
  doc.roundedRect(cardStartX, cardStartY, cardWidth, cardHeight, 3.5, 3.5, "FD");

  // Accent bar (Right side for Arabic RTL, Left side for LTR)
  doc.setFillColor(15, 23, 42);
  if (isArabic) {
    doc.rect(cardStartX + cardWidth - 2.5, cardStartY, 2.5, cardHeight, "F");
  } else {
    doc.rect(cardStartX, cardStartY, 2.5, cardHeight, "F");
  }

  let textY = cardStartY + (isArabic ? 11 : 10);

  if (isArabic) {
    doc.setFont("Amiri", "normal");
    doc.setFontSize(13.5);
    doc.setTextColor(30, 41, 59);

    paragraphs.forEach((p) => {
      const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);

      lines.forEach((line) => {
        if (textY > cardStartY + cardHeight - 8) return;

        const isBullet = /^[-•*]\s*/.test(line);
        const cleanLine = isBullet ? line.replace(/^[-•*]\s*/, "") : line;
        const wrapped = splitArabicToLines(doc, cleanLine, cardWidth - 28);

        wrapped.forEach((wrappedLine) => {
          if (textY > cardStartY + cardHeight - 8) return;
          doc.text(wrappedLine, cardStartX + cardWidth - 14, textY, { align: "right" });
          textY += 7.8;
        });

        if (isBullet) {
          doc.setFillColor(15, 23, 42);
          doc.circle(cardStartX + cardWidth - 9.5, textY - 7.8 - 2.0, 1.2, "F");
        }
        textY += 2;
      });

      textY += 3.5;
    });
  } else {
    // English & French LTR
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12.5);
    doc.setTextColor(30, 41, 59);

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
          const isSalutation =
            pIdx === 0 &&
            (line.toLowerCase().startsWith("cher") ||
              line.toLowerCase().startsWith("madame") ||
              line.toLowerCase().startsWith("monsieur") ||
              line.toLowerCase().startsWith("dear"));

          if (isSalutation) {
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
  }

  currentY = cardStartY + cardHeight + 6;

  // ═════════════════════════════════════════════════════════════
  // 8. Optional Important Callout Card (ONLY IF EXPLICITLY PROVIDED)
  // ═════════════════════════════════════════════════════════════
  if (importantNotice && importantNotice.trim().length > 0) {
    const alertBoxWidth = 174;
    let alertLines: string[];
    let alertHeight = 22;

    if (isArabic) {
      doc.setFont("Amiri", "normal");
      doc.setFontSize(12);
      alertLines = splitArabicToLines(doc, importantNotice, alertBoxWidth - 36);
      alertHeight = Math.max(22, alertLines.length * 7.5 + 14);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      alertLines = doc.splitTextToSize(importantNotice, alertBoxWidth - 32);
      alertHeight = Math.max(22, alertLines.length * 6.5 + 14);
    }

    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(217, 119, 6); // Amber 600
    doc.setLineWidth(0.8);
    doc.roundedRect(18, currentY, alertBoxWidth, alertHeight, 3, 3, "FD");

    if (isArabic) {
      // Right amber bar
      doc.setFillColor(217, 119, 6);
      doc.rect(18 + alertBoxWidth - 3.5, currentY, 3.5, alertHeight, "F");

      // Real Vector Warning Icon on right
      drawWarningTriangle(doc, 18 + alertBoxWidth - 12, currentY + 11, 7.5);

      doc.setFont("Amiri", "normal");
      doc.setFontSize(11);
      doc.setTextColor(180, 83, 9);
      doc.text(doc.processArabic("تنبيه هـام :"), 18 + alertBoxWidth - 20, currentY + 7.5, {
        align: "right",
      });

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      let alertY = currentY + 14.5;
      alertLines.forEach((l) => {
        doc.text(l, 18 + alertBoxWidth - 20, alertY, { align: "right" });
        alertY += 7.5;
      });
    } else {
      // Left amber bar
      doc.setFillColor(217, 119, 6);
      doc.rect(18, currentY, 3.5, alertHeight, "F");

      // Real Vector Warning Icon
      drawWarningTriangle(doc, 27, currentY + 11, 8);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(180, 83, 9);
      const alertHeader = isEnglish ? "IMPORTANT REMINDER:" : "RAPPEL IMPORTANT :";
      doc.text(alertHeader, 35, currentY + 8);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(15, 23, 42);
      doc.text(alertLines, 35, currentY + 15);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 9. Signatory & Official Stamp Block (Vertically Anchored at footerY)
  // ═════════════════════════════════════════════════════════════
  if (isArabic) {
    // Left certification note (in Arabic)
    doc.setFont("Amiri", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(doc.processArabic("وثيقة رسمية مخصصة للتعليق والإشهار بالمؤسسة"), 18, footerY + 18);
    doc.text(doc.processArabic("SnapSchool Administration • معتمدة ومطابقة للأصل"), 18, footerY + 23);

    // Right Signatory & Location line
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(doc.processArabic(`حُرر بـ ${location} في ${dateStr}`), 150, footerY, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.processArabic(signatory), 150, footerY + 6.5, { align: "center" });
  } else {
    // Left certification note (French/English)
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const certLine1 = isEnglish
      ? "Official document for public display on school bulletin boards"
      : "Document officiel pour affichage public dans l'établissement";
    const certLine2 = isEnglish
      ? "SnapSchool Administration • Certified true copy"
      : "SnapSchool Administration • Certifié conforme";
    doc.text(certLine1, 18, footerY + 18);
    doc.text(certLine2, 18, footerY + 22);

    // Right Signatory & Location line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    const locLine = isEnglish
      ? `Issued in ${location}, on ${dateStr}`
      : `Fait à ${location}, le ${dateStr}`;
    doc.text(locLine, 150, footerY, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(signatory, 150, footerY + 6, { align: "center" });
  }

  // Official Circular Stamp Seal
  drawOfficialStamp(doc, 150, footerY + 24, school, isArabic, isEnglish);

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);

  const cleanPrefix = isArabic ? "Ilan" : isEnglish ? "Notice" : "Affiche";
  const safeTitle = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_")
    .slice(0, 25);
  const filename = `${cleanPrefix}_${safeTitle || "Wall"}_${new Date().toISOString().split("T")[0]}.pdf`;

  return {
    buffer,
    filename,
  };
}
