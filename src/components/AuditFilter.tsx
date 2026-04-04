"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { X, Search, Calendar, Activity, User } from "lucide-react";

const ACTION_TYPES = [
  "GENERAL_INCOME",
  "GENERAL_EXPENSE",
  "EDIT_INCOME",
  "EDIT_EXPENSE",
  "DELETE_INCOME",
  "DELETE_EXPENSE",
  "RECEIVE_TUITION",
  "PAY_SALARY",
  "CREATE_TEACHER",
  "UPDATE_TEACHER",
  "DELETE_TEACHER",
  "CREATE_STUDENT",
  "UPDATE_STUDENT",
  "DELETE_STUDENT",
  "CREATE_STAFF",
  "UPDATE_STAFF",
  "DELETE_STAFF",
];

export default function AuditFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Current values from URL
  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";
  const currentUser = searchParams.get("user") || "";
  const currentAction = searchParams.get("action") || "";

  const [isOpen, setIsOpen] = useState(false);
  
  // Temp state for form
  const [tempFrom, setTempFrom] = useState(currentFrom);
  const [tempTo, setTempTo] = useState(currentTo);
  const [tempUser, setTempUser] = useState(currentUser);
  const [tempAction, setTempAction] = useState(currentAction);

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (tempFrom) params.set("from", tempFrom); else params.delete("from");
    if (tempTo) params.set("to", tempTo); else params.delete("to");
    if (tempUser) params.set("user", tempUser); else params.delete("user");
    if (tempAction) params.set("action", tempAction); else params.delete("action");
    
    params.delete("page"); // Reset to page 1
    
    router.push(`?${params.toString()}`);
    setIsOpen(false);
  };

  const clearAll = () => {
    setTempFrom("");
    setTempTo("");
    setTempUser("");
    setTempAction("");
    router.push(window.location.pathname);
    setIsOpen(false);
  };

  const isActive = currentFrom || currentTo || currentUser || currentAction;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-sm ${
          isActive 
            ? "bg-indigo-600 text-white ring-4 ring-indigo-50" 
            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
        }`}
      >
        <Image 
          src="/filter.png" 
          alt="" 
          width={14} 
          height={14} 
          className={isActive ? "invert" : ""} 
        />
        <span>{isActive ? "Filters Active" : "Filter Logs"}</span>
        {isActive && (
          <span className="w-5 h-5 bg-white text-indigo-600 rounded-full flex items-center justify-center text-[10px]">
            {[currentFrom, currentTo, currentUser, currentAction].filter(Boolean).length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm">Audit Trail Filters</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-white rounded-full transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* PERFORMED BY */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <User size={12} /> Performed By
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Username or Role..."
                  value={tempUser}
                  onChange={(e) => setTempUser(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl p-2.5 pl-9 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
                />
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            {/* ACTION TYPE */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Activity size={12} /> Action Type
              </label>
              <select
                value={tempAction}
                onChange={(e) => setTempAction(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="">All Actions</option>
                {ACTION_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* DATE RANGE */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Calendar size={12} /> Log Time Range
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 ml-1">From</span>
                  <input
                    type="date"
                    value={tempFrom}
                    onChange={(e) => setTempFrom(e.target.value)}
                    className="text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 ml-1">To</span>
                  <input
                    type="date"
                    value={tempTo}
                    onChange={(e) => setTempTo(e.target.value)}
                    className="text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={applyFilters}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-[0.98]"
              >
                Apply Filters
              </button>
              <button
                onClick={clearAll}
                className="w-full py-2.5 bg-slate-50 text-slate-500 rounded-xl text-xs font-bold hover:bg-rose-50 hover:text-rose-600 transition-all"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
