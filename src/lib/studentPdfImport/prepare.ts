import { fields, type Extraction } from "./schema";

const grades: Record<string, number> = {
  "المرحلة التحضيرية": 0,
  "السنة الأولى من التعليم الأساسي": 1, "السنة الثانية من التعليم الأساسي": 2,
  "السنة الثالثة من التعليم الأساسي": 3, "السنة الرابعة من التعليم الأساسي": 4,
  "السنة الخامسة من التعليم الأساسي": 5, "السنة السادسة من التعليم الأساسي": 6,
};
/** Only labels are normalized for exact lookup; original names remain untouched. */
const label = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();
export function preparePdfImport(extraction: Extraction, birthdays: Record<string, string> = {}) {
  if (extraction.issues.length || !extraction.rows.length) throw new Error("Le PDF contient des anomalies à résoudre.");
  const parents = new Map<string, string>();
  const ids = new Set<string>();
  const students = extraction.rows.map(row => {
    if (row.issues.length || fields.some(f => !row.cells[f].verified)) throw new Error(`Ligne ${row.id} : informations à vérifier.`);
    const raw = Object.fromEntries(fields.map(f => [f, row.cells[f].text])) as Record<typeof fields[number], string>;
    if (!/^[0-9]{12}$/.test(raw.nationalId) || ids.has(raw.nationalId)) throw new Error("Identifiant élève invalide ou répété.");
    ids.add(raw.nationalId);
    if (!/^[0-9]{8}$/.test(raw.guardianPhone)) throw new Error(`Téléphone invalide : ${row.id}`);
    const parentName = parents.get(raw.guardianPhone);
    if (parentName !== undefined && parentName !== raw.guardianName) throw new Error(`Le téléphone ${raw.guardianPhone} correspond à plusieurs noms de responsables. Vérifiez les liens familiaux avant import.`);
    parents.set(raw.guardianPhone, raw.guardianName);
    const grade = grades[label(raw.level)];
    const sexLabel = label(raw.sex);
    const sex = sexLabel === "ذكر" ? "MALE" as const : sexLabel === "أنثى" ? "FEMALE" as const : null;
    if (grade === undefined || !sex) throw new Error(`Niveau ou sexe non reconnu : ${row.id}`);
    const date = birthdays[raw.nationalId];
    const birthday = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
    if (date && (!birthday || !Number.isFinite(birthday.getTime()) || birthday.toISOString().slice(0,10) !== date || birthday > new Date())) throw new Error(`Date de naissance requise ou invalide pour ${raw.nationalId}.`);
    return { ...raw, grade, sex, birthday };
  });
  return { students, parents };
}
