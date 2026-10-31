import type { ToolDefinition } from "@/lib/telegram/tools";
import { schoolDate, schoolMonth } from './dataAccuracy';

/** Resolve time-sensitive defaults before the proposal is displayed and fingerprinted. */
export function freezeMobileActionArguments(name: string, args: Record<string, any>) {
  if (['add_expense', 'add_income'].includes(name)) return { ...args, date: args.date || schoolDate() };
  if (['record_payment', 'record_parent_payment'].includes(name)) {
    const period = schoolMonth(args.month, args.year);
    return { ...args, month: period.month, year: period.year };
  }
  return args;
}

// Only reviewed query tools may run while composing a reply. New tools fail closed.
export const READ_ONLY_ACTIONS = new Set([
  "query_school_records", "get_students", "get_student_profile", "get_parents", "get_classes", "list_unassigned_students",
  "get_teachers", "get_school_stats", "get_staff", "get_salary_details", "get_attendance",
  "get_student_attendance_history", "get_student_grades", "get_class_grade_sheet", "get_exams",
  "get_payments", "get_partial_payments", "get_financial_summary", "get_financial_anomalies",
  "get_incomes", "get_expenses", "get_class_timetable", "find_available_teachers",
  "get_teacher_timetable", "get_timetable_conflicts", "suggest_best_timetable_slot",
  "get_announcements", "get_assignments", "get_assignment_details", "get_resources",
  "get_daily_caisse", "get_morning_briefing", "get_audit_log", "get_hnia_teachings", "search_school_knowledge", "get_reminders",
  "get_payment_receipt", "get_salary_payslip", "get_daily_cash_pdf", "search_external_student",
  "get_external_student", "list_external_documents", "get_admin_profile", "get_school_settings",
]);

export function requiresActionConfirmation(name: string, tool?: Pick<ToolDefinition, "requiresConfirmation">): boolean {
  return !tool || tool.requiresConfirmation || !READ_ONLY_ACTIONS.has(name);
}

export const ACTION_VALIDITY_MS = 24 * 60 * 60 * 1000;
export function isActionExpired(createdAt: Date | string, now = Date.now()): boolean {
  const created = new Date(createdAt).getTime();
  return !Number.isFinite(created) || now - created > ACTION_VALIDITY_MS;
}

/** Validate the exact reviewed payload; never silently change its sign or decimal value. */
export function prepareConfirmedArguments(tool: ToolDefinition, original: unknown, edits?: unknown): Record<string, any> {
  const isObject = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
  if (!isObject(original) || (edits !== undefined && !isObject(edits))) throw new Error("Paramètres d'action invalides.");
  const properties = tool.declaration.parameters?.properties || {};
  const args = { ...original };
  for (const [key, value] of Object.entries(edits || {})) {
    // The old editor sends title + description together; keep only the tool's supported alias.
    if ((key === "title" || key === "description") && !(key in properties) && ("title" in properties || "description" in properties)) continue;
    if (!Object.prototype.hasOwnProperty.call(properties, key)) throw new Error(`Le champ « ${key} » ne peut pas être modifié pour cette action.`);
    args[key] = value;
  }
  for (const field of ["schoolId", "adminId", "__proto__", "constructor", "prototype"]) {
    if (Object.prototype.hasOwnProperty.call(args, field)) throw new Error("Paramètre réservé interdit.");
  }
  const validate = (value: any, schema: any, path: string): any => {
    if (value === null && schema.nullable) return value;
    switch (String(schema.type).toLowerCase()) {
      case "number": case "integer": {
        if (typeof value === "string" && /^-?\d+(?:[.,]\d+)?$/.test(value.trim())) value = Number(value.trim().replace(",", "."));
        if (typeof value !== "number" || !Number.isFinite(value) || (schema.type === "integer" && !Number.isInteger(value))) throw new Error(`Valeur numérique invalide : ${path}.`);
        break;
      }
      case "string": if (typeof value !== "string") throw new Error(`Texte invalide : ${path}.`); break;
      case "boolean": if (typeof value !== "boolean") throw new Error(`Valeur invalide : ${path}.`); break;
      case "array":
        if (!Array.isArray(value)) throw new Error(`Liste invalide : ${path}.`);
        if (schema.items) value = value.map((item: any, i: number) => validate(item, schema.items, `${path}[${i}]`));
        break;
      case "object":
        if (!isObject(value)) throw new Error(`Objet invalide : ${path}.`);
        value = { ...value };
        for (const required of schema.required || []) if (value[required] === undefined || value[required] === null || value[required] === "") throw new Error(`Champ requis : ${path}.${required}.`);
        for (const [key, child] of Object.entries(schema.properties || {})) if (value[key] !== undefined) value[key] = validate(value[key], child, `${path}.${key}`);
        break;
    }
    if (schema.enum && !schema.enum.includes(value)) throw new Error(`Choix invalide : ${path}.`);
    return value;
  };
  const validated = validate(args, tool.declaration.parameters || { type: "object" }, "action");
  if (validated.amount !== undefined && (typeof validated.amount !== "number" || !Number.isFinite(validated.amount) || validated.amount <= 0)) throw new Error("Le montant doit être un nombre strictement positif.");
  return validated;
}
