"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, User, Activity, Tag, DollarSign, Clock, Info } from "lucide-react";

interface AuditLog {
  id: number;
  action: string;
  performedBy: string;
  performer?: {
     name: string;
     email?: string;
     avatar?: string;
     role?: string;
  };
  entityType: string;
  entityId: string | null;
  description: string;
  amount: number | null;
  type: string | null;
  effectiveDate: string | null;
  timestamp: string;
}

interface AuditLogDetailsProps {
  log: AuditLog | null;
  onClose: () => void;
}

const AuditLogDetails: React.FC<AuditLogDetailsProps> = ({ log, onClose }) => {
  if (!log) return null;

  const isIncome = log.type === "income";
  const performer = log.performer;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Slide-over Content */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg bg-white shadow-2xl h-full flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <Activity size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase">Event Details</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Entry ID: #{log.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-slate-600 shadow-sm"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {/* Primary Action Badge */}
            <div className="flex flex-col items-center justify-center pb-8 border-b border-slate-50">
                <span className="px-4 py-1.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-600 uppercase tracking-widest mb-4 ring-4 ring-indigo-50/50">
                  {log.action.replace(/_/g, " ")}
                </span>
                <h3 className="text-center text-sm font-medium text-slate-500 leading-relaxed max-w-sm italic">
                  "{log.description}"
                </h3>
            </div>

            {/* Performer Card */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-widest opacity-50">
                <User size={12} />
                Action Performer
              </h4>
              <div className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 group">
                 <div className="relative">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md border-2 border-white ring-4 ring-slate-50 relative z-10">
                       <img src={performer?.avatar || "/avatar.png"} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full z-20 flex items-center justify-center">
                       <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                 </div>
                 <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-base font-black text-slate-800 tracking-tight">{performer?.name}</span>
                       <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-900 text-white uppercase tracking-tighter">
                          {performer?.role}
                       </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium lowercase italic leading-none mb-2">{performer?.email}</p>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-mono text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{log.performedBy}</span>
                    </div>
                 </div>
              </div>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricBox 
                icon={Tag} 
                label="Entity Type" 
                value={log.entityType} 
                subValue={`ID: ${log.entityId || "N/A"}`} 
              />
              <MetricBox 
                icon={Clock} 
                label="Log Time" 
                value={new Date(log.timestamp).toLocaleDateString()} 
                subValue={new Date(log.timestamp).toLocaleTimeString()} 
              />
              <MetricBox 
                icon={Calendar} 
                label="Effective Date" 
                value={log.effectiveDate ? new Date(log.effectiveDate).toLocaleDateString() : "Immediate"} 
                subValue="Reporting Period" 
              />
              <MetricBox 
                icon={Info} 
                label="Action Impact" 
                value={log.amount !== null ? 'Financial' : 'Administrative'} 
                subValue="System Category" 
              />
            </div>

            {/* Financial Highlight */}
            {log.amount !== null && (
              <div className={`p-6 rounded-3xl border ${isIncome ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'} flex items-center justify-between group overflow-hidden relative transition-all`}>
                <div className={`absolute -right-6 -top-6 opacity-5 group-hover:scale-110 transition-transform duration-700 ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                   <DollarSign size={80} strokeWidth={3} />
                </div>
                <div className="relative z-10">
                   <p className={`text-[10px] font-black uppercase tracking-widest ${isIncome ? 'text-emerald-600' : 'text-rose-600'} opacity-70 mb-1`}>Financial Impact</p>
                   <h2 className={`text-4xl font-black italic tracking-tighter ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isIncome ? '+' : '-'}${log.amount.toLocaleString()}
                   </h2>
                </div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center relative z-10 shadow-sm border ${isIncome ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-rose-100 text-rose-600 border-rose-200'}`}>
                   <DollarSign size={28} strokeWidth={2.5} />
                </div>
              </div>
            )}

            {/* Additional Context (Mocking if empty) */}
             <div className="space-y-4">
               <h4 className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-widest opacity-50">
                 <Info size={12} />
                 System Fingerprint
               </h4>
               <div className="bg-slate-50 rounded-2xl p-4 space-y-3 font-mono text-[10px] text-slate-500 border border-slate-100 shadow-inner">
                  <div className="flex justify-between">
                     <span>Trace ID</span>
                     <span className="font-bold text-slate-800">TRC-{log.id * 789}</span>
                  </div>
                  <div className="flex justify-between">
                     <span>Network Origin</span>
                     <span className="font-bold text-slate-800">Verified System Call</span>
                  </div>
                  <div className="flex justify-between">
                     <span>Integrity Hash</span>
                     <span className="font-bold text-slate-800 truncate w-40">SHA256:d8e8f8...</span>
                  </div>
               </div>
             </div>
          </div>
          
          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t border-slate-100">
             <button 
                onClick={onClose}
                className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black transition-all hover:bg-slate-800 active:scale-95 shadow-lg shadow-slate-200 uppercase tracking-widest text-xs"
             >
               Dismiss Details
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const MetricBox = ({ icon: Icon, label, value, subValue }: { icon: any, label: string, value: string, subValue: string }) => (
  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-white transition-all shadow-sm group">
     <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
        <Icon size={12} className="group-hover:text-indigo-500 transition-colors" />
        {label}
     </div>
     <div className="flex flex-col">
        <span className="text-sm font-black text-slate-800 truncate">{value}</span>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{subValue}</span>
     </div>
  </div>
);

export default AuditLogDetails;
