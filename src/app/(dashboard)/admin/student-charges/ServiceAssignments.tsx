"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Bus,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import type { Data } from "./StudentChargesClient";

type Kind = string;
export default function ServiceAssignments({
  data,
  onSaved,
  initialKind,
  onEditService,
}: {
  data: Data;
  onSaved: () => Promise<unknown>;
  initialKind: string;
  onEditService: (kind: string) => void;
}) {
  const { locale } = useLanguage();
  const t = (fr: string, en: string, ar: string) =>
    locale === "ar" ? ar : locale === "en" ? en : fr;
  const [kind, setKind] = useState<Kind>(initialKind);
  const [query, setQuery] = useState("");
  const [className, setClassName] = useState("");
  const [showClassFilter, setShowClassFilter] = useState(false);
  const [assignmentFilter, setAssignmentFilter] = useState<
    "available" | "assigned"
  >("available");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkSelectOpen, setBulkSelectOpen] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  useEffect(() => {
    setKind(initialKind);
    setSelected([]);
    setStudentPage(1);
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
    action: "assign" | "assignBulk" | "update" | "stop";
    ids: string[];
  }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [academicStart, academicEnd] = data.academicYear.split("-").map(Number);
  const academicMonths = [
    ...[9, 10, 11, 12].map((month) => ({ year: academicStart, month })),
    ...[1, 2, 3, 4, 5, 6].map((month) => ({ year: academicEnd, month })),
  ].map(({ year, month }) => ({
    value: `${year}-${String(month).padStart(2, "0")}`,
    label: new Date(year, month - 1, 1).toLocaleDateString(
      locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR",
      { month: "long", year: "numeric" },
    ),
  }));
  const effectivePeriod = academicMonths.some(
    (month) => month.value === startPeriod,
  )
    ? startPeriod
    : academicMonths[0].value;
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
  const assignmentMap = useMemo(
    () =>
      new Map(
        data.services
          .filter((a) => a.kind === kind)
          .map((a) => [a.studentId, a]),
      ),
    [data.services, kind],
  );
  const filtered = useMemo(
    () =>
      data.students.filter(
        (s) =>
          (assignmentFilter === "assigned"
            ? !!assignmentMap.get(s.id)?.active
            : !assignmentMap.get(s.id)?.active) &&
          (!className || s.class?.name === className) &&
          (!query ||
            `${s.name} ${s.surname} ${s.class?.name || ""}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase())),
      ),
    [data.students, assignmentMap, assignmentFilter, className, query],
  );
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleStudents = filtered.slice(
    (studentPage - 1) * pageSize,
    studentPage * pageSize,
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
  const bulkCandidates =
    assignmentFilter === "available" ? visibleStudents : [];
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
  const beginReview = (
    action: "assign" | "assignBulk" | "update" | "stop",
    ids: string[],
  ) => {
    const existing = action === "update" ? assignmentMap.get(ids[0]) : null;
    setDiscountType(
      existing?.discountType === "FIXED" || existing?.discountType === "PERCENT"
        ? existing.discountType
        : "",
    );
    setDiscountValue(String(existing?.discountValue || 0));
    setError("");
    setReview({ action, ids });
  };
  const submit = async () => {
    if (!review || busy) return;
    setBusy(true);
    setError("");
    try {
      const one = review.ids[0];
      const existing = assignmentMap.get(one);
      const payload =
        review.action === "stop"
          ? { action: "assign", studentId: one, kind, active: false }
          : review.action === "assignBulk"
            ? {
                action: "assignBulk",
                studentIds: review.ids,
                kind,
                startPeriod: effectivePeriod,
              }
            : {
                action: "assign",
                studentId: one,
                kind,
                active: true,
                monthlyFee:
                  review.action === "update" ? existing?.monthlyFee : price,
                startPeriod:
                  review.action === "update"
                    ? existing?.startPeriod
                    : effectivePeriod,
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
      setStudentPage(1);
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
  const reviewFee =
    review?.action === "update"
      ? (assignmentMap.get(review.ids[0])?.monthlyFee ?? null)
      : price;
  const invalidDiscount =
    discountType !== "" &&
    (!Number.isFinite(Number(discountValue.replace(",", "."))) ||
      Number(discountValue.replace(",", ".")) < 0 ||
      (discountType === "PERCENT" &&
        Number(discountValue.replace(",", ".")) > 100) ||
      (discountType === "FIXED" &&
        reviewFee !== null &&
        Number(discountValue.replace(",", ".")) > reviewFee));
  return (
    <section className="space-y-5" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="rounded-2xl border bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Bus size={19} />{" "}
          {t(
            "Inscrire des élèves à un service",
            "Enroll students in a service",
            "تسجيل التلاميذ في خدمة",
          )}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            "Choisissez un service, trouvez les élèves, puis vérifiez avant de confirmer.",
            "Choose a service, find students, then review before confirming.",
            "اختر خدمة والتلاميذ ثم راجع قبل التأكيد.",
          )}
        </p>
        <div
          className="mt-5 flex flex-wrap gap-2"
          role="group"
          aria-label={t("Service", "Service", "الخدمة")}
        >
          {(["TRANSPORT", "GARDE"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setSelected([]);
                setStudentPage(1);
                setNotice("");
              }}
              className={`rounded-xl border px-5 py-3 text-sm font-semibold ${kind === value ? "border-blue-600 bg-blue-50 text-blue-800" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {value === "TRANSPORT"
                ? t("Transport", "Bus", "النقل")
                : t("Garde", "Care", "الحضانة")}
            </button>
          ))}
          {data.categories.some((item) => item.active) && (
            <select
              aria-label={t("Autre service", "Other service", "خدمة أخرى")}
              value={kind === "TRANSPORT" || kind === "GARDE" ? "" : kind}
              onChange={(e) => {
                if (e.target.value) {
                  setKind(e.target.value);
                  setSelected([]);
                  setStudentPage(1);
                  setNotice("");
                }
              }}
              className="rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-700"
            >
              <option value="">
                {t("Autre service…", "Other service…", "خدمة أخرى…")}
              </option>
              {data.categories
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.kind} value={item.kind}>
                    {item.name}
                  </option>
                ))}
            </select>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <div>
            <strong>{serviceName}</strong> ·{" "}
            {price === null
              ? t("Tarif non défini", "Price not set", "السعر غير محدد")
              : `${price} TND`}
            {" · "}
            {frequency === "YEARLY"
              ? t("une fois par an", "once a year", "مرة في السنة")
              : t("chaque mois", "each month", "كل شهر")}
            {pendingFrequency && (
              <span className="ms-2 text-amber-700">
                {t(
                  "Fréquence modifiée l’an prochain",
                  "Frequency changes next year",
                  "تتغير الدورية السنة القادمة",
                )}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onEditService(kind)}
            className="font-semibold text-blue-700 hover:underline"
          >
            {t("Modifier le tarif", "Edit price", "تعديل السعر")}
          </button>
        </div>
        <div
          className="mt-5 flex flex-wrap items-center gap-2 border-b pb-3"
          role="tablist"
        >
          {(["available", "assigned"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={assignmentFilter === value}
              onClick={() => {
                setAssignmentFilter(value);
                setStudentPage(1);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${assignmentFilter === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {value === "available"
                ? t("À inscrire", "To enroll", "للتسجيل")
                : t("Déjà inscrits", "Already enrolled", "المسجلون")}
            </button>
          ))}
          <span className="ms-auto text-sm text-slate-500">
            {filtered.length} {t("élèves", "students", "تلاميذ")}
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <label className="relative min-w-0 flex-1">
            <Search
              size={17}
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
              onChange={(e) => {
                setQuery(e.target.value);
                setStudentPage(1);
              }}
              placeholder={t(
                "Rechercher un élève…",
                "Search students…",
                "ابحث عن تلميذ…",
              )}
            />
          </label>
          <button
            type="button"
            aria-expanded={showClassFilter}
            onClick={() => setShowClassFilter((value) => !value)}
            className={`flex items-center gap-2 rounded-xl border px-4 text-sm font-medium ${className ? "border-blue-300 bg-blue-50 text-blue-800" : "text-slate-600"}`}
          >
            <SlidersHorizontal size={16} />{" "}
            {className || t("Classe", "Class", "القسم")}
          </button>
        </div>
        {showClassFilter && (
          <select
            aria-label={t("Classe", "Class", "القسم")}
            className="mt-2 w-full rounded-xl border p-3 sm:w-64"
            value={className}
            onChange={(e) => {
              setClassName(e.target.value);
              setStudentPage(1);
            }}
          >
            <option value="">
              {t("Toutes les classes", "All classes", "كل الأقسام")}
            </option>
            {classes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>
            {filtered.length} {t("élèves", "students", "تلاميذ")} ·{" "}
            {t("Page", "Page", "صفحة")} {studentPage}/{pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={t(
                "Page précédente",
                "Previous page",
                "الصفحة السابقة",
              )}
              disabled={studentPage === 1}
              onClick={() => setStudentPage((page) => page - 1)}
              className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label={t("Page suivante", "Next page", "الصفحة التالية")}
              disabled={studentPage >= pageCount}
              onClick={() => setStudentPage((page) => page + 1)}
              className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        {assignmentFilter === "available" && filtered.length > pageSize && (
          <button
            type="button"
            onClick={() => setBulkSelectOpen(true)}
            className="mt-2 text-sm font-semibold text-blue-700 hover:underline"
          >
            {t(
              "Sélectionner tous les résultats filtrés",
              "Select all filtered results",
              "تحديد جميع النتائج المصفّاة",
            )}{" "}
            ({filtered.length})
          </button>
        )}
        <div className="mt-3 overflow-hidden rounded-xl border">
          {assignmentFilter === "available" && (
            <label className="flex cursor-pointer items-center gap-3 border-b bg-slate-50 px-4 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={allVisible}
                disabled={bulkCandidates.length === 0}
                onChange={toggleAll}
              />
              {t(
                "Sélectionner cette page",
                "Select this page",
                "تحديد هذه الصفحة",
              )}{" "}
              ({bulkCandidates.length})
            </label>
          )}
          {visibleStudents.map((s) => {
            const assigned = assignmentMap.get(s.id);
            return (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-3 border-b px-4 py-3 text-sm last:border-0 ${selectedSet.has(s.id) ? "bg-blue-50" : ""}`}
              >
                <span className="flex items-center gap-3">
                  {assignmentFilter === "available" && (
                    <input
                      type="checkbox"
                      aria-label={`${s.name} ${s.surname}`}
                      checked={selectedSet.has(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                  )}
                  <span className="font-medium">
                    {s.name} {s.surname}
                    <span className="ml-2 text-slate-500">
                      {s.class?.name || ""}
                    </span>
                  </span>
                </span>
                {assigned?.active ? (
                  <span className="flex items-center gap-3">
                    <span className="text-end text-xs text-slate-600">
                      <span className="block font-semibold text-emerald-700">
                        {t("Inscrit", "Assigned", "مسجل")} ·{" "}
                        {assigned.monthlyFee} TND
                      </span>
                      {assigned.discountType && (
                        <span className="block">
                          {t("Réduction", "Discount", "تخفيض")}{" "}
                          {assigned.discountValue}
                          {assigned.discountType === "PERCENT" ? "%" : " TND"}
                        </span>
                      )}
                      {(balanceByService.get(`${s.id}:${kind}`) || 0) > 0 && (
                        <span className="block text-amber-700">
                          {t("À encaisser", "Due", "للاستخلاص")}{" "}
                          {balanceByService.get(`${s.id}:${kind}`)} TND
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => beginReview("update", [s.id])}
                      className="rounded-lg border px-3 py-2 font-medium hover:bg-slate-50"
                    >
                      {t("Gérer", "Manage", "إدارة")}
                    </button>
                  </span>
                ) : null}
              </div>
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
        {notice && (
          <p
            role="status"
            className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
          >
            {notice}
          </p>
        )}
      </div>
      {selected.length > 0 && (
        <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-white p-3 shadow-xl sm:px-5">
          <span className="me-auto text-sm font-semibold text-slate-800">
            {selected.length}{" "}
            {t("élèves sélectionnés", "students selected", "تلاميذ محددون")}
          </span>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            {t("Effacer", "Clear", "مسح")}
          </button>
          <button
            type="button"
            disabled={price === null}
            onClick={() =>
              beginReview(
                selected.length === 1 ? "assign" : "assignBulk",
                selected,
              )
            }
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t("Continuer", "Continue", "متابعة")} →
          </button>
        </div>
      )}
      {bulkSelectOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-select-title"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="bulk-select-title" className="text-lg font-semibold">
              {t(
                "Sélectionner tous les résultats ?",
                "Select all results?",
                "تحديد جميع النتائج؟",
              )}
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              {filtered.length}{" "}
              {t(
                "élèves correspondent aux filtres, y compris ceux des autres pages.",
                "students match the filters, including other pages.",
                "تلاميذ مطابقون للتصفية، بما في ذلك الصفحات الأخرى.",
              )}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {t(
                "Vous vérifierez encore le service et le mois avant l’inscription.",
                "You will still review the service and start month before enrollment.",
                "ستراجع الخدمة والشهر قبل التسجيل.",
              )}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setBulkSelectOpen(false)}
                className="flex-1 rounded-xl border p-3"
              >
                {t("Annuler", "Cancel", "إلغاء")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelected((prev) =>
                    Array.from(
                      new Set([
                        ...prev,
                        ...filtered.map((student) => student.id),
                      ]),
                    ),
                  );
                  setBulkSelectOpen(false);
                }}
                className="flex-1 rounded-xl bg-blue-600 p-3 font-semibold text-white"
              >
                {t("Sélectionner", "Select", "تحديد")}
              </button>
            </div>
          </div>
        </div>
      )}
      {review && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-review-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  {serviceName}
                </p>
                <h3
                  id="assignment-review-title"
                  className="mt-1 text-xl font-semibold"
                >
                  {review.action === "stop"
                    ? t(
                        "Arrêter ce service ?",
                        "Stop this service?",
                        "إيقاف هذه الخدمة؟",
                      )
                    : review.action === "update"
                      ? t(
                          "Gérer l’inscription",
                          "Manage enrollment",
                          "إدارة التسجيل",
                        )
                      : t(
                          "Vérifier l’inscription",
                          "Review enrollment",
                          "مراجعة التسجيل",
                        )}
                </h3>
              </div>
              <button
                type="button"
                aria-label={t("Fermer", "Close", "إغلاق")}
                disabled={busy}
                onClick={() => setReview(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-sm">
              <p className="font-semibold">
                {review.ids.length} {t("élève(s)", "student(s)", "تلميذ")}
              </p>
              <p className="mt-1 text-slate-600">
                {review.ids
                  .slice(0, 4)
                  .map((id) => {
                    const student = data.students.find(
                      (item) => item.id === id,
                    );
                    return student
                      ? [student.name, student.surname]
                          .filter(Boolean)
                          .join(" ")
                      : "";
                  })
                  .filter(Boolean)
                  .join(", ")}
                {review.ids.length > 4 ? ` +${review.ids.length - 4}` : ""}
              </p>
            </div>
            {review.action !== "stop" && (
              <>
                <div className="mt-4 grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
                  <div>
                    <span className="block text-slate-500">
                      {t(
                        "Tarif par élève",
                        "Price per student",
                        "السعر لكل تلميذ",
                      )}
                    </span>
                    <strong>
                      {reviewFee === null ? "—" : `${reviewFee} TND`}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-slate-500">
                      {t("Périodicité", "Frequency", "الدورية")}
                    </span>
                    <strong>
                      {frequency === "YEARLY"
                        ? t("Une fois par an", "Once a year", "مرة في السنة")
                        : t("Chaque mois", "Monthly", "شهرياً")}
                    </strong>
                  </div>
                </div>
                {(review.action === "assign" ||
                  review.action === "assignBulk") && (
                  <label className="mt-4 block text-sm font-medium">
                    {t(
                      "Premier mois de service",
                      "Service starts in",
                      "شهر بداية الخدمة",
                    )}
                    <select
                      value={effectivePeriod}
                      onChange={(e) => setStartPeriod(e.target.value)}
                      className="mt-2 w-full rounded-xl border bg-white p-3"
                    >
                      {academicMonths.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {review.action === "update" && (
                  <p className="mt-3 text-sm text-slate-600">
                    {t("Début actuel", "Current start", "البداية الحالية")}:{" "}
                    {assignmentMap.get(review.ids[0])?.startPeriod}
                  </p>
                )}
                {review.ids.length === 1 && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium">
                      {t(
                        "Réduction individuelle",
                        "Individual discount",
                        "تخفيض فردي",
                      )}
                      <select
                        value={discountType}
                        onChange={(e) =>
                          setDiscountType(e.target.value as typeof discountType)
                        }
                        className="mt-2 w-full rounded-xl border bg-white p-3"
                      >
                        <option value="">
                          {t("Aucune réduction", "No discount", "دون تخفيض")}
                        </option>
                        <option value="FIXED">
                          {t(
                            "Montant fixe (TND)",
                            "Fixed amount (TND)",
                            "مبلغ ثابت",
                          )}
                        </option>
                        <option value="PERCENT">
                          {t("Pourcentage", "Percentage", "نسبة مئوية")}
                        </option>
                      </select>
                    </label>
                    {discountType && (
                      <input
                        aria-label={t(
                          "Valeur de la réduction",
                          "Discount value",
                          "قيمة التخفيض",
                        )}
                        inputMode="decimal"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="mt-2 w-full rounded-xl border p-3"
                      />
                    )}
                    {invalidDiscount && (
                      <p role="alert" className="mt-2 text-xs text-rose-700">
                        {t(
                          "Vérifiez la réduction saisie.",
                          "Check the discount value.",
                          "تحقق من قيمة التخفيض.",
                        )}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              {review.action === "stop"
                ? t(
                    "Le service prendra fin. Les échéances déjà émises resteront dues.",
                    "The service will stop. Existing charges will still be due.",
                    "ستتوقف الخدمة وتبقى المعاليم السابقة مستحقة.",
                  )
                : t(
                    "Les échéances déjà émises ne changent pas. Les nouvelles échéances suivent ce tarif.",
                    "Existing charges stay unchanged. New charges use this price.",
                    "تبقى المعاليم السابقة دون تغيير وتستعمل المعاليم الجديدة هذا السعر.",
                  )}
            </p>
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setReview(null)}
                className="flex-1 rounded-xl border p-3"
              >
                {t("Annuler", "Cancel", "إلغاء")}
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  invalidDiscount ||
                  (review.action !== "stop" && reviewFee === null)
                }
                onClick={submit}
                className="flex-1 rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? t("En cours…", "Saving…", "جار الحفظ…")
                  : review.action === "stop"
                    ? t("Arrêter le service", "Stop service", "إيقاف الخدمة")
                    : t("Confirmer", "Confirm", "تأكيد")}
              </button>
            </div>
            {review.action === "update" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => beginReview("stop", review.ids)}
                className="mt-4 w-full rounded-lg py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                {t(
                  "Arrêter ce service pour cet élève",
                  "Stop service for this student",
                  "إيقاف الخدمة لهذا التلميذ",
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
