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

export const auditSchema = z.object({
  sourceSha256: z.string(), page: z.number().int().positive(),
  checks: z.array(z.object({
    rowId: z.string(), field: z.enum(fields), status: z.enum(["match", "mismatch", "uncertain"]),
    reason: z.string().max(1000),
  }).strict()).max(1000),
}).strict();
export type PageAudit = z.infer<typeof auditSchema>;

/** A partial, duplicated, invented, or wrong-document audit is never a pass. */
export function validateAudit(value: unknown, extraction: Extraction, page: number): PageAudit {
  const audit = auditSchema.parse(value);
  if (audit.sourceSha256 !== extraction.sourceSha256 || audit.page !== page) throw new Error("Audit source mismatch");
  const expected = new Set(extraction.rows.filter(r => r.page === page).flatMap(r => fields.map(f => `${r.id}:${f}`)));
  if (!expected.size) throw new Error("No rows to audit");
  for (const check of audit.checks) {
    if (!expected.delete(`${check.rowId}:${check.field}`)) throw new Error("Unexpected or duplicate audit cell");
  }
  if (expected.size) throw new Error("Incomplete audit coverage");
  return audit;
}

/** Review status only. This module deliberately exposes no database payload or commit permission. */
export function reviewSummary(extraction: Extraction, audits: PageAudit[], expectedCount: number | null) {
  const issues = [...extraction.issues, ...extraction.rows.flatMap(r => r.issues)];
  const verifiedCells = extraction.rows.every(r => fields.every(f => r.cells[f].verified));
  const pages = [...new Set(extraction.rows.map(r => r.page))];
  let auditedPages = 0;
  let discrepancies = 0;
  for (const page of pages) {
    const matching = audits.filter(a => a.page === page);
    if (matching.length !== 1) continue;
    try {
      const audit = validateAudit(matching[0], extraction, page);
      auditedPages++;
      discrepancies += audit.checks.filter(c => c.status !== "match").length;
    } catch { /* Invalid audit remains pending. */ }
  }
  return {
    issueCount: issues.length, auditedPages, totalPages: pages.length, discrepancies,
    countMatches: expectedCount !== null && expectedCount === extraction.rows.length,
    reviewComplete: issues.length === 0 && verifiedCells && extraction.rows.length > 0 &&
      expectedCount === extraction.rows.length && auditedPages === pages.length && discrepancies === 0,
    canCommit: false as const,
  };
}
