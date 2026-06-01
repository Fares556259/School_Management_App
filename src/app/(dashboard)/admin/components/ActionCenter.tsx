"use client";
import QuickPayButton from '../finance/QuickPayButton';
import Link from 'next/link';
import { User, Calendar, ExternalLink, CheckCircle2, ArrowRight, HandCoins, Wallet, Download, MessageSquare, Clock } from 'lucide-react';
import { downloadCSV } from '@/lib/csvExport';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/translations/LanguageContext';
import { toast } from 'react-toastify';

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
        toast.success(`Success! Sent reminders to ${data.count} parents. (App Notifications delivered)`);
      } else {
        toast.error("Failed to send reminders. Please try again.");
      }
    } catch (error) {
      console.error("Failed to send reminders:", error);
      toast.error("Connection error. Is the server running?");
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
      <div 
        className="w-full py-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-400 flex items-center justify-center gap-2 cursor-default select-none group/lock"
      >
        <Clock size={14} />
        {t.actionCenter.smsLocked} {formatCooldown(cooldown)})
        <span 
          onClick={(e) => {
            e.stopPropagation();
            localStorage.removeItem(storageKey);
            setCooldown(0);
          }}
          className="ml-2 px-2 py-0.5 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors cursor-pointer pointer-events-auto active:scale-95"
        >
          Reset
        </span>
      </div>
    );
  }

  return (
    <button 
      onClick={handleSendSms}
      disabled={isSending || disabled}
      className={`w-full py-2.5 border rounded-[6px] text-[13px] font-medium flex items-center justify-center gap-2 shadow-sm transition-all ${
        disabled 
          ? "bg-[#f9f9f9] border-[#dddddd] text-[#898989] cursor-not-allowed" 
          : "bg-[#ffffff] border-[#dddddd] text-[#181d26] hover:bg-[#f8fafc]"
      }`}
    >
      {isSending ? (
        <div className="w-4 h-4 border-2 border-[#181d26] border-t-transparent rounded-full animate-spin" />
      ) : (
        <MessageSquare size={14} className={disabled ? "text-[#898989]" : "text-[#41454d]"} />
      )}
      {isSending ? t.actionCenter.sendingReminders : "Send Payment Reminders (App & SMS)"}
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
    <div className="flex-1 min-w-[300px] bg-[#ffffff] rounded-[8px] shadow-sm border border-[#dddddd] flex flex-col overflow-hidden">
      <div className={`p-5 border-b border-[#dddddd] bg-[#ffffff] flex justify-between items-center`}>
        <div className="flex flex-col gap-1">
          <h3 className="font-medium text-[#181d26] text-[16px] capitalize tracking-wide">{title.toLowerCase()}</h3>
          <span className="text-[12px] font-normal text-[#5a5a5a] capitalize tracking-wide">{monthLabel} {t.actionCenter.only?.toLowerCase()}</span>
        </div>
        <div className="flex items-center gap-2">
            {items.length > 0 && (
                <button 
                  onClick={handleExport}
                  title="Export List"
                  className="p-1.5 bg-[#ffffff] rounded-[6px] border border-[#dddddd] text-[#5a5a5a] hover:text-[#181d26] hover:bg-[#f8fafc] transition-all shadow-sm"
                >
                    <Download size={14} />
                </button>
            )}
            <span className="text-[12px] font-medium bg-[#f8fafc] px-2.5 py-1 rounded-[6px] text-[#41454d] border border-[#dddddd]">
                {items.length} pending
            </span>
        </div>
      </div>
      
      <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
        {items.length > 0 ? (
          <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3 scrollbar-slim">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 border-b border-[#dddddd]/50 last:border-0 hover:bg-[#f8fafc] transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f8fafc] flex items-center justify-center border border-[#dddddd] text-[#5a5a5a]">
                    <User size={14} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[#181d26]">{item.name}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] uppercase tracking-wide border border-[#dddddd] text-[#41454d] bg-[#f8fafc]">
                        {item.type}
                      </span>
                    </div>
                    <span className="text-[12px] text-[#5a5a5a] font-normal tracking-wide">
                        {item.phone || <span className="opacity-60">{t.actionCenter.noContact}</span>}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <span className="text-[14px] font-semibold text-[#181d26]">${item.amount.toLocaleString()}</span>
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

      <div className="p-4 bg-[#f8fafc] border-t border-[#dddddd] mt-auto space-y-3">
        <button className="w-full py-2.5 bg-[#ffffff] border border-[#dddddd] rounded-[6px] text-[13px] font-medium text-[#181d26] hover:bg-[#f8fafc] transition-all flex items-center justify-center gap-2 shadow-sm">
          <CtaIcon size={14} className="text-[#41454d]" />
          {ctaLabel}
        </button>
        
        {showSmsAction && <SendSmsButton listType={title.toLowerCase().replace(' ', '_')} disabled={items.length === 0} />}
        
        <Link href="/admin" className="mt-3 flex items-center justify-center gap-1 text-[12px] font-medium text-[#5a5a5a] hover:text-[#181d26] cursor-pointer transition-colors capitalize tracking-wide">
          <span>{t.actionCenter.viewHistory}</span>
          <ArrowRight size={14} />
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
        <div className="bg-[#ffffff] rounded-[8px] p-6 border border-[#dddddd] shadow-sm flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[4px] h-full bg-rose-500 rounded-l-[8px]" />
          <div className="flex items-center gap-2 text-rose-600">
             <Wallet size={16} />
             <p className="text-[14px] font-medium capitalize tracking-wide text-[#41454d]">{t.actionCenter.unpaidEmployees}</p>
          </div>
          <h2 className="text-[32px] font-normal text-[#181d26] leading-[1.2]">${calculatedUnpaidEmployeesTotal.toLocaleString()}</h2>
        </div>

        <div className="bg-[#ffffff] rounded-[8px] p-6 border border-[#dddddd] shadow-sm flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[4px] h-full bg-emerald-500 rounded-l-[8px]" />
          <div className="flex items-center gap-2 text-emerald-600">
             <HandCoins size={16} />
             <p className="text-[14px] font-medium capitalize tracking-wide text-[#41454d]">{t.actionCenter.uncollectedFees}</p>
          </div>
          <h2 className="text-[32px] font-normal text-[#181d26] leading-[1.2]">${calculatedUncollectedFeesTotal.toLocaleString()}</h2>
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
