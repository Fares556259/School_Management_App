import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  Footer,
  PageNumber,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";

export interface WordSection {
  heading?: string;
  text?: string;
  bullets?: string[];
}

export interface SchoolWordDocParams {
  schoolName: string;
  title: string;
  documentType?: "administrative_letter" | "circular" | "internal_memo" | "meeting_minutes" | "custom";
  recipient?: string;
  dateStr?: string;
  referenceNumber?: string;
  sections: WordSection[];
  signatory?: string;
  location?: string;
}

/**
 * Generates an executive Microsoft Word document (.docx) with institutional formatting.
 */
export async function generateSchoolWordDocument(
  params: SchoolWordDocParams
): Promise<{ buffer: Buffer; filename: string }> {
  const school = params.schoolName || "SnapSchool Academy";
  const dateStr = params.dateStr || new Date().toLocaleDateString("fr-FR");
  const refNum =
    params.referenceNumber ||
    `REF: DOCX-${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(
      100 + Math.random() * 900
    )}`;
  const location = params.location || "Tunis";
  const signatory = params.signatory || "La Direction de l'Établissement";

  const children: (Paragraph | Table)[] = [];

  // 1. Header Banner / Metadata Table
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: school.toUpperCase(),
          bold: true,
          size: 32, // 16pt
          color: "0F172A", // Navy Slate 900
          font: "Segoe UI",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "ÉTABLISSEMENT D'ENSEIGNEMENT PRIVÉ • DIRECTION ADMINISTRATIVE",
          size: 18, // 9pt
          color: "64748B",
          font: "Segoe UI",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 12,
          color: "0F172A",
        },
      },
    })
  );

  // 2. Reference & Date
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({ text: `${refNum}  •  `, size: 18, color: "64748B", font: "Segoe UI" }),
        new TextRun({ text: `Fait à ${location}, le ${dateStr}`, size: 18, color: "64748B", font: "Segoe UI" }),
      ],
      spacing: { after: 300 },
    })
  );

  // 3. Recipient (if applicable)
  if (params.recipient) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: "Destinataire :", bold: true, size: 20, color: "1E293B", font: "Segoe UI" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: params.recipient, italics: true, size: 20, color: "334155", font: "Segoe UI" }),
        ],
        spacing: { after: 350 },
      })
    );
  }

  // 4. Main Document Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: params.title.toUpperCase(),
          bold: true,
          size: 28, // 14pt
          color: "0F172A",
          font: "Segoe UI",
        }),
      ],
      spacing: { before: 200, after: 300 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: "38BDF8", // Sky blue accent
        },
      },
    })
  );

  // 5. Document Sections & Content
  for (const sec of params.sections) {
    if (sec.heading) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: sec.heading,
              bold: true,
              size: 22, // 11pt
              color: "1E293B",
              font: "Segoe UI",
            }),
          ],
          spacing: { before: 240, after: 120 },
        })
      );
    }

    if (sec.text) {
      const paras = sec.text.split(/\n+/);
      for (const p of paras) {
        if (p.trim()) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: p.trim(),
                  size: 20, // 10pt
                  color: "334155",
                  font: "Segoe UI",
                }),
              ],
              spacing: { after: 140 },
            })
          );
        }
      }
    }

    if (sec.bullets && sec.bullets.length > 0) {
      for (const b of sec.bullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: b.replace(/^[-•*]\s*/, ""),
                size: 20,
                color: "1E293B",
                font: "Segoe UI",
              }),
            ],
            spacing: { after: 80 },
          })
        );
      }
    }
  }

  // 6. Signatory & Closing Block
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: `Pour ${school},`,
          size: 20,
          font: "Segoe UI",
          color: "475569",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: signatory,
          bold: true,
          size: 22,
          color: "0F172A",
          font: "Segoe UI",
        }),
      ],
      spacing: { after: 600 },
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: "[ Cachet & Signature de l'Établissement ]",
          italics: true,
          size: 16,
          color: "94A3B8",
          font: "Segoe UI",
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "Document officiel généré par SnapSchool • Page ",
                    size: 16,
                    color: "94A3B8",
                    font: "Segoe UI",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: "94A3B8",
                    font: "Segoe UI",
                  }),
                  new TextRun({
                    text: " / ",
                    size: 16,
                    color: "94A3B8",
                    font: "Segoe UI",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: "94A3B8",
                    font: "Segoe UI",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const cleanTitle = params.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const filename = `Document_${cleanTitle}_${new Date().toISOString().split("T")[0]}.docx`;

  return {
    buffer,
    filename,
  };
}
