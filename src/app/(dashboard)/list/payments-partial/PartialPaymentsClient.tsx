"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, Search, SlidersHorizontal, X } from "lucide-react";
import { downloadCSV } from "@/lib/csvExport";
import { MONTHS } from "@/lib/dateUtils";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { receiveStudentPayment } from "../students/actions";

type Balance = {
  id: number;
  studentId: string | null;
  amount: number;
  deferredAmount: number | null;
  month: number;
  year: number;
  deferredUntil: Date | string | null;
  paidAt: Date | string | null;
  student: {
    name: string;
    surname: string;
    level: { level: number } | null;
    class: { name: string } | null;
  } | null;
};

const words = {
  fr: {
    subtitle: "Encaissez les soldes de scolarité après un premier versement.",
    outstanding: "Solde à encaisser", overdue: "En retard", thisMonth: "À échéance ce mois",
    future: "Plus tard", unscheduled: "Sans échéance", all: "Tous", filters: "Filtres", search: "Rechercher un élève",
    export: "Exporter CSV", reset: "Effacer les filtres", noMatch: "Aucun résultat pour ces filtres.", empty: "Aucun solde à encaisser.",
    noStudent: "Élève indisponible", period: "Mois de scolarité", due: "Échéance", paid: "Déjà versé",
    collect: "Encaisser", close: "Fermer", remainder: "Reste après ce versement", settle: "Tout solder", half: "50 % du solde", status: "Statut",
    changed: "Le solde a changé. Fermez cette fenêtre et actualisez avant d’encaisser.",
    invalid: "Saisissez un montant positif avec trois décimales au maximum.",
    failed: "Le versement n’a pas pu être enregistré. Vérifiez le solde et réessayez.",
  },
  en: {
    subtitle: "Collect tuition balances after an initial payment.",
    outstanding: "Balance to collect", overdue: "Overdue", thisMonth: "Due this month",
    future: "Later", unscheduled: "No due date", all: "All", filters: "Filters", search: "Search by student",
    export: "Export CSV", reset: "Clear filters", noMatch: "No results for these filters.", empty: "No balances to collect.",
    noStudent: "Student unavailable", period: "Tuition month", due: "Due date", paid: "Already paid",
    collect: "Collect payment", close: "Close", remainder: "Balance after this payment", settle: "Pay in full", half: "50% of balance", status: "Status",
    changed: "The balance changed. Close this window and refresh before collecting.",
    invalid: "Enter a positive amount with up to three decimal places.",
    failed: "The payment could not be recorded. Check the balance and try again.",
  },
  ar: {
    subtitle: "استخلاص بقية معلوم الدراسة بعد الدفعة الأولى.",
    outstanding: "المبلغ المتبقي للاستخلاص", overdue: "متأخر", thisMonth: "مستحق هذا الشهر",
    future: "لاحقًا", unscheduled: "دون موعد", all: "الكل", filters: "تصفية", search: "ابحث عن تلميذ",
    export: "تصدير CSV", reset: "مسح عوامل التصفية", noMatch: "لا توجد نتائج لهذه التصفية.", empty: "لا توجد مبالغ متبقية للاستخلاص.",
    noStudent: "التلميذ غير متاح", period: "شهر الدراسة", due: "تاريخ الاستحقاق", paid: "المدفوع سابقًا",
    collect: "استخلاص", close: "إغلاق", remainder: "المتبقي بعد هذه الدفعة", settle: "تسديد الكل", half: "50٪ من المتبقي", status: "الحالة",
    changed: "تغيّر الرصيد. أغلق هذه النافذة وحدّث الصفحة قبل الاستخلاص.",
    invalid: "أدخل مبلغًا موجبًا بثلاث خانات عشرية على الأكثر.",
    failed: "تعذّر تسجيل الدفعة. تحقّق من الرصيد وأعد المحاولة.",
  },
};

