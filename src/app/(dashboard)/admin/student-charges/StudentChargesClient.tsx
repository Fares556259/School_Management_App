"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Receipt,
  Bus,
  ShieldCheck,
  X,
  RefreshCw,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { getMonthKey } from "@/lib/dateUtils";
import ServiceAssignments from "./ServiceAssignments";
import CustomCategories from "./CustomCategories";
import StudentBillingModal from "../../list/students/StudentBillingModal";

type Kind = string;
interface Charge {
  id: string;
  kind: Kind;
  period: string;
  amount: number;
  paidAmount: number;
  voidedAt: string | null;
  voidReason: string | null;
  dueDate: string;
  student: {
    id: string;
    name: string;
    surname: string;
    class: { name: string } | null;
  };
  payments: {
    id: string;
    amount: number;
    paymentMethod: string;
    paidAt: string;
    createdAt: string;
  }[];
}
export interface Data {
  academicYear: string;
  config: {
    registrationFeeEnabled: boolean;
    registrationFee: number;
    registrationReconciliationYear: string | null;
    transportMonthlyFee: number | null;
    gardeMonthlyFee: number | null;
    transportFrequency: string;
    gardeFrequency: string;
    transportNextFrequency: string | null;
    gardeNextFrequency: string | null;
    transportFrequencyYear: string | null;
    gardeFrequencyYear: string | null;
  };
  categories: {
    id: string;
    kind: string;
    name: string;
    price: number;
    frequency: string;
    nextFrequency: string | null;
    frequencyYear: string | null;
    active: boolean;
  }[];
  charges: Charge[];
  students: Charge["student"][];
  services: {
    id: string;
    studentId: string;
    kind: Kind;
    monthlyFee: number;
    discountType: string | null;
    discountValue: number;
    startPeriod: string;
    active: boolean;
    student: Charge["student"];
  }[];
  serviceBalances: {
    studentId: string;
    kind: string;
    _sum: { amount: number | null; paidAmount: number | null };
  }[];
  total: number;
  summary: { billed: number; paid: number; count: number };
}
type Review = {
  title: string;
  lines: string[];
  payload: Record<string, unknown>;
  charge?: Charge;
  mode?: "collect" | "void";
};
export default function StudentChargesClient() {
  const { locale } = useLanguage();
  const text = useCallback(
    (fr: string, en: string, ar: string) =>
      locale === "ar" ? ar : locale === "en" ? en : fr,
    [locale],
  );
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"charges" | "services" | "settings">(
    "settings",
  );
  const [editingFee, setEditingFee] = useState<
    "REGISTRATION" | "TRANSPORT" | "GARDE" | null
  >(null);
  const [selectedServiceKind, setSelectedServiceKind] = useState("TRANSPORT");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("DUE");
  const [kind, setKind] = useState("");
  const [period, setPeriod] = useState("");
  const [page, setPage] = useState(1);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [
    hideCurrentRegistrationFromParents,
    setHideCurrentRegistrationFromParents,
  ] = useState(false);
  const [registrationFee, setRegistrationFee] = useState("150");
  const [transportFee, setTransportFee] = useState("");
  const [gardeFee, setGardeFee] = useState("");
  const [transportFrequency, setTransportFrequency] = useState("MONTHLY");
  const [gardeFrequency, setGardeFrequency] = useState("MONTHLY");
  const [review, setReview] = useState<Review | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Espèces");
  const [paidOn, setPaidOn] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Tunis" }),
  );
  const [reason, setReason] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const currency = (value: number) =>
    `${value.toLocaleString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 3 })} TND`;
  const title = (value: string) =>
    value === "REGISTRATION"
      ? text("Inscription annuelle", "Annual registration", "التسجيل السنوي")
      : value === "TRANSPORT"
        ? text("Transport", "School transport", "النقل المدرسي")
        : value === "GARDE"
          ? text("Garde", "After-school care", "الحضانة")
          : data?.categories.find((category) => category.kind === value)
              ?.name || value;
  const name = (student: Charge["student"]) =>
    `${student.name} ${student.surname}${student.class ? ` · ${student.class.name}` : ""}`;
  const input =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500";
  const button =
    "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
  const filtersActive = !!(search || kind || period || status !== "DUE");
  const draftFee = (value: string) =>
    value.trim() === "" ? null : Number(value.replace(",", "."));
  const feeChanged = (fee: "REGISTRATION" | "TRANSPORT" | "GARDE") => {
    if (!data) return false;
    if (fee === "REGISTRATION")
      return (
        registrationEnabled !== data.config.registrationFeeEnabled ||
        draftFee(registrationFee) !== data.config.registrationFee ||
        hideCurrentRegistrationFromParents !==
          (data.config.registrationReconciliationYear === data.academicYear)
      );
    if (fee === "TRANSPORT")
      return (
        draftFee(transportFee) !== data.config.transportMonthlyFee ||
        transportFrequency !==
          (data.config.transportNextFrequency || data.config.transportFrequency)
      );
    return (
      draftFee(gardeFee) !== data.config.gardeMonthlyFee ||
      gardeFrequency !==
        (data.config.gardeNextFrequency || data.config.gardeFrequency)
    );
  };
  const settingsChanged =
    feeChanged("REGISTRATION") ||
    feeChanged("TRANSPORT") ||
    feeChanged("GARDE");
  const changedFeeCount = (
    ["REGISTRATION", "TRANSPORT", "GARDE"] as const
  ).filter((fee) => feeChanged(fee)).length;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams({
        page: String(page),
        search,
        status,
        kind,
        period,
      });
      const response = await fetch(`/api/admin/student-charges?${params}`, {
        cache: "no-store",
        signal,
      });
      const value = await response.json();
      if (!response.ok || !value.success)
        throw new Error(value.error || "Request failed");
      setData(value);
      return value as Data;
    },
    [page, search, status, kind, period],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void load(controller.signal).catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  useEffect(() => {
    if (!data) return;
    setRegistrationEnabled(data.config.registrationFeeEnabled);
    setHideCurrentRegistrationFromParents(
      data.config.registrationReconciliationYear === data.academicYear,
    );
    setRegistrationFee(String(data.config.registrationFee));
    setTransportFee(
      data.config.transportMonthlyFee === null
        ? ""
        : String(data.config.transportMonthlyFee),
    );
    setGardeFee(
      data.config.gardeMonthlyFee === null
        ? ""
        : String(data.config.gardeMonthlyFee),
    );
    setTransportFrequency(
      data.config.transportNextFrequency || data.config.transportFrequency,
    );
    setGardeFrequency(
      data.config.gardeNextFrequency || data.config.gardeFrequency,
    );
  }, [data]);
  useEffect(() => {
    if (review && !dialog.current?.open) dialog.current?.showModal();
    if (!review && dialog.current?.open) dialog.current.close();
  }, [review]);
  const open = (value: Review) => {
    setError("");
    setReview(value);
    setReason("");
    setMethod("Espèces");
    setPaidOn(
      new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Tunis" }),
    );
    setAmount(
      value.charge
        ? String(
            Math.round((value.charge.amount - value.charge.paidAmount) * 1000) /
              1000,
          )
        : "",
    );
  };
  const send = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/admin/student-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const value = await response.json();
    if (!response.ok || !value.success)
      throw new Error(value.error || "Request failed");
    return value;
  };
  const confirm = async () => {
    if (!review || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...review.payload,
        ...(review.mode === "collect"
          ? {
              amount: Number(amount.replace(",", ".")),
              paymentMethod: method,
              paidOn,
            }
          : {}),
        ...(review.mode === "void" ? { reason } : {}),
      };
      await send(payload);
      setReview(null);
      await load();
      setNotice(
        text(
          "Opération enregistrée.",
          "Saved successfully.",
          "تم الحفظ بنجاح.",
        ),
      );
    } catch (error: any) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      await send({ action: "sync" });
      await load();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const reviewSettings = () =>
    open({
      title: text(
        "Confirmer les tarifs",
        "Confirm billing settings",
        "تأكيد إعدادات المعاليم",
      ),
      lines: [
        `${title("REGISTRATION")}: ${registrationEnabled ? currency(Number(registrationFee.replace(",", "."))) : text("Désactivée", "Disabled", "معطّل")}`,
        `${title("TRANSPORT")}: ${transportFee.trim() === "" ? text("Non défini", "Not set", "غير محدد") : currency(Number(transportFee.replace(",", ".")))} · ${transportFrequency === "YEARLY" ? text("une fois/an", "once/year", "مرة/سنة") : text("mensuel", "monthly", "شهري")}`,
        `${title("GARDE")}: ${gardeFee.trim() === "" ? text("Non défini", "Not set", "غير محدد") : currency(Number(gardeFee.replace(",", ".")))} · ${gardeFrequency === "YEARLY" ? text("une fois/an", "once/year", "مرة/سنة") : text("mensuel", "monthly", "شهري")}`,
        hideCurrentRegistrationFromParents
          ? text(
              "Rapprochement en cours : les inscriptions non soldées restent masquées aux parents.",
              "Reconciliation in progress: unpaid registration charges stay hidden from parents.",
              "المطابقة جارية: معاليم التسجيل غير المسددة مخفية عن الأولياء.",
            )
          : text(
              "Les inscriptions non soldées seront visibles aux parents.",
              "Unpaid registration charges will be visible to parents.",
              "ستظهر معاليم التسجيل غير المسددة للأولياء.",
            ),
        text(
          "L’activation génère une seule échéance par élève et par année scolaire. Les échéances existantes ne sont pas modifiées.",
          "Enabling generates one charge per student per school year. Existing charges stay unchanged.",
          "يُنشئ التفعيل استحقاقاً واحداً لكل تلميذ في السنة. لا تتغير الاستحقاقات السابقة.",
        ),
      ],
      payload: {
        action: "settings",
        registrationFeeEnabled: registrationEnabled,
        hideCurrentRegistrationFromParents,
        registrationFee: Number(registrationFee.replace(",", ".")),
        transportMonthlyFee:
          transportFee.trim() === ""
            ? null
            : Number(transportFee.replace(",", ".")),
        gardeMonthlyFee:
          gardeFee.trim() === "" ? null : Number(gardeFee.replace(",", ".")),
        transportFrequency,
        gardeFrequency,
      },
    });
  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-8"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            {data?.academicYear ||
              text("Vie scolaire", "School finance", "مالية المدرسة")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {text(
              "Inscriptions & services",
              "Registration & services",
              "التسجيل والخدمات",
            )}
          </h1>
          {tab !== "settings" && (
            <p className="mt-2 text-sm text-slate-600">
              {text(
                "Des frais distincts de la scolarité, avec un suivi clair pour chaque élève.",
                "Separate from tuition, with a clear ledger for every student.",
                "معاليم مستقلة عن التمدرس وسجل واضح لكل تلميذ.",
              )}
            </p>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm"
        >
          <RefreshCw size={16} />
          {text("Actualiser", "Refresh", "تحديث")}
        </button>
      </div>
      {error && !review && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label={text("Fermer", "Dismiss", "إغلاق")}
            className="rounded p-1 hover:bg-emerald-100"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {data?.config.registrationReconciliationYear === data?.academicYear && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {text(
            "Inscriptions en rapprochement · Les frais impayés restent masqués aux parents.",
            "Registration reconciliation in progress · Unpaid fees are hidden from parents.",
            "مطابقة معاليم التسجيل جارية · المعاليم غير المسددة مخفية عن الأولياء.",
          )}
        </p>
      )}
      {tab === "charges" && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            [text("Facturé", "Billed", "المستحق"), data?.summary.billed],
            [text("Encaissé", "Collected", "المقبوض"), data?.summary.paid],
            [
              data?.config.registrationReconciliationYear === data?.academicYear
                ? text("À rapprocher", "To reconcile", "للمطابقة")
                : text("Reste à encaisser", "Outstanding", "المتبقي"),
              Math.max(
                0,
                (data?.summary.billed || 0) - (data?.summary.paid || 0),
              ),
            ],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className="rounded-2xl border bg-white p-3 sm:p-5"
            >
              <span className="text-xs text-slate-500 sm:text-sm">{label}</span>
              <p
                className={`mt-2 text-lg font-semibold sm:text-2xl ${index === 2 ? "text-amber-700" : "text-slate-900"}`}
              >
                {data ? currency(Number(value)) : "—"}
              </p>
            </div>
          ))}
        </div>
      )}
      <nav
        aria-label={text(
          "Rubriques financières",
          "Billing sections",
          "أقسام المعاليم",
        )}
        className="flex gap-2 overflow-auto border-b pb-3"
      >
        {(["settings", "services", "charges"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
          >
            {key === "settings"
              ? text(
                  "Tarifs & services",
                  "Fees & services",
                  "المعاليم والخدمات",
                )
              : key === "services"
                ? text(
                    "Élèves inscrits",
                    "Student subscriptions",
                    "اشتراكات التلاميذ",
                  )
                : text("Paiements", "Payments", "الدفعات")}
          </button>
        ))}
      </nav>
      {!data ? (
        <div
          className="h-44 animate-pulse rounded-2xl bg-slate-100"
          aria-label={text("Chargement", "Loading", "جاري التحميل")}
        />
      ) : tab === "charges" ? (
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="border-b bg-slate-50/60 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {text(
                    "Échéances des élèves",
                    "Student charges",
                    "معاليم التلاميذ",
                  )}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {data.total}{" "}
                  {text(
                    "résultats dans cette vue",
                    "results in this view",
                    "نتائج في هذا العرض",
                  )}
                </p>
              </div>
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setKind("");
                    setStatus("DUE");
                    setPeriod("");
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  {text(
                    "Réinitialiser les filtres",
                    "Clear filters",
                    "مسح المرشحات",
                  )}
                </button>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="relative block text-xs font-medium text-slate-600">
                {text("Rechercher", "Search", "بحث")}
                <span className="relative mt-1 block">
                  <Search
                    size={16}
                    className="absolute top-3 left-3 text-slate-400"
                  />
                  <input
                    aria-label={text(
                      "Rechercher un élève ou une classe",
                      "Search student or class",
                      "البحث عن تلميذ أو قسم",
                    )}
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder={text(
                      "Élève ou classe…",
                      "Student or class…",
                      "تلميذ أو قسم…",
                    )}
                    className={`${input} pl-9`}
                  />
                </span>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {text("Type de frais", "Charge type", "نوع المعلوم")}
                <select
                  aria-label={text(
                    "Type de frais",
                    "Charge type",
                    "نوع المعاليم",
                  )}
                  value={kind}
                  onChange={(event) => {
                    setKind(event.target.value);
                    setPage(1);
                  }}
                  className={`${input} mt-1`}
                >
                  <option value="">
                    {text("Tous les frais", "All charges", "كل المعاليم")}
                  </option>
                  {[
                    "REGISTRATION",
                    "TRANSPORT",
                    "GARDE",
                    ...data.categories.map((category) => category.kind),
                  ].map((value) => (
                    <option key={value} value={value}>
                      {title(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {text("Statut", "Status", "الحالة")}
                <select
                  aria-label={text("Statut", "Status", "الحالة")}
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className={`${input} mt-1`}
                >
                  <option value="DUE">
                    {data.config.registrationReconciliationYear ===
                    data.academicYear
                      ? text(
                          "À rapprocher ou encaisser",
                          "Reconcile or collect",
                          "للمطابقة أو القبض",
                        )
                      : text("À encaisser", "Outstanding", "للقبض")}
                  </option>
                  <option value="PAID">
                    {text("Soldées", "Paid", "خالصة")}
                  </option>
                  <option value="">{text("Toutes", "All", "الكل")}</option>
                  <option value="VOIDED">
                    {text("Annulées", "Voided", "ملغاة")}
                  </option>
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {text("Mois", "Month", "الشهر")}
                <input
                  aria-label={text(
                    "Mois (facultatif)",
                    "Month (optional)",
                    "الشهر (اختياري)",
                  )}
                  type="month"
                  value={period}
                  onChange={(event) => {
                    setPeriod(event.target.value);
                    setPage(1);
                  }}
                  className={`${input} mt-1`}
                />
              </label>
            </div>
          </div>
          {!data.charges.length ? (
            <div className="p-12 text-center">
              <ShieldCheck className="mx-auto text-emerald-600" />
              <h2 className="mt-3 font-semibold">
                {text(
                  "Aucune échéance à afficher",
                  "No charges to show",
                  "لا توجد استحقاقات",
                )}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {text(
                  "Vérifiez vos filtres ou configurez les tarifs et les services.",
                  "Check your filters or configure rates and services.",
                  "راجع المرشحات أو اضبط المعاليم والخدمات.",
                )}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {data.charges.map((charge) => {
                const due =
                  Math.round((charge.amount - charge.paidAmount) * 1000) / 1000;
                return (
                  <article
                    key={charge.id}
                    className="grid gap-4 p-4 transition-colors hover:bg-slate-50/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${charge.kind === "TRANSPORT" ? "bg-sky-50 text-sky-700" : charge.kind === "GARDE" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}
                      >
                        {charge.kind === "TRANSPORT" ? (
                          <Bus size={19} />
                        ) : charge.kind === "GARDE" ? (
                          <ShieldCheck size={19} />
                        ) : (
                          <Receipt size={19} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">
                            {charge.student.name} {charge.student.surname}
                          </h3>
                          {charge.student.class && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              {charge.student.class.name}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {title(charge.kind)} · {charge.period}
                        </p>
                        {charge.paidAmount > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            {text("Encaissé", "Collected", "المقبوض")}{" "}
                            {currency(charge.paidAmount)} /{" "}
                            {currency(charge.amount)}
                          </p>
                        )}
                        {charge.payments.length > 0 && (
                          <details className="mt-2 text-xs text-slate-500">
                            <summary className="cursor-pointer font-medium text-blue-700">
                              {text(
                                "Historique des règlements",
                                "Payment history",
                                "سجل الدفعات",
                              )}
                            </summary>
                            {charge.payments.map((payment) => (
                              <p key={payment.id} className="mt-1">
                                {new Date(payment.paidAt).toLocaleDateString()}{" "}
                                · {currency(payment.amount)} ·{" "}
                                {payment.paymentMethod}
                              </p>
                            ))}
                          </details>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                      <div className="min-w-28 sm:text-right">
                        <p
                          className={`text-[11px] font-semibold uppercase tracking-wide ${charge.voidedAt ? "text-slate-500" : due <= 0 ? "text-emerald-700" : "text-amber-700"}`}
                        >
                          {charge.voidedAt
                            ? text("Annulée", "Voided", "ملغاة")
                            : due <= 0
                              ? text("Soldée", "Paid", "خالصة")
                              : charge.kind === "REGISTRATION" &&
                                  data.config.registrationReconciliationYear ===
                                    data.academicYear
                                ? text(
                                    "À rapprocher",
                                    "To reconcile",
                                    "للمطابقة",
                                  )
                                : text(
                                    "Reste à payer",
                                    "Balance due",
                                    "المتبقي",
                                  )}
                        </p>
                        <p
                          className={`mt-0.5 text-lg font-semibold ${charge.voidedAt ? "text-slate-400" : due <= 0 ? "text-emerald-700" : "text-slate-900"}`}
                        >
                          {currency(charge.voidedAt ? 0 : due)}
                        </p>
                      </div>
                      {!charge.voidedAt && due > 0 && (
                        <StudentBillingModal
                          studentId={charge.student.id}
                          studentName={`${charge.student.name} ${charge.student.surname}`}
                          monthName={getMonthKey(undefined)}
                          isAdmin
                          initialChargeId={charge.id}
                          triggerLabel={text("Encaisser", "Collect", "قبض")}
                          onPaymentRecorded={() => {
                            void load();
                          }}
                        />
                      )}
                      {!charge.voidedAt &&
                        charge.paidAmount === 0 &&
                        charge.amount > 0 && (
                          <button
                            aria-label={text(
                              "Annuler cette échéance",
                              "Void this charge",
                              "إلغاء الاستحقاق",
                            )}
                            className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() =>
                              open({
                                title: text(
                                  "Annuler cette échéance",
                                  "Void this charge",
                                  "إلغاء الاستحقاق",
                                ),
                                lines: [
                                  name(charge.student),
                                  `${title(charge.kind)} · ${charge.period} · ${currency(charge.amount)}`,
                                  text(
                                    "Aucun règlement ne sera supprimé.",
                                    "No payment will be deleted.",
                                    "لن تُحذف أي دفعة.",
                                  ),
                                ],
                                payload: {
                                  action: "void",
                                  chargeId: charge.id,
                                },
                                charge,
                                mode: "void",
                              })
                            }
                          >
                            <X size={17} />
                          </button>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <footer className="flex items-center justify-between border-t p-4 text-sm text-slate-500">
            <span>
              {data.total} · {text("Page", "Page", "صفحة")} {page}/
              {Math.max(1, Math.ceil(data.total / 25))}
            </span>
            <div className="flex gap-2">
              <button
                aria-label={text(
                  "Page précédente",
                  "Previous page",
                  "الصفحة السابقة",
                )}
                disabled={page === 1 || busy}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-lg border p-2 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                aria-label={text(
                  "Page suivante",
                  "Next page",
                  "الصفحة التالية",
                )}
                disabled={page * 25 >= data.total || busy}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border p-2 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        </section>
      ) : tab === "services" ? (
        <ServiceAssignments
          data={data}
          onSaved={load}
          initialKind={selectedServiceKind}
          onEditService={(kind) => {
            if (kind === "TRANSPORT" || kind === "GARDE") setEditingFee(kind);
            setTab("settings");
          }}
        />
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <h2 className="font-semibold text-slate-900">
                {text("Tarifs de l’école", "School fees", "معاليم المدرسة")}
              </h2>
              {changedFeeCount > 0 && (
                <span className="text-xs font-medium text-blue-700">
                  {changedFeeCount}{" "}
                  {text("à enregistrer", "unsaved", "غير محفوظ")}
                </span>
              )}
            </div>
            {(["REGISTRATION", "TRANSPORT", "GARDE"] as const).map((fee) => {
              const feePrice =
                fee === "REGISTRATION"
                  ? registrationFee
                  : fee === "TRANSPORT"
                    ? transportFee
                    : gardeFee;
              const assigned = data.services.filter(
                (service) => service.kind === fee && service.active,
              ).length;
              const frequency =
                fee === "REGISTRATION"
                  ? "YEARLY"
                  : fee === "TRANSPORT"
                    ? transportFrequency
                    : gardeFrequency;
              const selected = editingFee === fee;
              return (
                <section key={fee} className="border-t border-slate-200">
                  <button
                    type="button"
                    aria-expanded={selected}
                    onClick={() => setEditingFee(selected ? null : fee)}
                    className={`flex w-full items-center justify-between gap-4 px-4 py-4 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:px-5 ${selected ? "bg-blue-50/60" : "hover:bg-slate-50"}`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-semibold text-slate-900">
                        {title(fee)}
                        {feeChanged(fee) && (
                          <span
                            className="h-2 w-2 rounded-full bg-blue-600"
                            aria-label={text(
                              "Modifié",
                              "Changed",
                              "تم التعديل",
                            )}
                          />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {frequency === "YEARLY"
                          ? text(
                              "Une fois par an",
                              "Once a year",
                              "مرة في السنة",
                            )
                          : text("Chaque mois", "Every month", "كل شهر")}
                        {fee !== "REGISTRATION" &&
                          ` · ${assigned} ${text("élèves", "students", "تلاميذ")}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">
                        {fee === "REGISTRATION" && !registrationEnabled
                          ? text("Désactivé", "Disabled", "معطّل")
                          : feePrice.trim()
                            ? currency(Number(feePrice.replace(",", ".")))
                            : text(
                                "Prix non défini",
                                "Price not set",
                                "السعر غير محدد",
                              )}
                      </span>
                      <ChevronRight
                        size={18}
                        className={`text-slate-400 transition-transform ${selected ? "rotate-90" : ""}`}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                  {selected && (
                    <form
                      className="border-t border-blue-100 bg-slate-50/50 px-4 py-4 sm:px-5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (settingsChanged) reviewSettings();
                      }}
                    >
                      {fee !== "REGISTRATION" && (
                        <button
                          type="button"
                          className="text-sm font-semibold text-blue-700 hover:underline"
                          onClick={() => {
                            setSelectedServiceKind(fee);
                            setTab("services");
                          }}
                        >
                          {text(
                            "Gérer les élèves inscrits →",
                            "Manage assigned students →",
                            "إدارة التلاميذ المسجلين ←",
                          )}
                        </button>
                      )}
                      <div className="mt-5 max-w-2xl">
                        {editingFee === "REGISTRATION" && (
                          <section>
                            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800">
                              {text(
                                "Activer les frais d’inscription",
                                "Enable registration fee",
                                "تفعيل معلوم التسجيل",
                              )}
                              <input
                                type="checkbox"
                                checked={registrationEnabled}
                                onChange={(event) =>
                                  setRegistrationEnabled(event.target.checked)
                                }
                                className="h-5 w-5 accent-blue-600"
                              />
                            </label>
                            <label className="mt-4 block text-sm font-medium text-slate-700">
                              {text(
                                "Prix par élève",
                                "Price per student",
                                "السعر لكل تلميذ",
                              )}{" "}
                              · TND
                              <input
                                className={`${input} mt-2`}
                                inputMode="decimal"
                                required
                                value={registrationFee}
                                onChange={(event) =>
                                  setRegistrationFee(event.target.value)
                                }
                              />
                            </label>
                            <details className="mt-4 rounded-xl border bg-slate-50/60 p-3 text-sm">
                              <summary className="cursor-pointer font-medium text-slate-700">
                                {text(
                                  "Paiements reçus avant SnapSchool",
                                  "Payments collected before SnapSchool",
                                  "دفعات قُبضت قبل سناب سكول",
                                )}
                              </summary>
                              <label className="mt-3 flex items-start gap-3 text-xs leading-5 text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={hideCurrentRegistrationFromParents}
                                  onChange={(event) =>
                                    setHideCurrentRegistrationFromParents(
                                      event.target.checked,
                                    )
                                  }
                                  className="mt-0.5 h-4 w-4 shrink-0"
                                />
                                <span>
                                  <strong className="block">
                                    {text(
                                      "Rapprochement des paiements déjà reçus",
                                      "Reconcile fees already collected",
                                      "مطابقة المعاليم المقبوضة سابقاً",
                                    )}
                                  </strong>
                                  {text(
                                    "Masquer les frais impayés aux parents pendant la saisie. Désactivez après vérification.",
                                    "Hide unpaid fees from parents while recording earlier payments. Turn off after checking.",
                                    "إخفاء المعاليم غير المسددة عن الأولياء أثناء تسجيل الدفعات السابقة، ثم أوقف الإخفاء بعد المراجعة.",
                                  )}
                                </span>
                              </label>
                            </details>
                          </section>
                        )}
                        {(
                          [
                            [
                              "TRANSPORT",
                              transportFee,
                              setTransportFee,
                              transportFrequency,
                              setTransportFrequency,
                              data.config.transportNextFrequency,
                            ],
                            [
                              "GARDE",
                              gardeFee,
                              setGardeFee,
                              gardeFrequency,
                              setGardeFrequency,
                              data.config.gardeNextFrequency,
                            ],
                          ] as const
                        )
                          .filter(([fee]) => fee === editingFee)
                          .map(
                            ([
                              fee,
                              value,
                              setValue,
                              frequency,
                              setFrequency,
                              pending,
                            ]) => (
                              <section key={fee} className="space-y-5">
                                <label className="block text-sm font-semibold text-slate-800">
                                  {text(
                                    "Prix par élève",
                                    "Price per student",
                                    "السعر لكل تلميذ",
                                  )}
                                  <span className="mt-2 flex max-w-sm items-center rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-500">
                                    <input
                                      className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-lg font-semibold outline-none"
                                      inputMode="decimal"
                                      value={value}
                                      onChange={(event) =>
                                        setValue(event.target.value)
                                      }
                                      placeholder={text(
                                        "Non défini",
                                        "Not set",
                                        "غير محدد",
                                      )}
                                    />
                                    <span className="pe-4 text-sm font-semibold text-slate-500">
                                      TND
                                    </span>
                                  </span>
                                </label>
                                <fieldset>
                                  <legend className="text-sm font-semibold text-slate-800">
                                    {text(
                                      "Rythme de facturation",
                                      "Billing frequency",
                                      "دورية الفوترة",
                                    )}
                                  </legend>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {(["MONTHLY", "YEARLY"] as const).map(
                                      (option) => (
                                        <label
                                          key={option}
                                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 transition-colors ${frequency === option ? "border-blue-500 bg-blue-50/70" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                                        >
                                          <input
                                            type="radio"
                                            name={`frequency-${fee}`}
                                            value={option}
                                            checked={frequency === option}
                                            onChange={() =>
                                              setFrequency(option)
                                            }
                                            className="h-4 w-4 accent-blue-600"
                                          />
                                          <span className="text-sm font-medium text-slate-900">
                                            {option === "MONTHLY"
                                              ? text(
                                                  "Chaque mois",
                                                  "Every month",
                                                  "كل شهر",
                                                )
                                              : text(
                                                  "Une fois par an",
                                                  "Once a year",
                                                  "مرة في السنة",
                                                )}
                                          </span>
                                        </label>
                                      ),
                                    )}
                                  </div>
                                </fieldset>
                                {(pending ||
                                  frequency !==
                                    (fee === "TRANSPORT"
                                      ? data.config.transportFrequency
                                      : data.config.gardeFrequency)) && (
                                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                                    {text(
                                      "Le changement de périodicité prendra effet la prochaine année scolaire.",
                                      "A frequency change takes effect next school year.",
                                      "يبدأ تغيير دورية الفوترة في السنة الدراسية القادمة.",
                                    )}
                                  </p>
                                )}
                              </section>
                            ),
                          )}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                        <span className="text-xs text-slate-500">
                          {feeChanged(fee)
                            ? text(
                                "Modification à vérifier",
                                "Change ready to review",
                                "تعديل جاهز للمراجعة",
                              )
                            : text(
                                "Aucune modification",
                                "No changes",
                                "لا توجد تعديلات",
                              )}
                        </span>
                        {settingsChanged && (
                          <button disabled={busy} className={button}>
                            {text(
                              "Vérifier et enregistrer",
                              "Review and save",
                              "مراجعة وحفظ",
                            )}
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                </section>
              );
            })}
          </div>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 font-semibold text-slate-900 hover:bg-slate-50 sm:px-5">
              <span>
                {text("Autres catégories", "Other categories", "أصناف أخرى")}
                {data.categories.length > 0
                  ? ` · ${data.categories.length}`
                  : ""}
              </span>
              <ChevronRight
                size={18}
                className="text-slate-400 transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
            </summary>
            <div className="mt-3">
              <CustomCategories
                data={data}
                onSaved={load}
                onAssign={(selectedKind) => {
                  setSelectedServiceKind(selectedKind);
                  setTab("services");
                }}
              />
            </div>
          </details>
        </div>
      )}
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setReview(null);
        }}
        onClose={() => {
          if (!busy) setReview(null);
        }}
        className="w-[calc(100%-2rem)] max-w-lg rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/40"
      >
        <div className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold">{review?.title}</h2>
            <button
              disabled={busy}
              aria-label={text("Fermer", "Close", "إغلاق")}
              onClick={() => setReview(null)}
              className="rounded-lg p-1 text-slate-500"
            >
              <X size={20} />
            </button>
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            {review?.lines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
          {review?.mode === "collect" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm">
                {text(
                  "Montant reçu (TND)",
                  "Amount received (TND)",
                  "المبلغ المقبوض (د.ت)",
                )}
                <input
                  autoFocus
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={`${input} mt-2`}
                />
              </label>
              <label className="text-sm">
                {text(
                  "Date réelle du paiement",
                  "Actual payment date",
                  "تاريخ الدفع الفعلي",
                )}
                <input
                  type="date"
                  value={paidOn}
                  max={new Date().toLocaleDateString("en-CA", {
                    timeZone: "Africa/Tunis",
                  })}
                  onChange={(event) => setPaidOn(event.target.value)}
                  className={`${input} mt-2`}
                />
              </label>
              <label className="text-sm">
                {text("Règlement", "Payment method", "طريقة الدفع")}
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className={`${input} mt-2`}
                >
                  {["Espèces", "Chèque", "Virement", "Carte"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {review?.mode === "void" && (
            <label className="block text-sm">
              {text("Motif", "Reason", "السبب")}
              <textarea
                autoFocus
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                className={`${input} mt-2`}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}
          <p className="text-xs text-slate-500">
            {text(
              "Aucune opération avant votre confirmation.",
              "No action before your confirmation.",
              "لن تُنفّذ أي عملية قبل تأكيدكم.",
            )}
          </p>
          <div className="flex justify-end gap-3">
            <button
              disabled={busy}
              onClick={() => setReview(null)}
              className="rounded-xl border px-4 py-2.5 text-sm"
            >
              {text("Retour", "Back", "رجوع")}
            </button>
            <button
              disabled={
                busy || (review?.mode === "void" && reason.trim().length < 3)
              }
              onClick={confirm}
              className={`${button} flex items-center gap-2`}
            >
              <Check size={16} />
              {busy
                ? text("Enregistrement…", "Saving…", "جاري الحفظ…")
                : text("Confirmer", "Confirm", "تأكيد")}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
