"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Bus, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import type { Data } from "./StudentChargesClient";

type Kind = string;
export default function ServiceAssignments({
  data,
  onSaved,
  initialKind,
}: {
  data: Data;
  onSaved: () => Promise<unknown>;
  initialKind: string;
}) {
  const { locale } = useLanguage();
  const t = (fr: string, en: string, ar: string) =>
    locale === "ar" ? ar : locale === "en" ? en : fr;
  const [kind, setKind] = useState<Kind>(initialKind);
  const [query, setQuery] = useState("");
  const [className, setClassName] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<
    "available" | "assigned" | "all"
  >("available");
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    setKind(initialKind);
    setSelected([]);
  }, [initialKind]);
  const [startPeriod, setStartPeriod] = useState(() =>
    new Date()
      .toLocaleDateString("en-CA", { timeZone: "Africa/Tunis" })
      .slice(0, 7),
  );
  const [discountType, setDiscountType] = useState<"" | "FIXED" | "PERCENT">(
    "",
  );
  const [discountValue, setDiscountValue] = useState("0");
  const [review, setReview] = useState<null | {
    action: "assign" | "assignBulk" | "stop";
    ids: string[];
  }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const category = data.categories.find((item) => item.kind === kind);
  const serviceName =
    kind === "TRANSPORT"
      ? t("Transport", "Bus", "النقل")
      : kind === "GARDE"
        ? t("Garde", "Care", "الحضانة")
        : category?.name || kind;
  const price = category
    ? category.active
      ? category.price
      : null
    : kind === "TRANSPORT"
      ? data.config.transportMonthlyFee
      : data.config.gardeMonthlyFee;
  const configuredFrequency =
    category?.frequency ??
    (kind === "TRANSPORT"
      ? data.config.transportFrequency
      : data.config.gardeFrequency);
  const nextFrequency = category
    ? category.nextFrequency
    : kind === "TRANSPORT"
      ? data.config.transportNextFrequency
      : data.config.gardeNextFrequency;
  const frequencyYear = category
    ? category.frequencyYear
    : kind === "TRANSPORT"
      ? data.config.transportFrequencyYear
      : data.config.gardeFrequencyYear;
  const pendingFrequency =
    nextFrequency && frequencyYear && data.academicYear <= frequencyYear;
  const frequency =
    nextFrequency && frequencyYear && data.academicYear > frequencyYear
      ? nextFrequency
      : configuredFrequency;
  const classes = useMemo(
    () =>
      Array.from(
        new Set(
          data.students
            .map((s) => s.class?.name)
            .filter((v): v is string => !!v),
        ),
      ).sort(),
    [data.students],
  );
  const filtered = useMemo(
    () =>
      data.students.filter(
        (s) =>
          (assignmentFilter === "all" ||
            (assignmentFilter === "assigned"
              ? data.services.some(
                  (assignment) =>
                    assignment.kind === kind &&
                    assignment.studentId === s.id &&
                    assignment.active,
                )
              : !data.services.some(
                  (assignment) =>
                    assignment.kind === kind &&
                    assignment.studentId === s.id &&
                    assignment.active,
                ))) &&
          (!className || s.class?.name === className) &&
          (!query ||
            `${s.name} ${s.surname} ${s.class?.name || ""}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase())),
      ),
    [data.students, data.services, kind, assignmentFilter, className, query],
  );
  const visibleStudents = filtered;
  const activeAssignments = data.services.filter(
    (a) =>
      a.active &&
      a.kind === kind &&
      (!className || a.student.class?.name === className) &&
      (!query ||
        `${a.student.name} ${a.student.surname} ${a.student.class?.name || ""}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())),
  );
  const balanceByService = new Map(
    data.serviceBalances.map((balance) => [
      `${balance.studentId}:${balance.kind}`,
      Math.max(
        0,
        Math.round(
          ((balance._sum.amount || 0) - (balance._sum.paidAmount || 0)) * 1000,
        ) / 1000,
      ),
    ]),
  );
  const selectedSet = new Set(selected);
  const assignmentMap = new Map(
    data.services.filter((a) => a.kind === kind).map((a) => [a.studentId, a]),
  );
  const bulkCandidates = filtered.filter(
    (s) => !assignmentMap.get(s.id)?.active,
  );
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  const allVisible =
    bulkCandidates.length > 0 &&
    bulkCandidates.every((s) => selectedSet.has(s.id));
  const toggleAll = () =>
    setSelected((prev) =>
      allVisible
        ? prev.filter((id) => !bulkCandidates.some((s) => s.id === id))
        : Array.from(new Set([...prev, ...bulkCandidates.map((s) => s.id)])),
    );
  const selectedId = selected.length === 1 ? selected[0] : null;
  const single = selectedId ? assignmentMap.get(selectedId) : null;
  useEffect(() => {
    if (!selectedId) {
      setDiscountType("");
      setDiscountValue("0");
      return;
    }
    const existing = data.services.find(
      (a) => a.studentId === selectedId && a.kind === kind,
    );
    setDiscountType(
      existing?.discountType === "FIXED" || existing?.discountType === "PERCENT"
        ? existing.discountType
        : "",
    );
    setDiscountValue(String(existing?.discountValue || 0));
  }, [selectedId, kind, data.services]);
  const submit = async () => {
    if (!review || busy) return;
    setBusy(true);
    setError("");
    try {
      const one = review.ids[0];
      const payload =
        review.action === "stop"
          ? { action: "assign", studentId: one, kind, active: false }
          : review.action === "assignBulk"
            ? {
                action: "assignBulk",
                studentIds: review.ids,
                kind,
                startPeriod,
              }
            : {
                action: "assign",
                studentId: one,
                kind,
                active: true,
                monthlyFee: price,
                startPeriod,
                discountType: discountType || null,
                discountValue: Number(discountValue.replace(",", ".")),
              };
      const response = await fetch("/api/admin/student-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || "Unable to save");
      setReview(null);
      setSelected([]);
      await onSaved();
      setNotice(
        t(
          "Affectation enregistrée. Les échéances déjà émises restent inchangées.",
          "Assignment saved. Existing charges remain unchanged.",
          "تم حفظ الإسناد. تبقى المعاليم السابقة دون تغيير.",
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const invalidDiscount =
    discountType !== "" &&
    (!Number.isFinite(Number(discountValue.replace(",", "."))) ||
      Number(discountValue.replace(",", ".")) < 0 ||
      (discountType === "PERCENT" &&
        Number(discountValue.replace(",", ".")) > 100) ||
      (discountType === "FIXED" &&
        price !== null &&
        Number(discountValue.replace(",", ".")) > price));
  return (
    <section className="space-y-5" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="rounded-2xl border bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Bus size={19} />
              {t(
                "Attribuer transport ou garde",
                "Assign transport or care",
                "إسناد النقل أو الحضانة",
              )}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t(
                "Choisissez les élèves, puis vérifiez le tarif avant de confirmer.",
                "Choose students, then review the price before confirming.",
                "اختر التلاميذ ثم راجع المعلوم قبل التأكيد.",
              )}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
            {selected.length} {t("sélectionnés", "selected", "محدد")}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            aria-label={t("Service", "Service", "الخدمة")}
            className="rounded-xl border p-3"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setSelected([]);
              setDiscountType("");
              setDiscountValue("0");
            }}
          >
            <option value="TRANSPORT">{t("Transport", "Bus", "النقل")}</option>
            <option value="GARDE">
              {t("Garde", "After-school care", "الحضانة")}
            </option>
            {data.categories
              .filter((category) => category.active)
              .map((category) => (
                <option key={category.kind} value={category.kind}>
                  {category.name}
                </option>
              ))}
          </select>
          <label className="relative">
            <Search
              size={16}
              className="absolute left-3 top-3.5 text-slate-400"
            />
            <input
              aria-label={t(
                "Rechercher un élève",
                "Search students",
                "البحث عن تلميذ",
              )}
              className="w-full rounded-xl border py-3 pl-10 pr-3"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "Rechercher un élève…",
                "Search students…",
                "ابحث عن تلميذ…",
              )}
            />
          </label>
          <select
            aria-label={t("Classe", "Class", "القسم")}
            className="rounded-xl border p-3"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          >
            <option value="">
              {t("Toutes les classes", "All classes", "كل الأقسام")}
            </option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            aria-label={t("Premier mois", "First month", "الشهر الأول")}
            type="month"
            className="rounded-xl border p-3"
            value={startPeriod}
            onChange={(e) => setStartPeriod(e.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-lg bg-slate-100 px-3 py-2">
            {serviceName}:{" "}
            <strong>
              {price === null
                ? t("Prix non défini", "Price not set", "المعلوم غير محدد")
                : `${price} TND`}
            </strong>{" "}
            ·{" "}
            {frequency === "YEARLY"
              ? t("une fois/an", "once/year", "مرة/سنة")
              : t("par mois", "per month", "شهرياً")}
            {pendingFrequency && (
              <span className="ml-2 text-amber-700">
                {t(
                  "Changement l’an prochain",
                  "Changes next school year",
                  "يتغير السنة القادمة",
                )}
              </span>
            )}
          </span>
          <span className="text-slate-500">
            {t(
              "Le tarif se règle dans Tarifs & activation.",
              "Set the price in Rates & activation.",
              "اضبط المعلوم في الإعدادات.",
            )}
          </span>
        </div>
        <div
          className="mt-4 flex flex-wrap gap-2"
          role="group"
          aria-label={t(
            "Filtrer les élèves",
            "Filter students",
            "تصفية التلاميذ",
          )}
        >
          {(["available", "assigned", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setAssignmentFilter(value);
                setSelected([]);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${assignmentFilter === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {value === "available"
                ? t("À inscrire", "Not assigned", "غير مسجل")
                : value === "assigned"
                  ? t("Déjà inscrits", "Assigned", "مسجل")
                  : t("Tous", "All", "الكل")}
            </button>
          ))}
        </div>
        <div className="mt-3 max-h-96 overflow-auto rounded-xl border">
          <label className="sticky top-0 flex cursor-pointer items-center gap-3 border-b bg-slate-50 px-4 py-3 text-sm font-semibold">
            <input type="checkbox" checked={allVisible} onChange={toggleAll} />
            {t(
              "Sélectionner tous les résultats affichés",
              "Select all matching students",
              "تحديد كل التلاميذ الظاهرين",
            )}{" "}
            ({filtered.length})
          </label>
          {visibleStudents.map((s) => {
            const assigned = assignmentMap.get(s.id);
            return (
              <label
                key={s.id}
                className="flex cursor-pointer items-center justify-between gap-3 border-b px-4 py-3 text-sm last:border-0"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="font-medium">
                    {s.name} {s.surname}
                    <span className="ml-2 text-slate-500">
                      {s.class?.name || ""}
                    </span>
                  </span>
                </span>
                {assigned?.active ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                    {t("Inscrit", "Assigned", "مسجل")}
                  </span>
                ) : null}
              </label>
            );
          })}
          {filtered.length === 0 && (
            <p className="p-5 text-sm text-slate-500">
              {t(
                "Aucun élève dans cette vue.",
                "No students in this view.",
                "لا يوجد تلاميذ في هذا العرض.",
              )}
            </p>
          )}
        </div>
        {selected.length === 1 && (
          <div className="mt-4 rounded-xl border bg-slate-50 p-4">
            <p className="text-sm font-semibold">
              {t("Réduction individuelle", "Individual discount", "تخفيض فردي")}
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <select
                className="rounded-lg border p-2"
                value={discountType}
                onChange={(e) =>
                  setDiscountType(e.target.value as typeof discountType)
                }
              >
                <option value="">
                  {t("Aucune réduction", "No discount", "بدون تخفيض")}
                </option>
                <option value="FIXED">
                  {t("Montant fixe (TND)", "Fixed amount (TND)", "مبلغ ثابت")}
                </option>
                <option value="PERCENT">
                  {t("Pourcentage", "Percentage", "نسبة مئوية")}
                </option>
              </select>
              {discountType && (
                <input
                  aria-label={t(
                    "Valeur de la réduction",
                    "Discount value",
                    "قيمة التخفيض",
                  )}
                  inputMode="decimal"
                  className="rounded-lg border p-2"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              )}
            </div>
            {single?.active && (
              <p className="mt-2 text-xs text-slate-500">
                {t("Actuel", "Current", "الحالي")}:{" "}
                {single.discountType || t("aucune", "none", "لا يوجد")}{" "}
                {single.discountValue || ""}
              </p>
            )}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
          >
            {notice}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={
              selected.length === 0 ||
              price === null ||
              invalidDiscount ||
              busy ||
              (selected.length > 1 &&
                selected.some((id) => assignmentMap.get(id)?.active))
            }
            onClick={() =>
              setReview({
                action: selected.length === 1 ? "assign" : "assignBulk",
                ids: selected,
              })
            }
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t("Vérifier l’affectation", "Review assignment", "مراجعة الإسناد")}
          </button>
          {selected.length === 1 && single?.active && (
            <button
              disabled={busy}
              onClick={() => setReview({ action: "stop", ids: selected })}
              className="rounded-xl border px-4 py-2.5 text-sm"
            >
              {t("Arrêter ce service", "Stop service", "إيقاف الخدمة")}
            </button>
          )}
        </div>
      </div>
      <div className="rounded-2xl border bg-white p-5">
        <h3 className="font-semibold">
          {t(
            "Élèves bénéficiant des services",
            "Students using services",
            "التلاميذ المستفيدون من الخدمات",
          )}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {activeAssignments.length}{" "}
          {t("affectations actives", "active assignments", "إسناد نشط")}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {activeAssignments.map((a) => (
            <div key={a.id} className="rounded-xl border p-3 text-sm">
              <strong>
                {a.student.name} {a.student.surname}
              </strong>
              <span className="ml-2 text-slate-500">
                {a.student.class?.name}
              </span>
              <p className="mt-1 text-slate-600">
                {serviceName} · {a.monthlyFee} TND{" "}
                {a.discountType
                  ? `· ${t("réduction", "discount", "تخفيض")} ${a.discountValue}${a.discountType === "PERCENT" ? "%" : " TND"}`
                  : ""}
              </p>
              <p
                className={`mt-1 text-xs font-semibold ${(balanceByService.get(`${a.studentId}:${a.kind}`) || 0) > 0 ? "text-amber-700" : "text-emerald-700"}`}
              >
                {(balanceByService.get(`${a.studentId}:${a.kind}`) || 0) > 0
                  ? `${t("À encaisser", "To collect", "للاستخلاص")}: ${balanceByService.get(`${a.studentId}:${a.kind}`)} TND`
                  : t(
                      "Aucun solde émis",
                      "No issued balance",
                      "لا يوجد رصيد صادر",
                    )}
              </p>
            </div>
          ))}
        </div>
      </div>
      {review && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">
              {review.action === "stop"
                ? t(
                    "Arrêter ce service ?",
                    "Stop this service?",
                    "إيقاف الخدمة؟",
                  )
                : t(
                    "Confirmer l’affectation ?",
                    "Confirm assignment?",
                    "تأكيد الإسناد؟",
                  )}
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              {review.ids.length} {t("élève(s)", "student(s)", "تلميذ")} ·{" "}
              {serviceName} · {price} TND ·{" "}
              {frequency === "YEARLY"
                ? t("une fois/an", "once/year", "مرة/سنة")
                : t("par mois", "per month", "شهرياً")}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {t(
                "Les échéances déjà émises ne changent pas.",
                "Already issued charges will not change.",
                "لن تتغير المعاليم السابقة.",
              )}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                disabled={busy}
                onClick={() => setReview(null)}
                className="flex-1 rounded-xl border p-3"
              >
                {t("Annuler", "Cancel", "إلغاء")}
              </button>
              <button
                disabled={busy}
                onClick={submit}
                className="flex-1 rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? t("En cours…", "Saving…", "جار الحفظ…")
                  : t("Confirmer", "Confirm", "تأكيد")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
