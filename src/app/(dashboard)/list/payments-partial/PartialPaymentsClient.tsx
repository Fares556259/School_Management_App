"use client";

import Table from "@/components/Table";
import { Payment } from "@prisma/client";
import { MONTHS } from "@/lib/dateUtils";
import { useState, useTransition } from "react";
import { CheckCircle, Calendar, Wallet, Search, ArrowUpRight, X } from "lucide-react";
import { receiveStudentPayment } from "../students/actions";

interface ExtendedPayment extends Payment {
  student: {
    name: string;
    surname: string;
    level: { level: number };
    class: { name: string };
  } | null;
}

export default function PartialPaymentsClient({ initialData }: { initialData: ExtendedPayment[] }) {
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedRecovery, setSelectedRecovery] = useState<ExtendedPayment | null>(null);
  const [recoveryAmount, setRecoveryAmount] = useState(0);

  const columns = [
    { header: "Student", accessor: "student" },
    { header: "Fee Month", accessor: "month", className: "hidden md:table-cell" },
    { header: "Paid", accessor: "amount" },
    { header: "Gap (Pending)", accessor: "deferredAmount", className: "hidden lg:table-cell" },
    { header: "Recovery Schedule", accessor: "deferredUntil" },
    { header: "Actions", accessor: "action" },
  ];

  const filteredData = data.filter(item => 
    `${item.student?.name} ${item.student?.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenRecovery = (payment: ExtendedPayment) => {
    setSelectedRecovery(payment);
    setRecoveryAmount(payment.deferredAmount || 0);
  };

  const handleProcessRecovery = () => {
    if (!selectedRecovery || !selectedRecovery.student) return;
    
    const fullAmount = selectedRecovery.amount + (selectedRecovery.deferredAmount || 0);
    const mName = MONTHS[selectedRecovery.month - 1];
    const monthYear = `${mName} ${selectedRecovery.year}`;
    const newTotal = selectedRecovery.amount + recoveryAmount;

    startTransition(async () => {
      const result = await receiveStudentPayment(
        selectedRecovery.studentId!,
        `${selectedRecovery.student?.name} ${selectedRecovery.student?.surname}`,
        fullAmount,
        monthYear,
        newTotal
      );

      if (result.success) {
        if (newTotal >= fullAmount) {
          setData(prev => prev.filter(p => p.id !== selectedRecovery.id));
        } else {
          setData(prev => prev.map(p => p.id === selectedRecovery.id ? { ...p, amount: newTotal, deferredAmount: fullAmount - newTotal } : p));
        }
        setSelectedRecovery(null);
      } else {
        alert("Failed to update payment");
      }
    });
  };

  const renderRow = (item: ExtendedPayment) => (
    <tr key={item.id} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors group">
      <td className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs">
          {item.student?.name.charAt(0)}
        </div>
        <div>
          <p className="font-bold text-slate-700">{item.student?.name} {item.student?.surname}</p>
          <p className="text-[10px] text-slate-500 uppercase font-black">{item.student?.class.name} • Level {item.student?.level.level}</p>
        </div>
      </td>
      <td className="hidden md:table-cell">
        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase">
          {MONTHS[item.month - 1]} {item.year}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-1 text-emerald-600 font-bold">
          <span className="text-xs">DT</span>
          <span>{item.amount}</span>
        </div>
      </td>
      <td className="hidden lg:table-cell">
        <div className="flex items-center gap-1 text-rose-500 font-bold">
          <span className="text-xs">DT</span>
          <span>{item.deferredAmount}</span>
        </div>
      </td>
      <td>
        <div className="flex items-center gap-2 text-orange-600">
          <Calendar size={14} />
          <span className="text-xs font-bold whitespace-nowrap">
            {item.deferredUntil ? new Date(item.deferredUntil).toLocaleDateString() : "Not Scheduled"}
          </span>
        </div>
      </td>
      <td>
        <button
          onClick={() => handleOpenRecovery(item)}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 group-hover:scale-105 disabled:opacity-50"
        >
          <Wallet size={14} />
          <span className="text-[10px] font-black uppercase tracking-wider">Recover</span>
        </button>
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="relative max-w-md w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search debtor name..."
          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <Table columns={columns} renderRow={renderRow} data={filteredData} />
        {filteredData.length === 0 && (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="text-slate-300" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700">All Gaps Recovered!</h3>
            <p className="text-sm text-slate-500">There are no pending partial payments to collect.</p>
          </div>
        )}
      </div>

      {/* Recovery Modal */}
      {selectedRecovery && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedRecovery(null)}
              className="absolute right-6 top-6 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Recover Fee</h2>
            <p className="text-sm text-slate-500 mb-6 font-medium">Recording payment for {selectedRecovery.student?.name}</p>

            <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Current Pending</span>
                <span className="text-xs font-black text-rose-500">{selectedRecovery.deferredAmount} DT</span>
              </div>
              <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full w-1/2" />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recovery Amount (DT)</label>
              <input
                type="number"
                value={recoveryAmount}
                onChange={(e) => setRecoveryAmount(Number(e.target.value))}
                max={selectedRecovery.deferredAmount || 0}
                className="w-full border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
              />
            </div>

            <button
              onClick={handleProcessRecovery}
              disabled={isPending || recoveryAmount <= 0}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              {isPending ? "Processing..." : (
                <>
                  Confirm Recovery
                  <ArrowUpRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
