"use client";

import { useState, useRef } from "react";
import { addFinanceEntry } from "./actions";

export default function AddFinanceEntryModal() {
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
    } else {
      alert(result.error);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-lamaSky text-white text-sm font-semibold rounded-lg hover:bg-blue-400 transition-colors shadow-sm"
      >
        + Add Entry
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-800 mb-6">
              Add Finance Entry
            </h2>
            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Title</label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Electricity Bill"
                  className="w-full border border-slate-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaSky"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Amount ($)</label>
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
                <label className="block text-sm font-medium text-slate-600 mb-1">Type</label>
                <select
                  name="type"
                  required
                  className="w-full border border-slate-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaSky"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Category</label>
                <select
                  name="category"
                  required
                  className="w-full border border-slate-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaSky"
                >
                  <option value="SALARY">Salary</option>
                  <option value="TUITION">Tuition</option>
                  <option value="UTILITIES">Utilities</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="DONATION">Donation</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-lamaSky hover:bg-blue-400 rounded-md disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Add Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
