import type { ReactNode } from "react";

export default function OperationsListShell({
  icon,
  title,
  subtitle,
  count,
  totalLabel,
  action,
  filters,
  children,
  pagination,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  count: number;
  totalLabel: string;
  action?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  pagination: ReactNode;
}) {
  return (
    <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm selection:bg-blue-600 selection:text-white">
      <header className="px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
              {icon}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>{subtitle}</span>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="font-medium text-blue-600">{count} {totalLabel}</span>
              </div>
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {filters ? <div className="mt-5 border-t border-slate-100 pt-5">{filters}</div> : null}
      </header>

      <div className="border-t border-slate-200">{children}</div>
      <div className="border-t border-slate-100 px-5 pb-5 sm:px-6">{pagination}</div>
    </section>
  );
}
