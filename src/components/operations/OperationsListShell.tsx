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
    <section className="w-full overflow-hidden rounded-panel border border-ink-200 bg-white shadow-panel selection:bg-brand-200 selection:text-brand-900">
      <header className="px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand-600 text-white">
              {icon}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-ink-950 sm:text-2xl">{title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-500">
                <span>{subtitle}</span>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-ink-300" />
                <span className="font-medium text-brand-600">{count} {totalLabel}</span>
              </div>
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {filters ? <div className="mt-5 border-t border-ink-100 pt-5">{filters}</div> : null}
      </header>

      <div className="border-t border-ink-200">{children}</div>
      <div className="border-t border-ink-100 px-5 pb-5 sm:px-6">{pagination}</div>
    </section>
  );
}
