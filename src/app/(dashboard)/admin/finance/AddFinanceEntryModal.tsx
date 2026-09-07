"use client";

import { useState, useRef } from "react";
import { addFinanceEntry } from "./actions";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { toast } from "react-toastify";

export default function AddFinanceEntryModal() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    setLoading(true);
    const formData = new FormData(formRef.current);
    const result = await addFinanceEntry(formData);
    setLoading(false);
    if (result.success) {
      setIsOpen(false);
      formRef.current.reset();
      toast.success(t.toasts.publishedSuccess);
    } else {
      toast.error(result.error || t.toasts.operationFailed);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-lamaSky text-white text-sm font-semibold rounded-lg hover:bg-blue-400 transition-colors shadow-sm"
      >
        + {t.crud.add}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-800 mb-6">
              {t.crud.add}
            </h2>
            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t.incomesPage.table.description}</label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Facture STEG / Electricity Bill"
                  className="w-full border border-slate-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaSky"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t.incomesPage.table.amount} (DT)</label>
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full border border-slate-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaSky"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t.incomesPage.table.category}</label>
                <select
                  name="type"
                  required
                  className="w-full border border-slate-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaSky mb-2"
                >
                  <option value="income">{t.incomesPage.pageTitle}</option>
                  <option value="expense">{t.expensesPage.pageTitle}</option>
                </select>
                <select
                  name="category"
                  required
                  className="w-full border border-slate-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaSky"
                >
                  <option value="SALARY">SALAIRE</option>
                  <option value="TUITION">SCOLARITÉ</option>
                  <option value="UTILITIES">SERVICES</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="DONATION">DON</option>
                  <option value="OTHER">AUTRE</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t.incomesPage.table.date}</label>
                <input
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full border border-slate-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaSky"
                />
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                  disabled={loading}
                >
                  {t.crud.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-lamaSky hover:bg-blue-400 rounded-md disabled:opacity-50"
                >
                  {loading ? t.crud.saving : t.crud.add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
