/**
 * Server component that shows a summary bar for a given month:
 * "12 paid · 3 unpaid" with colored badges.
 */
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

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-emerald-400" />
        <span className="text-sm font-medium text-slate-600">
          {paidCount} paid
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-rose-400" />
        <span className="text-sm font-medium text-slate-600">
          {unpaidCount} unpaid
        </span>
      </div>
      <span className="text-xs text-slate-400">
        out of {total} {entityName}
      </span>
    </div>
  );
}
