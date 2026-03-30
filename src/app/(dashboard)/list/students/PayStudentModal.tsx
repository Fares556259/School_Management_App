"use client";

import { useState, useTransition } from "react";
import { receiveStudentPayment } from "./actions";

export default function PayStudentModal({
  studentId,
  studentName,
  gradeLevel,
  isPaid,
  isAdmin,
}: {
  studentId: string;
  studentName: string;
  gradeLevel: number;
  isPaid: boolean;
  isAdmin: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [isPending, startTransition] = useTransition();

  // "1 to 6 the monthly paiment change" mapping logic
  const tuitionAmount = 80 + gradeLevel * 20; // Grade 1 = $100, Grade 6 = $200

  const handlePay = () => {
    if (!isAdmin || !selectedMonth) return;

    startTransition(async () => {
      const result = await receiveStudentPayment(
        studentId,
        studentName,
        tuitionAmount,
        selectedMonth
      );
      if (result.success) {
        setIsOpen(false);
      } else {
        alert(result.error);
      }
    });
  };

  const getMonthsList = () => {
    const months = [];
    const date = new Date();
    date.setMonth(date.getMonth() - 2);

    for (let i = 0; i < 4; i++) {
      const monthStr = date.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
      months.push(monthStr);
      date.setMonth(date.getMonth() + 1);
    }
    return months;
  };

  const monthsList = getMonthsList();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={!isAdmin}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors w-24 ${
          isPaid
            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : "bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200 cursor-pointer"
        }`}
      >
        {isPaid ? "Paid" : "Receive Fee"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full relative">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              Receive Tuition Fee
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Process a monthly tuition payment of{" "}
              <strong>${tuitionAmount}</strong> (Grade {gradeLevel}) for{" "}
              <strong>{studentName}</strong>. This logs an Income.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-lamaSky"
              >
                <option value="" disabled>
                  -- Choose a Month --
                </option>
                {monthsList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={isPending || !selectedMonth}
                className="px-4 py-2 text-sm font-medium text-white bg-lamaSky hover:bg-blue-400 rounded-md transition-colors disabled:opacity-50"
              >
                {isPending ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
