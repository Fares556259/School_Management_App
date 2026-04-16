"use client";
import QuickPayButton from '../finance/QuickPayButton';
import Link from 'next/link';
import { User, Calendar, ExternalLink, CheckCircle2, ArrowRight, HandCoins, Wallet, Download, MessageSquare, Clock } from 'lucide-react';
import { downloadCSV } from '@/lib/csvExport';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/translations/LanguageContext';

interface ActionItem {
  id: string;
  name: string;
  amount: number;
  type: 'student' | 'teacher' | 'staff';
  phone?: string;
}

interface ActionCenterProps {
  unpaidEmployees: ActionItem[];
  unpaidFees: ActionItem[];
  monthLabel: string;
}

const SendSmsButton = ({ listType, disabled = false }: { listType: string; disabled?: boolean }) => {
  const { t } = useLanguage();
  const [cooldown, setCooldown] = useState<number>(0);
  const [isSending, setIsSending] = useState(false);
  const storageKey = `sms_cooldown_${listType}`;

  useEffect(() => {
    const checkCooldown = () => {
      const lastSent = localStorage.getItem(storageKey);
      if (lastSent) {
        const elapsed = Date.now() - parseInt(lastSent);
        const remaining = 4 * 60 * 60 * 1000 - elapsed;
        if (remaining > 0) {
          setCooldown(remaining);
        } else {
          setCooldown(0);
        }
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [storageKey]);

  const handleSendSms = async () => {
    if (disabled) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/finance/reminders", { 
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem(storageKey, Date.now().toString());
        setCooldown(4 * 60 * 60 * 1000);
      }
    } catch (error) {
      console.error("Failed to send reminders:", error);
    } finally {
      setIsSending(false);
    }
  };

  const formatCooldown = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (cooldown > 0 && !disabled) {
    return (
      <button 
        disabled
        className="w-full py-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-400 flex items-center justify-center gap-2 cursor-not-allowed"
      >
        <Clock size={14} />
        {t.actionCenter.smsLocked} {formatCooldown(cooldown)})
      </button>
    );
  }

  return (
    <button 
      onClick={handleSendSms}
      disabled={isSending || disabled}
      className={`w-full py-3 border rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm group/sms transition-all ${
        disabled 
          ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed" 
          : "bg-white border-slate-200 text-[#4F46E5] hover:bg-indigo-50 hover:border-indigo-200"
      }`}
    >
      {isSending ? (
        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      ) : (
        <MessageSquare size={14} className={disabled ? "text-slate-300" : "text-indigo-400 group-hover/sms:scale-110 transition-transform"} />
      )}
      {isSending ? t.actionCenter.sendingReminders : t.actionCenter.sendReminders}
    </button>
  );
};

