/**
 * Server component that shows a summary bar for a given month:
 * "12 paid · 3 unpaid" with colored badges.
 */
import { useLanguage } from "@/lib/translations/LanguageContext";

export default function MonthPaymentSummary({
  total,
  paidCount,
  monthLabel,
  entityName,
}: {
  total: number;
  paidCount: number;
  monthLabel: string;
  entityName: string;
}) {
  const unpaidCount = total - paidCount;
  const { t } = useLanguage();

  const entityDict = (t[entityName as keyof typeof t] as any) || t.students;
  const paidText =
    paidCount > 1
      ? entityDict?.paidPlural || entityDict?.paid || t.students?.paid || "paid"
      : entityDict?.paid || t.students?.paid || "paid";
  const unpaidText =
    unpaidCount > 1
      ? entityDict?.unpaidPlural || entityDict?.unpaid || t.students?.unpaid || "unpaid"
      : entityDict?.unpaid || t.students?.unpaid || "unpaid";
  const outOfTemplate =
    entityDict?.outOfTeachers ||
    entityDict?.outOfStaff ||
    entityDict?.outOfStudents ||
    t.students?.outOfStudents ||
    "out of {count}";

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-emerald-400" />
        <span className="text-sm font-medium text-slate-600">
          {paidCount} {paidText}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-rose-400" />
        <span className="text-sm font-medium text-slate-600">
          {unpaidCount} {unpaidText}
        </span>
      </div>
      <span className="text-xs text-slate-400">
        {outOfTemplate.replace("{count}", total.toString())}
      </span>
    </div>
  );
}