const dueStatuses = ["overdue", "thisMonth", "future", "unscheduled"] as const;
type DueStatus = (typeof dueStatuses)[number];
const tunisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" });
const asMillimes = (value: number) => Math.round(value * 1000);
const periodKey = (row: Balance) => `${row.year}-${String(row.month).padStart(2, "0")}`;

function dueStatus(value: Balance["deferredUntil"], today: string): DueStatus {
  if (!value) return "unscheduled";
  const day = tunisDate.format(new Date(value));
  if (day < today) return "overdue";
  return day.slice(0, 7) === today.slice(0, 7) ? "thisMonth" : "future";
}

function parseAmount(value: string) {
  const normalized = value.trim()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[,٫]/g, ".");
  return /^\d+(?:\.\d{1,3})?$/.test(normalized) ? asMillimes(Number(normalized)) : NaN;
}

export default function PartialPaymentsClient({ initialData, today }: { initialData: Balance[]; today: string }) {
  const { t, locale } = useLanguage();
  const labels = words[locale];
  const router = useRouter();
  const [changes, setChanges] = useState<Record<number, Balance | null>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DueStatus | "all">("all");
  const [schoolClass, setSchoolClass] = useState("");
  const [period, setPeriod] = useState("");
  const [selected, setSelected] = useState<Balance | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const submitLock = useRef(false);
  const openButton = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const hasFilters = Boolean(search.trim() || status !== "all" || schoolClass || period);
  const formattedMoney = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Tunis" });
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const money = (value: number) => `${formattedMoney.format(value)} DT`;
  const monthLabel = (key: string) => monthFormat.format(new Date(`${key}-01T12:00:00Z`));

  const { rows, totals, counts, classes, months } = useMemo(() => {
    const totals = { all: 0, overdue: 0, thisMonth: 0, future: 0, unscheduled: 0 };
    const counts = { all: 0, overdue: 0, thisMonth: 0, future: 0, unscheduled: 0 };
    const classes = new Set<string>();
    const months = new Set<string>();
    const rows = initialData.flatMap((original) => {
      const row = original.id in changes ? changes[original.id] : original;
      if (!row || !row.deferredAmount) return [];
      const status = dueStatus(row.deferredUntil, today);
      const balance = asMillimes(row.deferredAmount);
      totals.all += balance;
      totals[status] += balance;
      counts.all++;
      counts[status]++;
      if (row.student?.class?.name) classes.add(row.student.class.name);
      months.add(periodKey(row));
      return [{ row, status }];
    }).sort((a, b) => dueStatuses.indexOf(a.status) - dueStatuses.indexOf(b.status));
    return { rows, totals, counts, classes: [...classes].sort(), months: [...months].sort().reverse() };
  }, [changes, initialData, today]);

  const needle = search.trim().toLocaleLowerCase(locale);
  const filtered = rows.filter(({ row, status: rowStatus }) => (
    (status === "all" || status === rowStatus) &&
    (!schoolClass || schoolClass === row.student?.class?.name) &&
    (!period || period === periodKey(row)) &&
    (!needle || `${row.student?.name ?? ""} ${row.student?.surname ?? ""} ${row.student?.class?.name ?? ""}`.toLocaleLowerCase(locale).includes(needle))
  ));

  const reset = () => { setSearch(""); setStatus("all"); setSchoolClass(""); setPeriod(""); };
  const exportRows = () => downloadCSV(filtered.map(({ row, status: rowStatus }) => ({
    [t.recovery.table.student]: row.student ? `${row.student.name} ${row.student.surname}` : labels.noStudent,
    [t.recovery.modal.class]: row.student?.class?.name ?? "",
    [t.recovery.table.level]: row.student?.level?.level ?? "",
    [labels.period]: monthLabel(periodKey(row)),
    [labels.paid]: row.amount,
    [labels.outstanding]: row.deferredAmount ?? 0,
    [t.recovery.modal.tuitionTotal]: (asMillimes(row.amount) + asMillimes(row.deferredAmount ?? 0)) / 1000,
    [(locale === "fr" ? "Dernier versement" : locale === "ar" ? "آخر دفعة" : "Last payment")]: row.paidAt ? dateFormat.format(new Date(row.paidAt)) : "",
    [labels.due]: row.deferredUntil ? dateFormat.format(new Date(row.deferredUntil)) : "",
    [labels.status]: labels[rowStatus],
  })), `SnapSchool-paiements-partiels-${today}.csv`);

  const balance = asMillimes(selected?.deferredAmount ?? 0);
  const payment = parseAmount(amount);
  const exceeded = payment > balance;
  const valid = Number.isSafeInteger(payment) && payment > 0 && !exceeded;
  async function collect(event: FormEvent) {
    event.preventDefault();
    if (!selected?.studentId || !selected.student || !valid || submitLock.current || error === labels.changed) return;
    submitLock.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await receiveStudentPayment(
        selected.studentId,
        `${selected.student.name} ${selected.student.surname}`,
        (asMillimes(selected.amount) + balance) / 1000,
        `${MONTHS[selected.month - 1]} ${selected.year}`,
        (asMillimes(selected.amount) + payment) / 1000,
        undefined,
        { paymentId: selected.id, previousAmount: selected.amount, previousBalance: selected.deferredAmount! },
      );
      if (result.success && result.data) {
        const saved = result.data;
        const updated = saved.status === "PAID" ? null : {
          ...selected,
          amount: saved.amount,
          deferredAmount: saved.deferredAmount,
          deferredUntil: saved.deferredUntil,
          paidAt: saved.paidAt,
        };
        setChanges((previous) => ({ ...previous, [selected.id]: updated }));
        setNotice(t.toasts.paymentRecorded);
        setSelected(null);
      } else {
        setError(result.error === "PAYMENT_CHANGED" ? labels.changed : labels.failed);
      }
    } catch {
      setError(labels.failed);
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">{t.menu["payments-partial"]}</h2>
          <p className="mt-1 text-sm text-ink-600">{labels.subtitle}</p>
        </div>
        <button type="button" className="ss-button-secondary" onClick={exportRows} disabled={!filtered.length}>
          <Download size={16} aria-hidden />{labels.export}
        </button>
      </header>

      {notice && <p role="status" className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-ink-900">
        {notice}<button type="button" className="ss-icon-button" onClick={() => setNotice("")} aria-label={labels.close}><X size={16} aria-hidden /></button>
      </p>}

      <dl className="grid divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white sm:grid-cols-3 sm:divide-y-0">
        {[["all", labels.outstanding], ["overdue", labels.overdue], ["thisMonth", labels.thisMonth]].map(([key, label], index) => (
          <div key={key} className={`px-4 py-4 sm:px-6 ${index ? "sm:border-s sm:border-ink-200" : "bg-ink-50/60"}`}>
            <dt className="text-sm font-medium text-ink-600">{label}</dt>
            <dd className={`mt-1 font-semibold tabular-nums text-ink-900 ${index ? "text-xl" : "text-2xl"}`}><bdi>{money(totals[key as keyof typeof totals] / 1000)}</bdi></dd>
          </div>
        ))}
      </dl>

      <div className="rounded-2xl border border-ink-200 bg-white">
        <div className="space-y-3 border-b border-ink-200 p-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[10rem] flex-1 md:max-w-sm">
              <Search size={17} aria-hidden className="pointer-events-none absolute start-3 top-3 text-ink-500" />
              <input ref={searchInput} type="search" aria-label={labels.search} placeholder={labels.search} value={search} onChange={(event) => setSearch(event.target.value)} className="ss-field ps-10" />
            </div>
            <details className="group relative">
              <summary className="ss-button-secondary cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal size={15} aria-hidden />{labels.filters}
                {(schoolClass || period) && <span className="rounded-full bg-brand-50 px-1.5 text-brand-700">{Number(Boolean(schoolClass)) + Number(Boolean(period))}</span>}
                <ChevronDown size={14} aria-hidden className="group-open:rotate-180" />
              </summary>
              <div className="absolute end-0 z-10 mt-1 grid w-56 gap-2 rounded-lg border border-ink-200 bg-white p-3 shadow-lg">
                <label className="ss-label">{t.recovery.modal.class}
                  <select className="ss-field mt-1" value={schoolClass} onChange={(event) => setSchoolClass(event.target.value)}>
                    <option value="">{t.recovery.allClasses}</option>
                    {classes.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </label>
                <label className="ss-label">{labels.period}
                  <select className="ss-field mt-1" value={period} onChange={(event) => setPeriod(event.target.value)}>
                    <option value="">{t.recovery.allMonths}</option>
                    {months.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
                  </select>
                </label>
              </div>
            </details>
            {hasFilters && <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={reset}>{labels.reset}</button>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...dueStatuses] as const).map((filter) => (
              <button key={filter} type="button" aria-pressed={status === filter} onClick={() => setStatus(filter)}
                className={`min-h-8 rounded-md px-2.5 py-1 text-sm font-medium focus-visible:outline-brand-600 ${status === filter ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50"}`}>
                {labels[filter]} <span className="ms-1 tabular-nums">({counts[filter]})</span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="hidden bg-ink-50 text-ink-600 sm:table-header-group">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium sm:px-6">{t.recovery.table.student}</th>
                  <th scope="col" className="px-3 py-3 text-start font-medium">{labels.period}</th>
                  <th scope="col" className="px-3 py-3 text-start font-medium">{labels.due}</th>
                  <th scope="col" className="px-3 py-3 text-end font-medium">{labels.outstanding}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium sm:px-6"><span className="sr-only">{t.recovery.table.actions}</span></th>
                </tr>
              </thead>
              <tbody className="block divide-y divide-ink-100 sm:table-row-group">
                {filtered.map(({ row, status: rowStatus }) => (
                  <tr key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 p-4 hover:bg-ink-50/50 sm:table-row sm:p-0">
                    <td className="min-w-0 align-middle sm:px-6 sm:py-3">
                      <p className="font-semibold text-ink-900"><bdi>{row.student ? `${row.student.name} ${row.student.surname}` : labels.noStudent}</bdi></p>
                      {row.student?.class?.name && <p className="mt-0.5 text-xs text-ink-600"><bdi>{row.student.class.name}</bdi></p>}
                    </td>
                    <td className="col-start-1 text-ink-600 sm:px-3 sm:py-3">{monthLabel(periodKey(row))}</td>
                    <td className="col-start-1 text-xs text-ink-600 sm:px-3 sm:py-3">
                      <div className={rowStatus === "overdue" ? "font-semibold text-rose-700" : undefined}>{labels[rowStatus]}</div>
                      {row.deferredUntil && <time className="sm:mt-0.5 sm:block" dateTime={tunisDate.format(new Date(row.deferredUntil))}>{dateFormat.format(new Date(row.deferredUntil))}</time>}
                    </td>
                    <td className="col-start-2 row-start-1 text-end font-semibold tabular-nums text-ink-900 sm:px-3 sm:py-3"><bdi className="whitespace-nowrap">{money(row.deferredAmount ?? 0)}</bdi></td>
                    <td className="col-start-2 row-start-2 row-span-2 self-end text-end sm:px-6 sm:py-3">
                      <button type="button" disabled={!row.student || !row.studentId} className="ss-button-secondary whitespace-nowrap" onClick={(event) => {
                        openButton.current = event.currentTarget;
                        setAmount(String(row.deferredAmount ?? 0));
                        setError("");
                        setNotice("");
                        setSelected(row);
                      }}>{labels.collect}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-4 py-12 text-center text-sm text-ink-600">{hasFilters ? labels.noMatch : labels.empty}</p>}
      </div>

      <Dialog.Root open={selected !== null} onOpenChange={(open) => {
        if (!open && !submitLock.current) {
          if (error === labels.changed) { setChanges({}); router.refresh(); }
          setSelected(null);
        }
      }}>
        {selected && <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-ink-950/45 backdrop-blur-[2px]" />
          <Dialog.Content dir={locale === "ar" ? "rtl" : "ltr"}
            className="ss-dialog fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto focus:outline-none"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              amountInput.current?.focus();
              amountInput.current?.select();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              (openButton.current?.isConnected ? openButton.current : searchInput.current)?.focus();
            }}>
            <header className="relative border-b border-ink-200 px-5 py-4 pe-14 sm:px-6 sm:pe-14">
              <Dialog.Title className="text-xl font-semibold tracking-tight text-ink-900">{labels.collect}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-600"><bdi>{selected.student?.name} {selected.student?.surname}</bdi> · {monthLabel(periodKey(selected))}</Dialog.Description>
              <Dialog.Close type="button" disabled={saving} aria-label={labels.close} className="ss-icon-button absolute end-3 top-3 disabled:opacity-50"><X size={18} aria-hidden /></Dialog.Close>
            </header>
            <form onSubmit={collect}>
              <div className="space-y-4 px-5 py-4 sm:px-6">
                <dl className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-ink-50 px-3 py-3">
                  <div><dt className="text-sm text-ink-600">{labels.outstanding}</dt><dd className="text-xl font-semibold tabular-nums text-ink-900"><bdi>{money(balance / 1000)}</bdi></dd></div>
                  <div className="text-end"><dt className="text-xs text-ink-600">{labels.paid}</dt><dd className="text-sm font-medium tabular-nums text-ink-800"><bdi>{money(selected.amount)}</bdi></dd></div>
                </dl>
                <div>
                  <label htmlFor="recovery-amount" className="ss-label">{t.recovery.modal.recoveryAmount}</label>
                  <div className="relative mt-1">
                    <input ref={amountInput} id="recovery-amount" inputMode="decimal" value={amount} disabled={saving} aria-invalid={Boolean(amount && !valid)} aria-describedby="recovery-remaining"
                      onChange={(event) => { setAmount(event.target.value); if (error !== labels.changed) setError(""); }}
                      className="ss-field pe-11 text-base font-semibold tabular-nums" />
                    <span className="pointer-events-none absolute end-3 top-2.5 text-sm text-ink-600">DT</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[{ label: labels.settle, value: balance }, { label: labels.half, value: Math.floor(balance / 2) }].filter((option) => option.value > 0).map((option) => (
                      <button key={option.label} type="button" disabled={saving} aria-pressed={payment === option.value}
                        onClick={() => setAmount(String(option.value / 1000))}
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${payment === option.value ? "border-brand-200 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700 hover:bg-ink-50"}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div id="recovery-remaining" aria-live="polite" className="flex flex-wrap justify-between gap-2 border-t border-ink-200 pt-3 text-sm text-ink-700">
                  {valid ? <><span>{labels.remainder}</span><strong className="tabular-nums text-ink-900"><bdi>{money((balance - payment) / 1000)}</bdi></strong></>
                    : amount && <span className="text-rose-700">{exceeded ? t.recovery.modal.amountExceedsNotice.replace("{max}", formattedMoney.format(balance / 1000)) : labels.invalid}</span>}
                </div>
                {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
              </div>
              <footer className="flex flex-wrap justify-end gap-2 border-t border-ink-200 px-5 py-4 sm:px-6">
                <Dialog.Close type="button" disabled={saving} className="ss-button-secondary">{t.recovery.modal.cancel}</Dialog.Close>
                <button type="submit" disabled={!valid || saving || error === labels.changed} className="ss-button-primary">
                  {saving ? t.recovery.modal.processing : t.recovery.modal.confirm}
                </button>
              </footer>
            </form>
          </Dialog.Content>
        </Dialog.Portal>}
      </Dialog.Root>
    </section>
  );
}
