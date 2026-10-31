"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bus,
  Receipt,
  ShieldCheck,
  Plus,
  X,
  RefreshCw,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";

type Kind = "REGISTRATION" | "TRANSPORT" | "GARDE";
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
    createdAt: string;
  }[];
}
interface Data {
  academicYear: string;
  config: {
    registrationFeeEnabled: boolean;
    registrationFee: number;
    transportMonthlyFee: number | null;
    gardeMonthlyFee: number | null;
  };
  charges: Charge[];
  students: Charge["student"][];
  services: {
    id: string;
    studentId: string;
    kind: Kind;
    monthlyFee: number;
    startPeriod: string;
    active: boolean;
    student: Charge["student"];
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
    "charges",
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("DUE");
  const [kind, setKind] = useState("");
  const [period, setPeriod] = useState("");
  const [page, setPage] = useState(1);
  const [studentId, setStudentId] = useState("");
  const [service, setService] = useState<"TRANSPORT" | "GARDE">("TRANSPORT");
  const [fee, setFee] = useState("");
  const [start, setStart] = useState(
    new Date()
      .toLocaleDateString("en-CA", {
        timeZone: "Africa/Tunis",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .slice(0, 7),
  );
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [registrationFee, setRegistrationFee] = useState("150");
  const [transportFee, setTransportFee] = useState("");
  const [gardeFee, setGardeFee] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Espèces");
  const [reason, setReason] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const currency = (value: number) =>
    `${value.toLocaleString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 3 })} TND`;
  const title = (value: string) =>
    value === "REGISTRATION"
      ? text("Inscription annuelle", "Annual registration", "التسجيل السنوي")
      : value === "TRANSPORT"
        ? text("Transport", "School transport", "النقل المدرسي")
        : text("Garde", "After-school care", "الحضانة");
  const name = (student: Charge["student"]) =>
    `${student.name} ${student.surname}${student.class ? ` · ${student.class.name}` : ""}`;
  const input =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500";
  const button =
    "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
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
  }, [
    data?.config.registrationFeeEnabled,
    data?.config.registrationFee,
    data?.config.transportMonthlyFee,
    data?.config.gardeMonthlyFee,
  ]);
  useEffect(() => {
    if (review && !dialog.current?.open) dialog.current?.showModal();
    if (!review && dialog.current?.open) dialog.current.close();
  }, [review]);
  const open = (value: Review) => {
    setError("");
    setReview(value);
    setReason("");
    setMethod("Espèces");
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
          ? { amount: Number(amount.replace(",", ".")), paymentMethod: method }
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
  const chooseService = (next: "TRANSPORT" | "GARDE") => {
    setService(next);
    const price =
      next === "TRANSPORT"
        ? data?.config.transportMonthlyFee
        : data?.config.gardeMonthlyFee;
    setFee(price === null || price === undefined ? "" : String(price));
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
        text(
          "L’activation génère une seule échéance par élève et par année scolaire. Les échéances existantes ne sont pas modifiées.",
          "Enabling generates one charge per student per school year. Existing charges stay unchanged.",
          "يُنشئ التفعيل استحقاقاً واحداً لكل تلميذ في السنة. لا تتغير الاستحقاقات السابقة.",
        ),
      ],
      payload: {
        action: "settings",
        registrationFeeEnabled: registrationEnabled,
        registrationFee: Number(registrationFee.replace(",", ".")),
        transportMonthlyFee:
          transportFee.trim() === ""
            ? null
            : Number(transportFee.replace(",", ".")),
        gardeMonthlyFee:
          gardeFee.trim() === "" ? null : Number(gardeFee.replace(",", ".")),
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
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          [text("Facturé", "Billed", "المستحق"), data?.summary.billed],
          [text("Encaissé", "Collected", "المقبوض"), data?.summary.paid],
          [
            text("Reste à encaisser", "Outstanding", "المتبقي"),
            Math.max(
              0,
              (data?.summary.billed || 0) - (data?.summary.paid || 0),
            ),
          ],
        ].map(([label, value], index) => (
          <div key={String(label)} className="rounded-2xl border bg-white p-3 sm:p-5">
            <span className="text-xs text-slate-500 sm:text-sm">{label}</span>
            <p
              className={`mt-2 text-lg font-semibold sm:text-2xl ${index === 2 ? "text-amber-700" : "text-slate-900"}`}
            >
              {data ? currency(Number(value)) : "—"}
            </p>
          </div>
        ))}
      </div>
      <nav
        aria-label={text(
          "Rubriques financières",
          "Billing sections",
          "أقسام المعاليم",
        )}
        className="flex gap-2 overflow-auto border-b pb-3"
      >
        {(["charges", "services", "settings"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${tab === key ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
          >
            {key === "charges"
              ? text("Échéances", "Charges", "الاستحقاقات")
              : key === "services"
                ? text(
                    "Services des élèves",
                    "Student services",
                    "خدمات التلاميذ",
                  )
                : text(
                    "Tarifs & activation",
                    "Rates & activation",
                    "المعاليم والتفعيل",
                  )}
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
          <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative">
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
            </label>
            <select
              aria-label={text("Type de frais", "Charge type", "نوع المعاليم")}
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setPage(1);
              }}
              className={input}
            >
              <option value="">
                {text("Tous les frais", "All charges", "كل المعاليم")}
              </option>
              {["REGISTRATION", "TRANSPORT", "GARDE"].map((value) => (
                <option key={value} value={value}>
                  {title(value)}
                </option>
              ))}
            </select>
            <select
              aria-label={text("Statut", "Status", "الحالة")}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={input}
            >
              <option value="DUE">
                {text("À encaisser", "Outstanding", "للقبض")}
              </option>
              <option value="PAID">{text("Soldées", "Paid", "خالصة")}</option>
              <option value="">{text("Toutes", "All", "الكل")}</option>
              <option value="VOIDED">
                {text("Annulées", "Voided", "ملغاة")}
              </option>
            </select>
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
              className={input}
            />
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
                    className="flex flex-wrap items-center justify-between gap-4 p-5"
                  >
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900">
                        {name(charge.student)}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {title(charge.kind)} · {charge.period}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {text("Facturé", "Billed", "المستحق")}:{" "}
                        {currency(charge.amount)} ·{" "}
                        {text("Reçu", "Received", "المقبوض")}:{" "}
                        {currency(charge.paidAmount)}
                      </p>
                      {charge.payments.length > 0 && (
                        <details className="mt-2 text-xs text-slate-500">
                          <summary className="cursor-pointer">
                            {text(
                              "Historique des règlements",
                              "Payment history",
                              "سجل الدفعات",
                            )}
                          </summary>
                          {charge.payments.map((payment) => (
                            <p key={payment.id} className="mt-1">
                              {new Date(payment.createdAt).toLocaleDateString()}{" "}
                              · {currency(payment.amount)} ·{" "}
                              {payment.paymentMethod}
                            </p>
                          ))}
                        </details>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${charge.voidedAt ? "bg-slate-100 text-slate-500" : due <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
                      >
                        {charge.voidedAt
                          ? text("Annulée", "Voided", "ملغاة")
                          : due <= 0
                            ? text("Soldée", "Paid", "خالصة")
                            : currency(due)}
                      </span>
                      {!charge.voidedAt && due > 0 && (
                        <button
                          className={button}
                          onClick={() =>
                            open({
                              title: text(
                                "Confirmer l’encaissement",
                                "Confirm payment",
                                "تأكيد القبض",
                              ),
                              lines: [
                                name(charge.student),
                                `${title(charge.kind)} · ${charge.period}`,
                                `${text("Solde restant", "Remaining balance", "الرصيد المتبقي")}: ${currency(due)}`,
                              ],
                              payload: {
                                action: "collect",
                                chargeId: charge.id,
                                idempotencyKey: crypto.randomUUID(),
                              },
                              charge,
                              mode: "collect",
                            })
                          }
                        >
                          {text("Encaisser", "Collect", "قبض")}
                        </button>
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
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
        <section className="space-y-5">
          <form
            className="space-y-4 rounded-2xl border bg-white p-6"
            onSubmit={(event) => {
              event.preventDefault();
              const student = data.students.find((s) => s.id === studentId);
              if (!student) return;
              open({
                title: text(
                  "Confirmer le service",
                  "Confirm service assignment",
                  "تأكيد إسناد الخدمة",
                ),
                lines: [
                  name(student),
                  `${title(service)} · ${currency(Number(fee.replace(",", ".")))}/${text("mois", "month", "شهر")}`,
                  `${text("À partir de", "Starting", "ابتداءً من")} ${start}`,
                  text(
                    "Seuls les mois commencés sont facturés. Les tarifs de service sont indépendants de la demi-scolarité.",
                    "Only started months are billed. Service rates are independent of half-month tuition.",
                    "تُحتسب الأشهر التي بدأت فقط. معاليم الخدمة مستقلة عن نصف معلوم التمدرس.",
                  ),
                ],
                payload: {
                  action: "assign",
                  studentId,
                  kind: service,
                  monthlyFee: Number(fee.replace(",", ".")),
                  startPeriod: start,
                  active: true,
                },
              });
            }}
          >
            <h2 className="flex items-center gap-2 font-semibold">
              <Bus size={19} />
              {text("Affecter un service", "Assign a service", "إسناد خدمة")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <select
                required
                aria-label={text("Élève", "Student", "التلميذ")}
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className={input}
              >
                <option value="">
                  {text("Choisir un élève", "Choose student", "اختر تلميذاً")}
                </option>
                {data.students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {name(student)}
                  </option>
                ))}
              </select>
              <select
                aria-label={text("Service", "Service", "الخدمة")}
                value={service}
                onChange={(event) => chooseService(event.target.value as any)}
                className={input}
              >
                <option value="TRANSPORT">{title("TRANSPORT")}</option>
                <option value="GARDE">{title("GARDE")}</option>
              </select>
              <input
                required
                aria-label={text(
                  "Prix mensuel en TND",
                  "Monthly price in TND",
                  "المعلوم الشهري بالدينار",
                )}
                inputMode="decimal"
                value={fee}
                onChange={(event) => setFee(event.target.value)}
                placeholder={text(
                  "Tarif à définir (TND)",
                  "Set price (TND)",
                  "حدّد المعلوم (د.ت)",
                )}
                className={input}
              />
              <input
                required
                aria-label={text("Premier mois", "First month", "الشهر الأول")}
                type="month"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className={input}
              />
            </div>
            <button
              disabled={busy || !studentId || fee.trim() === ""}
              className={`${button} flex items-center gap-2`}
            >
              <Plus size={16} />
              {text(
                "Vérifier l’affectation",
                "Review assignment",
                "مراجعة الإسناد",
              )}
            </button>
          </form>
          <div className="divide-y rounded-2xl border bg-white">
            {data.services.length ? (
              data.services.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-5"
                >
                  <div>
                    <h3 className="font-semibold">
                      {name(assignment.student)}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {title(assignment.kind)} ·{" "}
                      {currency(assignment.monthlyFee)}/
                      {text("mois", "month", "شهر")} · {assignment.startPeriod}
                    </p>
                  </div>
                  {assignment.active ? (
                    <button
                      className="rounded-xl border px-4 py-2 text-sm text-slate-600"
                      onClick={() =>
                        open({
                          title: text(
                            "Arrêter ce service",
                            "Stop this service",
                            "إيقاف الخدمة",
                          ),
                          lines: [
                            name(assignment.student),
                            title(assignment.kind),
                            text(
                              "Les échéances existantes restent dues. Aucune nouvelle échéance après l’arrêt.",
                              "Existing charges remain due. No new charges after stopping.",
                              "تبقى الاستحقاقات السابقة مستحقة. لن تُنشأ استحقاقات جديدة بعد الإيقاف.",
                            ),
                          ],
                          payload: {
                            action: "assign",
                            studentId: assignment.studentId,
                            kind: assignment.kind,
                            active: false,
                          },
                        })
                      }
                    >
                      {text("Arrêter", "Stop", "إيقاف")}
                    </button>
                  ) : (
                    <span className="text-sm text-slate-400">
                      {text("Arrêté", "Stopped", "متوقف")}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">
                {text(
                  "Aucun service attribué. Les prix non définis ne créent aucune facturation.",
                  "No services assigned. Unset prices create no charges.",
                  "لا توجد خدمات مسندة. المعاليم غير المحددة لا تنشئ استحقاقات.",
                )}
              </p>
            )}
          </div>
        </section>
      ) : (
        <form
          className="max-w-3xl space-y-6 rounded-2xl border bg-white p-6"
          onSubmit={(event) => {
            event.preventDefault();
            reviewSettings();
          }}
        >
          <h2 className="flex items-center gap-2 font-semibold">
            <Receipt size={20} />
            {text("Tarifs de l’école", "School rates", "معاليم المدرسة")}
          </h2>
          <label className="flex items-center justify-between gap-4 rounded-xl bg-blue-50 p-4">
            <span>
              <span className="block font-semibold">
                {title("REGISTRATION")}
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                {text(
                  "Une fois par élève et par année. En plus de la scolarité.",
                  "Once per student each school year, in addition to tuition.",
                  "مرة واحدة لكل تلميذ في السنة، إضافة إلى معلوم التمدرس.",
                )}
              </span>
            </span>
            <input
              type="checkbox"
              checked={registrationEnabled}
              onChange={(event) => setRegistrationEnabled(event.target.checked)}
              className="h-5 w-5"
            />
          </label>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              [title("REGISTRATION"), registrationFee, setRegistrationFee],
              [title("TRANSPORT"), transportFee, setTransportFee],
              [title("GARDE"), gardeFee, setGardeFee],
            ].map(([label, value, setter]) => (
              <label
                key={String(label)}
                className="text-sm font-medium text-slate-700"
              >
                {String(label)} · TND
                <input
                  className={`${input} mt-2`}
                  inputMode="decimal"
                  required={label === title("REGISTRATION")}
                  value={value as string}
                  onChange={(event) =>
                    (setter as (value: string) => void)(event.target.value)
                  }
                  placeholder={text("Non défini", "Not set", "غير محدد")}
                />
              </label>
            ))}
          </div>
          <p className="text-sm leading-6 text-slate-500">
            {text(
              "Les tarifs de transport et de garde servent de valeurs par défaut. Aucun élève n’est inscrit automatiquement à ces services. Modifier un tarif ne change pas les échéances déjà émises.",
              "Transport and care prices are defaults. Students are never assigned automatically. Changing a price does not change charges already issued.",
              "معاليم النقل والحضانة قيم افتراضية. لا يُسجّل أي تلميذ تلقائياً. تغيير المعلوم لا يغيّر الاستحقاقات الصادرة سابقاً.",
            )}
          </p>
          <button disabled={busy} className={button}>
            {text(
              "Vérifier les modifications",
              "Review changes",
              "مراجعة التغييرات",
            )}
          </button>
        </form>
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
            <div className="grid gap-4 sm:grid-cols-2">
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
