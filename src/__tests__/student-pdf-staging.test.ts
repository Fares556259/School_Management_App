import assert from "node:assert/strict";
import { fields, reviewSummary, validateAudit, type Extraction, type PageAudit } from "../lib/studentPdfImport/schema";

const cells = Object.fromEntries(fields.map(f => [f, { text: f === "nationalId" ? "001234567890" : "مُحَمَّد", bbox: [0, 0, 10, 10], verified: true }]));
const extraction = {
  version: 1, profile: "tn-student-register-v1", sourceSha256: "a".repeat(64), pageCount: 1,
  rows: [{ id: "p1-r1", page: 1, row: 1, cells, issues: [] }], issues: [], ignoredFields: ["registrationDate"],
} as unknown as Extraction;
const audit: PageAudit = {
  sourceSha256: extraction.sourceSha256, page: 1,
  checks: fields.map(field => ({ rowId: "p1-r1", field, status: "match", reason: "Checked against source" })),
};
assert.equal(reviewSummary(extraction, [], 1).reviewComplete, false);
assert.equal(reviewSummary(extraction, [audit], null).reviewComplete, false);
assert.equal(reviewSummary(extraction, [audit], 498).reviewComplete, false);
assert.equal(reviewSummary(extraction, [audit], 1).reviewComplete, true);
assert.equal(reviewSummary(extraction, [audit], 1).canCommit, false);
assert.throws(() => validateAudit({ ...audit, checks: audit.checks.slice(1) }, extraction, 1));
assert.throws(() => validateAudit({ ...audit, checks: [...audit.checks, audit.checks[0]] }, extraction, 1));
assert.throws(() => validateAudit({ ...audit, sourceSha256: "b".repeat(64) }, extraction, 1));
assert.throws(() => validateAudit({ ...audit, checks: [{ ...audit.checks[0], rowId: "invented" }, ...audit.checks.slice(1)] }, extraction, 1));
const uncertain = { ...audit, checks: audit.checks.map((c, i) => i ? c : { ...c, status: "uncertain" as const }) };
assert.equal(reviewSummary(extraction, [uncertain], 1).reviewComplete, false);
assert.equal(reviewSummary(extraction, [audit, audit], 1).reviewComplete, false);
assert.equal(extraction.rows[0].cells.nationalId.text, "001234567890");
assert.equal(extraction.rows[0].cells.name.text, "مُحَمَّد");
console.log("PDF staging review gates passed");