const ActionList = ({ 
  title, 
  items, 
  color, 
  ctaLabel, 
  ctaIcon: CtaIcon,
  showSmsAction = false,
  monthLabel
}: { 
  title: string, 
  items: ActionItem[], 
  color: string,
  ctaLabel: string,
  ctaIcon: any,
  showSmsAction?: boolean,
  monthLabel: string
}) => {
  const { t } = useLanguage();
  
  const handleExport = () => {
    if (items.length === 0) return;
    const exportData = items.map(item => ({
      Name: item.name,
      Amount: item.amount,
      Type: item.type.toUpperCase(),
      Contact: item.phone || "No Contact"
    }));
    downloadCSV(exportData, `unpaid-${title.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="flex-1 min-w-[300px] bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden group">
      <div className={`p-5 border-b border-slate-50 flex justify-between items-center ${color}`}>
        <div className="flex flex-col gap-0.5">
          <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">{title}</h3>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter opacity-70">{monthLabel} {t.actionCenter.only}</span>
        </div>
        <div className="flex items-center gap-2">
            {items.length > 0 && (
                <button 
                  onClick={handleExport}
                  title="Export List"
                  className="p-1.5 bg-white rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-500 hover:border-indigo-100 transition-all shadow-sm"
                >
                    <Download size={12} />
                </button>
            )}
            <span className="text-[10px] font-black bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-slate-500 shadow-sm border border-slate-100">
                {items.length} {t.actionCenter.pending}
            </span>
        </div>
      </div>
      
      <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
        {items.length > 0 ? (
          <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3 scrollbar-slim">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50/50 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group/item">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 text-slate-400 group-hover/item:text-indigo-500 transition-colors">
                    <User size={14} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">{item.name}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ${
                        item.type === 'student' ? 'bg-amber-100 text-amber-600' :
                        item.type === 'teacher' ? 'bg-rose-100 text-rose-600' :
                        'bg-indigo-100 text-indigo-600'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-tight">
                        {item.phone || <span className="text-rose-400 opacity-60">{t.actionCenter.noContact}</span>}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <span className="text-sm font-black text-slate-800">${item.amount.toLocaleString()}</span>
                   <QuickPayButton 
                     id={item.id} 
                     name={item.name} 
                     amount={item.amount} 
                     type={item.type} 
                     monthYear={new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                   />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center h-full">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm font-bold text-slate-800">{t.actionCenter.allSettled}</p>
            <p className="text-[11px] text-slate-400 font-medium px-4">{t.actionCenter.noPending}</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-50/50 border-t border-slate-50 mt-auto space-y-3">
        <button className="w-full py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 shadow-sm">
          <CtaIcon size={14} className="text-slate-400" />
          {ctaLabel}
        </button>
        
        {showSmsAction && <SendSmsButton listType={title.toLowerCase().replace(' ', '_')} disabled={items.length === 0} />}
        
        <Link href="/admin" className="mt-3 flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-500 cursor-pointer transition-colors uppercase tracking-widest">
          <span>{t.actionCenter.viewHistory}</span>
          <ExternalLink size={10} />
        </Link>
      </div>
    </div>
  );
};

const ActionCenter = ({ unpaidEmployees = [], unpaidFees = [], monthLabel }: ActionCenterProps) => {
  const { t } = useLanguage();
  // 1. Calculations
  const calculatedUnpaidEmployeesTotal = (unpaidEmployees || []).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const calculatedUncollectedFeesTotal = (unpaidFees || []).reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // 2. Render
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Summary Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-1">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl p-5 text-white shadow-lg shadow-indigo-100 flex items-center justify-between group overflow-hidden relative border border-white/5">
          <div className="absolute right-[-2%] top-[-10%] opacity-10 group-hover:rotate-6 transition-transform duration-700">
             <Wallet size={80} strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <p className="text-indigo-100/70 text-[9px] font-black uppercase tracking-wider mb-1">{t.actionCenter.unpaidEmployees}</p>
            <h2 className="text-2xl font-black tracking-tight">${calculatedUnpaidEmployeesTotal.toLocaleString()}</h2>
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center relative z-10">
             <Wallet size={22} className="text-white" />
          </div>
        </div>

        <div className="bg-amber-500/95 rounded-3xl p-5 text-white shadow-lg shadow-amber-100 flex items-center justify-between group overflow-hidden relative border border-white/5">
          <div className="absolute right-[-2%] top-[-10%] opacity-10 group-hover:-rotate-6 transition-transform duration-700">
             <HandCoins size={80} strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <p className="text-amber-50/70 text-[9px] font-black uppercase tracking-wider mb-1">{t.actionCenter.uncollectedFees}</p>
            <h2 className="text-2xl font-black tracking-tight">${calculatedUncollectedFeesTotal.toLocaleString()}</h2>
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center relative z-10">
             <HandCoins size={22} className="text-white" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      <ActionList 
        title={t.actionCenter.unpaidEmployees} 
        items={unpaidEmployees} 
        color="bg-indigo-500/5 text-indigo-600" 
        ctaLabel={t.actionCenter.processSalaries} 
        ctaIcon={HandCoins}
        monthLabel={monthLabel}
      />
      <ActionList 
        title={t.actionCenter.uncollectedFees} 
        items={unpaidFees} 
        color="bg-amber-500/5 text-amber-600" 
        ctaLabel={t.actionCenter.collectPayments} 
        ctaIcon={Calendar}
        showSmsAction={true}
        monthLabel={monthLabel}
      />
      </div>
    </div>
  );
};

export default ActionCenter;
