import { z } from "zod";

export const fields = ["nationalId", "name", "surname", "sex", "level", "guardianName", "guardianPhone"] as const;
export type PdfField = typeof fields[number];
export const fieldLabels: Record<PdfField, string> = {
  nationalId: "Identifiant", name: "Prénom", surname: "Nom", sex: "Sexe",
  level: "Niveau", guardianName: "Responsable", guardianPhone: "Téléphone",
};
const box = z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]);
const cell = z.object({ text: z.string().max(500), bbox: box, verified: z.boolean() }).strict();
const issue = z.object({ code: z.string(), message: z.string(), rowId: z.string().optional(), field: z.enum(fields).optional() }).strict();
export const extractionSchema = z.object({
  version: z.literal(1), profile: z.literal("tn-student-register-v1"),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  pageCount: z.number().int().min(1).max(50),
  rows: z.array(z.object({
    id: z.string(), page: z.number().int().positive(), row: z.number().int().positive(),
    cells: z.object({ nationalId: cell, name: cell, surname: cell, sex: cell, level: cell, guardianName: cell, guardianPhone: cell }).strict(),
    issues: z.array(issue),
  }).strict()).max(2000),
  issues: z.array(issue),
  ignoredFields: z.tuple([z.literal("registrationDate")]),
}).strict();
export type Extraction = z.infer<typeof extractionSchema>;
export type PdfRow = Extraction["rows"][number];

/** Extraction status only: manual verification happens outside the importer. */
export function reviewSummary(extraction: Extraction, expectedCount: number | null) {
  const issueCount = extraction.issues.length + extraction.rows.reduce((sum, row) => sum + row.issues.length, 0);
  return {
    issueCount,
    totalPages: extraction.pageCount,
    countMatches: expectedCount !== null && expectedCount === extraction.rows.length,
    extractionValid: issueCount === 0 && extraction.rows.length > 0 && extraction.rows.every(row => fields.every(field => row.cells[field].verified)),
    manualReviewRequired: true as const,
    canCommit: false as const,
  };
}
