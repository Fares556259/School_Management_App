"use client";

import { useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import type { Data } from "./StudentChargesClient";

export default function CustomCategories({
  data,
  onSaved,
  onAssign,
}: {
  data: Data;
  onSaved: () => Promise<unknown>;
  onAssign: (kind: string) => void;
}) {
  const { locale } = useLanguage();
  const t = (fr: string, en: string, ar: string) =>
    locale === "ar" ? ar : locale === "en" ? en : fr;
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [active, setActive] = useState(true);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const edit = (category?: Data["categories"][number]) => {
    setEditing(category?.kind || "new");
    setName(category?.name || "");
    setPrice(category ? String(category.price) : "");
    setFrequency(category?.nextFrequency || category?.frequency || "MONTHLY");
    setActive(category?.active ?? true);
    setReview(false);
    setError("");
  };
  const amount = Number(price.replace(",", "."));
  const valid =
    name.trim().length >= 2 &&
    name.trim().length <= 60 &&
    price.trim() !== "" &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    amount <= 1_000_000;
  const save = async () => {
    if (!valid || busy || !review || !editing) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/student-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editing === "new" ? "categoryCreate" : "categoryUpdate",
          kind: editing === "new" ? undefined : editing,
          name: name.trim(),
          price: amount,
          frequency,
          active,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || "Unable to save category");
      await onSaved();
      setEditing(null);
      setReview(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t("Autres catégories", "Other categories", "أصناف أخرى")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              "Créez un service, fixez son prix et sa périodicité, puis attribuez-le aux élèves.",
              "Create a fee, set its price and schedule, then assign students.",
              "أنشئ معلوماً وحدد سعره ودوريته ثم أسنده للتلاميذ.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => edit()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus size={16} />
          {t("Nouvelle catégorie", "New category", "صنف جديد")}
        </button>
      </div>
      {data.categories.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {data.categories.map((category) => (
            <div
              key={category.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">
                    {category.name}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${category.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {category.active
                      ? t("Active", "Active", "نشط")
                      : t("En pause", "Paused", "متوقف")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {category.price} TND ·{" "}
                  {category.frequency === "YEARLY"
                    ? t(
                        "une fois par année scolaire",
                        "once per school year",
                        "مرة في السنة الدراسية",
                      )
                    : t("chaque mois", "monthly", "شهرياً")}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {
                    data.services.filter(
                      (assignment) =>
                        assignment.kind === category.kind && assignment.active,
                    ).length
                  }{" "}
                  {t("élèves inscrits", "students assigned", "تلاميذ مسجلون")}
                </p>
                {category.active && (
                  <button
                    type="button"
                    onClick={() => onAssign(category.kind)}
                    className="mt-2 text-sm font-semibold text-blue-700 hover:underline"
                  >
                    {t(
                      "Gérer les élèves →",
                      "Manage students →",
                      "إدارة التلاميذ ←",
                    )}
                  </button>
                )}
                {category.nextFrequency && (
                  <p className="mt-1 text-xs text-amber-700">
                    {t(
                      "Nouvelle périodicité l’an prochain",
                      "New schedule next school year",
                      "دورية جديدة السنة القادمة",
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => edit(category)}
                aria-label={`${t("Modifier", "Edit", "تعديل")} ${category.name}`}
                className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"
              >
                <Pencil size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          {t(
            "Aucune autre catégorie pour le moment.",
            "No extra categories yet.",
            "لا توجد أصناف إضافية حالياً.",
          )}
        </p>
      )}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4"
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-semibold">
                {editing === "new"
                  ? t("Nouvelle catégorie", "New category", "صنف جديد")
                  : t("Modifier la catégorie", "Edit category", "تعديل الصنف")}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label={t("Fermer", "Close", "غلق")}
                className="rounded-lg border p-2"
              >
                <X size={17} />
              </button>
            </div>
            {!review ? (
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-medium">
                  {t("Nom affiché", "Display name", "اسم الصنف")}
                  <input
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("Ex. Cantine", "e.g. Meals", "مثال: المطعم")}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <label className="block text-sm font-medium">
                  {t(
                    "Prix par élève (TND)",
                    "Price per student (TND)",
                    "السعر لكل تلميذ",
                  )}
                  <input
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <label className="block text-sm font-medium">
                  {t(
                    "Comment facturer ?",
                    "How is it charged?",
                    "كيف تتم الفوترة؟",
                  )}
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="mt-1 w-full rounded-xl border p-3"
                  >
                    <option value="MONTHLY">
                      {t("Chaque mois", "Every month", "كل شهر")}
                    </option>
                    <option value="YEARLY">
                      {t(
                        "Une fois par année scolaire",
                        "Once per school year",
                        "مرة في السنة الدراسية",
                      )}
                    </option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  {t("Catégorie active", "Category active", "صنف نشط")}
                </label>
                <p className="text-xs leading-5 text-slate-500">
                  {t(
                    "La création ne facture aucun élève. Vous choisirez les bénéficiaires dans l’étape suivante. Les tarifs modifiés s’appliquent aux futures échéances seulement.",
                    "Creating a category does not charge students. Choose recipients in the next step. Price changes apply only to future charges.",
                    "إنشاء الصنف لا يفرض معاليم على التلاميذ. اختر المستفيدين في الخطوة التالية. تتطبق الأسعار الجديدة على المعاليم المستقبلية فقط.",
                  )}
                </p>
                <button
                  type="button"
                  disabled={!valid}
                  onClick={() => setReview(true)}
                  className="w-full rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-40"
                >
                  {t("Vérifier", "Review", "مراجعة")}
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  <strong>{name.trim()}</strong>
                  <p className="mt-1">
                    {amount} TND ·{" "}
                    {frequency === "YEARLY"
                      ? t("une fois/an", "once/year", "مرة/سنة")
                      : t("par mois", "monthly", "شهرياً")}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {active
                      ? t("Active", "Active", "نشط")
                      : t("En pause", "Paused", "متوقف")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setReview(false)}
                    className="flex-1 rounded-xl border p-3"
                  >
                    {t("Retour", "Back", "رجوع")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={save}
                    className="flex-1 rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
                  >
                    {busy
                      ? t("Enregistrement…", "Saving…", "جار الحفظ…")
                      : t("Confirmer", "Confirm", "تأكيد")}
                  </button>
                </div>
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
          </div>
        </div>
      )}
    </section>
  );
}
