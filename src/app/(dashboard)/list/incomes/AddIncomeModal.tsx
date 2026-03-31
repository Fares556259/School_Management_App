"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { addGeneralIncome } from "./actions";

const CATEGORIES = ["TUITION", "DONATION", "EVENT", "GRANT", "OTHER"];

export default function AddIncomeModal() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      const result = await addGeneralIncome(
        formData.get("title") as string,
        parseFloat(formData.get("amount") as string),
        formData.get("category") as string,
        formData.get("date") as string
      );

      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error || "Something went wrong");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow shadow-sm hover:bg-yellow-400 transition-colors"
      >
        <Image src="/plus.png" alt="" width={14} height={14} />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Image src="/close.png" alt="" width={14} height={14} />
            </button>

            <h2 className="text-xl font-bold text-slate-800 mb-2">Record Income</h2>
            <p className="text-sm text-slate-500 mb-6">Log general school income or donations for auditing.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Source/Description</label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g., Annual Charity Event"
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Amount ($)</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-semibold"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category</label>
                <select
                  name="category"
                  required
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm appearance-none cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date</label>
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                />
              </div>

              {error && <p className="text-red-500 text-xs font-semibold animate-bounce">{error}</p>}

              <div className="flex gap-4 mt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={isPending}
                  className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isPending ? "Recording..." : "Log Income"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
