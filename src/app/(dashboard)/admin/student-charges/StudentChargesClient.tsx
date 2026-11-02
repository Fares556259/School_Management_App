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
    "REGISTRATION" | "TRANSPORT" | "GARDE"
  >("TRANSPORT");
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
      className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8"
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
          <p className="mt-2 text-sm text-slate-600">
            {text(
              "Des frais distincts de la scolarité, avec un suivi clair pour chaque élève.",
              "Separate from tuition, with a clear ledger for every student.",
              "معاليم مستقلة عن التمدرس وسجل واضح لكل تلميذ.",
            )}
          </p>
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
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}
      {data?.config.registrationReconciliationYear === data?.academicYear && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {text(
            "Rapprochement des inscriptions en cours. Enregistrez les frais déjà reçus avec leur date réelle. Les inscriptions non soldées restent masquées aux parents jusqu’à la fin du rapprochement.",
            "Registration reconciliation is in progress. Record fees already received with their actual payment date. Unpaid registration charges stay hidden from parents until reconciliation is complete.",
            "مطابقة معاليم التسجيل جارية. سجّل المعاليم المقبوضة بتاريخ دفعها الفعلي. تبقى المعاليم غير المسددة مخفية عن الأولياء حتى انتهاء المطابقة.",
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
        <div className="space-y-5">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.8fr)]">
            <div className="rounded-2xl border bg-white p-3">
              <p className="px-2 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {text("Choisir un tarif", "Choose a fee", "اختر معلوماً")}
              </p>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {(["REGISTRATION", "TRANSPORT", "GARDE"] as const).map(
                  (fee) => {
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
                    return (
                      <button
                        key={fee}
                        type="button"
                        aria-pressed={editingFee === fee}
                        onClick={() => setEditingFee(fee)}
                        className={`rounded-xl border p-3 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${editingFee === fee ? "border-blue-500 bg-blue-50/70" : "border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-sm text-slate-900">
                            {title(fee)}
                          </strong>
                          {editingFee === fee && (
                            <Check size={17} className="text-blue-600" />
                          )}
                        </div>
                        <div className="mt-1.5 text-base font-semibold text-slate-900">
                          {fee === "REGISTRATION" && !registrationEnabled
                            ? text("Désactivé", "Disabled", "معطّل")
                            : feePrice.trim()
                              ? currency(Number(feePrice.replace(",", ".")))
                              : text(
                                  "Prix non défini",
                                  "Price not set",
                                  "السعر غير محدد",
                                )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {frequency === "YEARLY"
                            ? text(
                                "Une fois par an",
                                "Once a year",
                                "مرة في السنة",
                              )
                            : text("Chaque mois", "Every month", "كل شهر")}
                          {fee !== "REGISTRATION" &&
                            ` · ${assigned} ${text("élèves", "students", "تلاميذ")}`}
                          {feeChanged(fee) && (
                            <span className="font-semibold text-blue-700">
                              {` · ${text("Modifié", "Changed", "تم التعديل")}`}
                            </span>
                          )}
                        </p>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
            <form
              className="rounded-2xl border bg-white p-5 sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (settingsChanged) reviewSettings();
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {text("Modifier le tarif", "Edit fee", "تعديل المعلوم")}
                  </p>
                  <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
                    <Receipt size={19} aria-hidden="true" />
                    {title(editingFee)}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {editingFee === "REGISTRATION"
                      ? text(
                          "Une fois par élève et par année scolaire.",
                          "Once per student each school year.",
                          "مرة لكل تلميذ في السنة الدراسية.",
                        )
                      : `${data.services.filter((service) => service.kind === editingFee && service.active).length} ${text("élèves inscrits", "students assigned", "تلاميذ مسجلون")}`}
                  </p>
                </div>
                {editingFee !== "REGISTRATION" && (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    onClick={() => {
                      setSelectedServiceKind(editingFee);
                      setTab("services");
                    }}
                  >
                    {text(
                      "Gérer les élèves",
                      "Manage students",
                      "إدارة التلاميذ",
                    )}
                  </button>
                )}
              </div>
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
                      <section key={fee} className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700">
                          {text(
                            "Prix par élève",
                            "Price per student",
                            "السعر لكل تلميذ",
                          )}{" "}
                          · TND
                          <input
                            className={`${input} mt-2`}
                            inputMode="decimal"
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            placeholder={text(
                              "Non défini",
                              "Not set",
                              "غير محدد",
                            )}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {text(
                            "Comment facturer ?",
                            "How is it charged?",
                            "كيف تتم الفوترة؟",
                          )}
                          <select
                            className={`${input} mt-2`}
                            value={frequency}
                            onChange={(event) =>
                              setFrequency(event.target.value)
                            }
                          >
                            <option value="MONTHLY">
                              {text("Chaque mois", "Every month", "كل شهر")}
                            </option>
                            <option value="YEARLY">
                              {text(
                                "Une fois par année scolaire",
                                "Once per school year",
                                "مرة في السنة الدراسية",
                              )}
                            </option>
                          </select>
                        </label>
                        {pending && (
                          <p className="mt-2 text-xs text-amber-700">
                            {text(
                              "Changement prévu pour la prochaine année scolaire",
                              "Schedule changes next school year",
                              "تتغير الدورية السنة الدراسية القادمة",
                            )}
                          </p>
                        )}
                      </section>
                    ),
                  )}
              </div>
              <p className="mt-5 max-w-2xl text-xs leading-5 text-slate-500">
                {editingFee === "REGISTRATION"
                  ? text(
                      "Le tarif s’applique aux nouvelles inscriptions. Les échéances déjà émises ne changent pas.",
                      "This fee applies to new registrations. Existing charges stay unchanged.",
                      "ينطبق المعلوم على التسجيلات الجديدة. لا تتغير الاستحقاقات الصادرة سابقاً.",
                    )
                  : text(
                      "Ce tarif sert de valeur par défaut pour les élèves inscrits. Les échéances déjà émises ne changent pas.",
                      "This is the default price for assigned students. Existing charges stay unchanged.",
                      "هذا السعر افتراضي للتلاميذ المسجلين. لا تتغير الاستحقاقات الصادرة سابقاً.",
                    )}
              </p>
              <div className="mt-5 flex justify-end border-t pt-4">
                <button disabled={busy || !settingsChanged} className={button}>
                  {settingsChanged
                    ? text(
                        "Vérifier les modifications",
                        "Review changes",
                        "مراجعة التغييرات",
                      )
                    : text("Aucune modification", "No changes", "لا تغييرات")}
                </button>
              </div>
            </form>
          </div>
          <CustomCategories
            data={data}
            onSaved={load}
            onAssign={(selectedKind) => {
              setSelectedServiceKind(selectedKind);
              setTab("services");
            }}
          />
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
