"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Download } from "lucide-react";
import { MONTHS, getSchoolYearMonths } from "@/lib/dateUtils";
import { tuitionForMonth } from "@/lib/tuitionPolicy";
import { useLanguage } from "@/lib/translations/LanguageContext";

type Charge = {
  id: string;
  kind: string;
  period: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
};
type Billing = {
  tuitionFee: number;
  halfBoundaryMonths: boolean;
  payments: { month: number; year: number; amount: number; status: string }[];
  charges: Charge[];
};
export default function StudentBillingModal({
  studentId,
  studentName,
  monthName,
  isAdmin,
  onTuitionPaid,
}: {
  studentId: string;
  studentName: string;
  monthName: string;
  isAdmin: boolean;
  onTuitionPaid?: (
    amount: number,
    status: "PAID" | "PARTIAL",
    month: string,
  ) => void;
}) {
  const { locale } = useLanguage();
  const t = (fr: string, en: string, ar: string) =>
    locale === "ar" ? ar : locale === "en" ? en : fr;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [month, setMonth] = useState(monthName);
  const [tuitionChecked, setTuitionChecked] = useState(true);
  const [tuitionAmount, setTuitionAmount] = useState("");
  const [extraTuition, setExtraTuition] = useState<Record<string, string>>({});
  const [chargeAmounts, setChargeAmounts] = useState<Record<string, string>>(
    {},
  );
  const [chosen, setChosen] = useState<string[]>([]);
  const [paidOn, setPaidOn] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Tunis" }),
  );
  const [method, setMethod] = useState("Espèces");
  const [review, setReview] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; total: number } | null>(
    null,
  );
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `/api/admin/student-billing?studentId=${encodeURIComponent(studentId)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok || !value.success)
          throw new Error(value.error || "Unable to load billing");
        return value as Billing;
      })
      .then((value) => {
        setData(value);
        setChosen([]);
        setChargeAmounts({});
        setExtraTuition({});
        setReceipt(null);
        setIdempotencyKey(crypto.randomUUID());
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, studentId]);
  const [monthLabel, yearText] = month.split(" ");
  const monthNo = MONTHS.indexOf(monthLabel) + 1;
  const year = Number(yearText);
  const existing = data?.payments.find(
    (p) => p.month === monthNo && p.year === year,
  );
  const expected = data
    ? tuitionForMonth(data.tuitionFee, monthNo, data.halfBoundaryMonths)
    : 0;
  const due = Math.max(
    0,
    Math.round((expected - (existing?.amount || 0)) * 1000) / 1000,
  );
  useEffect(() => {
    setTuitionAmount(String(due));
    setTuitionChecked(due > 0);
  }, [due, month]);
  const dueCharges = useMemo(
    () => data?.charges.filter((c) => c.amount - c.paidAmount > 0) || [],
    [data],
  );
  const tuitionDue = (monthYear: string) => {
    if (!data) return 0;
    const [label, yearLabel] = monthYear.split(" ");
    const monthNumber = MONTHS.indexOf(label) + 1;
    const paid = data.payments.find(
      (payment) =>
        payment.month === monthNumber && payment.year === Number(yearLabel),
    );
    return Math.max(
      0,
      Math.round(
        (tuitionForMonth(
          data.tuitionFee,
          monthNumber,
          data.halfBoundaryMonths,
        ) -
          (paid?.amount || 0)) *
          1000,
      ) / 1000,
    );
  };
  const availableExtraMonths = getSchoolYearMonths().filter(
    (candidate) =>
      candidate !== month &&
      !(candidate in extraTuition) &&
      tuitionDue(candidate) > 0,
  );
  const chosenCharges = dueCharges.filter((c) => chosen.includes(c.id));
  const total =
    Math.round(
      ((tuitionChecked ? Number(tuitionAmount.replace(",", ".")) || 0 : 0) +
        Object.values(extraTuition).reduce(
          (sum, amount) => sum + (Number(amount.replace(",", ".")) || 0),
          0,
        ) +
        chosenCharges.reduce(
          (sum, c) =>
            sum +
            (Number(
              (chargeAmounts[c.id] || String(c.amount - c.paidAmount)).replace(
                ",",
                ".",
              ),
            ) || 0),
          0,
        )) *
        1000,
    ) / 1000;
  const validTuition =
    !tuitionChecked ||
    (Number(tuitionAmount.replace(",", ".")) > 0 &&
      Number(tuitionAmount.replace(",", ".")) <= due);
  const validExtraTuition = Object.entries(extraTuition).every(
    ([monthYear, amount]) => {
      const value = Number(amount.replace(",", "."));
      return (
        monthYear !== month &&
        Number.isFinite(value) &&
        value > 0 &&
        value <= tuitionDue(monthYear)
      );
    },
  );
  const validCharges = chosenCharges.every((c) => {
    const value = Number(
      (chargeAmounts[c.id] || String(c.amount - c.paidAmount)).replace(
        ",",
        ".",
      ),
    );
    return (
      Number.isFinite(value) && value > 0 && value <= c.amount - c.paidAmount
    );
  });
  const send = async () => {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      const tuition = [
        ...(tuitionChecked
          ? [
              {
                monthYear: month,
                amount: Number(tuitionAmount.replace(",", ".")),
              },
            ]
          : []),
        ...Object.entries(extraTuition).map(([monthYear, amount]) => ({
          monthYear,
          amount: Number(amount.replace(",", ".")),
        })),
      ];
      const charges = chosenCharges.map((c) => ({
        id: c.id,
        amount: Number(
          (chargeAmounts[c.id] || String(c.amount - c.paidAmount)).replace(
            ",",
            ".",
          ),
        ),
      }));
      const response = await fetch("/api/admin/student-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          idempotencyKey,
          tuition,
          charges,
          paidOn,
          paymentMethod: method,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || "Payment failed");
      setReceipt({ id: result.receiptId, total: result.total });
      setReview(false);
      if (tuitionChecked && onTuitionPaid)
        onTuitionPaid(
          (existing?.amount || 0) + Number(tuitionAmount.replace(",", ".")),
          (existing?.amount || 0) + Number(tuitionAmount.replace(",", ".")) >=
            expected
            ? "PAID"
            : "PARTIAL",
          month,
        );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReview(false);
    } finally {
      setBusy(false);
    }
  };
  const downloadReceipt = async () => {
    if (!receipt || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/student-billing/receipt/${encodeURIComponent(receipt.id)}`,
        { cache: "no-store" },
      );
      if (
        !response.ok ||
        !response.headers.get("Content-Type")?.includes("application/pdf")
      ) {
        throw new Error(
          t(
            "Le reçu est indisponible. Réessayez.",
            "Receipt unavailable. Please try again.",
            "الوصل غير متاح. حاول مرة أخرى.",
          ),
        );
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] || "Recu-SnapSchool.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDownloading(false);
    }
  };
  return (
    <>
      <button
        disabled={!isAdmin}
        onClick={() => {
          setMonth(monthName);
          setOpen(true);
        }}
        title={t("Encaisser", "Collect payment", "استخلاص")}
        className="flex h-8 w-8 items-center justify-center rounded-md border bg-white shadow-sm disabled:opacity-50"
      >
        <Banknote size={16} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4"
          role="dialog"
          aria-modal="true"
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {t(
                    "Encaisser un paiement",
                    "Collect a payment",
                    "استخلاص دفعة",
                  )}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{studentName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border px-3 py-1 text-slate-500"
                aria-label={t("Fermer", "Close", "إغلاق")}
              >
                ×
              </button>
            </div>
            {loading && (
              <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm">
                {t(
                  "Chargement des soldes…",
                  "Loading balances…",
                  "جار تحميل الأرصدة…",
                )}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
            {receipt ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="font-semibold text-emerald-800">
                  {t(
                    "Paiement enregistré",
                    "Payment recorded",
                    "تم تسجيل الدفعة",
                  )}
                </p>
                <p className="mt-2 text-sm">{receipt.total} TND</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadReceipt}
                    disabled={downloading}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
                  >
                    <Download size={17} />
                    {downloading
                      ? t("Préparation…", "Preparing…", "جار التحضير…")
                      : t(
                          "Télécharger le reçu",
                          "Download receipt",
                          "تنزيل الوصل",
                        )}
                  </button>
                  <button
                    className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-emerald-800"
                    onClick={() => setOpen(false)}
                  >
                    {t("Terminer", "Done", "تم")}
                  </button>
                </div>
              </div>
            ) : (
              data && (
                <>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t(
                      "Cochez ce que la famille paie aujourd’hui",
                      "Select what the family pays today",
                      "اختر ما تدفعه العائلة اليوم",
                    )}
                  </p>
                  <section className="mt-3 rounded-xl border p-4">
                    <label className="flex items-center gap-3 font-semibold">
                      <input
                        type="checkbox"
                        checked={tuitionChecked}
                        disabled={due <= 0}
                        onChange={(e) => setTuitionChecked(e.target.checked)}
                      />
                      {t("Scolarité", "Tuition", "التمدرس")}
                    </label>
                    <div className="mt-3 flex items-center gap-3">
                      <select
                        className="min-w-0 flex-1 rounded-lg border p-2 text-sm"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                      >
                        {getSchoolYearMonths()
                          .filter((m) => !(m in extraTuition))
                          .map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                      </select>
                      <span className="text-xs text-slate-500">
                        {t("Reste", "Due", "المتبقي")}: {due} TND
                      </span>
                    </div>
                    {tuitionChecked && (
                      <label className="mt-3 block text-sm">
                        {t("Montant reçu", "Amount received", "المبلغ المقبوض")}
                        <input
                          inputMode="decimal"
                          className="mt-1 w-full rounded-lg border p-2"
                          value={tuitionAmount}
                          onChange={(e) => setTuitionAmount(e.target.value)}
                        />
                      </label>
                    )}
                    {Object.entries(extraTuition).map(([monthYear, amount]) => (
                      <div
                        key={monthYear}
                        className="mt-3 flex items-end gap-2 rounded-lg bg-slate-50 p-2"
                      >
                        <div className="min-w-0 flex-1 text-sm">
                          <span className="font-medium">{monthYear}</span>
                          <span className="ml-2 text-xs text-slate-500">
                            {t("Reste", "Due", "المتبقي")}:{" "}
                            {tuitionDue(monthYear)} TND
                          </span>
                          <input
                            aria-label={`${t("Montant reçu", "Amount received", "المبلغ المقبوض")} ${monthYear}`}
                            inputMode="decimal"
                            className="mt-1 w-full rounded-lg border bg-white p-2"
                            value={amount}
                            onChange={(e) =>
                              setExtraTuition((previous) => ({
                                ...previous,
                                [monthYear]: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className="rounded-lg border bg-white px-3 py-2 text-sm"
                          onClick={() =>
                            setExtraTuition((previous) => {
                              const next = { ...previous };
                              delete next[monthYear];
                              return next;
                            })
                          }
                        >
                          {t("Retirer", "Remove", "إزالة")}
                        </button>
                      </div>
                    ))}
                    {availableExtraMonths.length > 0 && (
                      <select
                        aria-label={t(
                          "Ajouter un autre mois",
                          "Add another month",
                          "إضافة شهر آخر",
                        )}
                        className="mt-3 w-full rounded-lg border bg-white p-2 text-sm text-blue-700"
                        value=""
                        onChange={(e) => {
                          if (e.target.value)
                            setExtraTuition((previous) => ({
                              ...previous,
                              [e.target.value]: String(
                                tuitionDue(e.target.value),
                              ),
                            }));
                        }}
                      >
                        <option value="">
                          +{" "}
                          {t(
                            "Ajouter un autre mois",
                            "Add another month",
                            "إضافة شهر آخر",
                          )}
                        </option>
                        {availableExtraMonths.map((candidate) => (
                          <option key={candidate} value={candidate}>
                            {candidate}
                          </option>
                        ))}
                      </select>
                    )}
                  </section>
                  <div className="mt-3 space-y-2">
                    {(["REGISTRATION", "GARDE", "TRANSPORT"] as const).map(
                      (kind) => {
                        const matching = dueCharges.filter(
                          (c) => c.kind === kind,
                        );
                        return (
                          <section key={kind} className="rounded-xl border p-4">
                            <h3 className="font-semibold">
                              {kind === "REGISTRATION"
                                ? t("Inscription", "Registration", "التسجيل")
                                : kind === "GARDE"
                                  ? t("Garde", "After-school care", "الحضانة")
                                  : t("Transport", "Bus", "النقل")}
                            </h3>
                            {matching.length === 0 ? (
                              <p className="mt-1 text-sm text-slate-400">
                                {t(
                                  "Aucune échéance",
                                  "No charge",
                                  "لا توجد معاليم",
                                )}
                              </p>
                            ) : (
                              matching.map((c) => (
                                <div
                                  key={c.id}
                                  className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3"
                                >
                                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={chosen.includes(c.id)}
                                      onChange={(e) =>
                                        setChosen((prev) =>
                                          e.target.checked
                                            ? [...prev, c.id]
                                            : prev.filter((id) => id !== c.id),
                                        )
                                      }
                                    />
                                    <span>
                                      {c.period} ·{" "}
                                      {t("Reste", "Due", "المتبقي")}{" "}
                                      {Math.round(
                                        (c.amount - c.paidAmount) * 1000,
                                      ) / 1000}{" "}
                                      TND
                                    </span>
                                  </label>
                                  {chosen.includes(c.id) && (
                                    <input
                                      aria-label={t(
                                        "Montant reçu",
                                        "Amount received",
                                        "المبلغ المقبوض",
                                      )}
                                      inputMode="decimal"
                                      className="w-28 rounded-lg border p-2 text-sm"
                                      value={
                                        chargeAmounts[c.id] ??
                                        String(
                                          Math.round(
                                            (c.amount - c.paidAmount) * 1000,
                                          ) / 1000,
                                        )
                                      }
                                      onChange={(e) =>
                                        setChargeAmounts((prev) => ({
                                          ...prev,
                                          [c.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  )}
                                </div>
                              ))
                            )}
                          </section>
                        );
                      },
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      {t(
                        "Date réelle du paiement",
                        "Actual payment date",
                        "تاريخ الدفع الفعلي",
                      )}
                      <input
                        type="date"
                        max={new Date().toLocaleDateString("en-CA", {
                          timeZone: "Africa/Tunis",
                        })}
                        className="mt-1 w-full rounded-lg border p-2"
                        value={paidOn}
                        onChange={(e) => setPaidOn(e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      {t("Mode de paiement", "Payment method", "طريقة الدفع")}
                      <select
                        className="mt-1 w-full rounded-lg border p-2"
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                      >
                        {["Espèces", "Chèque", "Virement", "Carte"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-xl bg-blue-50 p-4">
                    <span className="font-semibold">
                      {t("Total à enregistrer", "Total to record", "المجموع")}
                    </span>
                    <strong className="text-lg text-blue-700">
                      {total} TND
                    </strong>
                  </div>
                  {review ? (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="font-semibold">
                        {t(
                          "Confirmer cette répartition ?",
                          "Confirm this allocation?",
                          "تأكيد توزيع الدفعة؟",
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {t(
                          "Chaque ligne sera enregistrée séparément, sur un seul reçu.",
                          "Each item will be recorded separately on one receipt.",
                          "سيتم تسجيل كل بند على حدة في وصل واحد.",
                        )}
                      </p>
                      <div className="mt-3 space-y-1 rounded-lg bg-white p-3 text-sm">
                        {tuitionChecked && (
                          <p className="flex justify-between gap-2">
                            <span>
                              {t("Scolarité", "Tuition", "التمدرس")} · {month}
                            </span>
                            <strong>{tuitionAmount} TND</strong>
                          </p>
                        )}
                        {Object.entries(extraTuition).map(
                          ([monthYear, amount]) => (
                            <p
                              key={monthYear}
                              className="flex justify-between gap-2"
                            >
                              <span>
                                {t("Scolarité", "Tuition", "التمدرس")} ·{" "}
                                {monthYear}
                              </span>
                              <strong>{amount} TND</strong>
                            </p>
                          ),
                        )}
                        {chosenCharges.map((charge) => (
                          <p
                            key={charge.id}
                            className="flex justify-between gap-2"
                          >
                            <span>
                              {charge.kind === "REGISTRATION"
                                ? t("Inscription", "Registration", "التسجيل")
                                : charge.kind === "GARDE"
                                  ? t("Garde", "After-school care", "الحضانة")
                                  : t("Transport", "Bus", "النقل")}{" "}
                              · {charge.period}
                            </span>
                            <strong>
                              {chargeAmounts[charge.id] ??
                                Math.round(
                                  (charge.amount - charge.paidAmount) * 1000,
                                ) / 1000}{" "}
                              TND
                            </strong>
                          </p>
                        ))}
                        <p className="flex justify-between gap-2 border-t pt-2 font-semibold">
                          <span>{t("Total", "Total", "المجموع")}</span>
                          <strong>{total} TND</strong>
                        </p>
                        <p className="text-xs text-slate-500">
                          {studentName} · {paidOn} · {method}
                        </p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => setReview(false)}
                          className="flex-1 rounded-lg border bg-white p-2"
                        >
                          {t("Retour", "Back", "رجوع")}
                        </button>
                        <button
                          disabled={busy}
                          onClick={send}
                          className="flex-1 rounded-lg bg-blue-600 p-2 font-semibold text-white"
                        >
                          {busy
                            ? t("En cours…", "Saving…", "جار الحفظ…")
                            : t("Confirmer", "Confirm", "تأكيد")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      disabled={
                        busy ||
                        loading ||
                        total <= 0 ||
                        !validTuition ||
                        !validExtraTuition ||
                        !validCharges ||
                        !paidOn
                      }
                      onClick={() => {
                        setError("");
                        setReview(true);
                      }}
                      className="mt-4 w-full rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-40"
                    >
                      {t(
                        "Vérifier le paiement",
                        "Review payment",
                        "مراجعة الدفعة",
                      )}
                    </button>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
