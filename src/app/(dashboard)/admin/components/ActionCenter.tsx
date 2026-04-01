"use client";
import QuickPayButton from '../finance/QuickPayButton';
import Link from 'next/link';
import { User, Calendar, ExternalLink, CheckCircle2, ArrowRight, HandCoins, Wallet, Download, MessageSquare, Clock } from 'lucide-react';
import { downloadCSV } from '@/lib/csvExport';
import { useState, useEffect } from 'react';

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
}

const SendSmsButton = ({ listType }: { listType: string }) => {
  const [cooldown, setCooldown] = useState<number>(0);
  const [isSending, setIsSending] = useState(false);
  const storageKey = `sms_cooldown_${listType}`;

  useEffect(() => {
    const checkCooldown = () => {
      const lastSent = localStorage.getItem(storageKey);
      if (lastSent) {
        const elapsed = Date.now() - parseInt(lastSent);
        const remaining = 24 * 60 * 60 * 1000 - elapsed;
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
    setIsSending(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    localStorage.setItem(storageKey, Date.now().toString());
    setCooldown(24 * 60 * 60 * 1000);
    setIsSending(false);
  };

  const formatCooldown = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (cooldown > 0) {
    return (
      <button 
        disabled
        className="w-full py-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-400 flex items-center justify-center gap-2 cursor-not-allowed"
      >
        <Clock size={14} />
        SMS Sent (Locked for {formatCooldown(cooldown)})
      </button>
    );
  }

  return (
    <button 
      onClick={handleSendSms}
      disabled={isSending}
      className="w-full py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-[#4F46E5] hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 shadow-sm group/sms"
    >
      {isSending ? (
        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      ) : (
        <MessageSquare size={14} className="text-indigo-400 group-hover/sms:scale-110 transition-transform" />
      )}
      {isSending ? 'Sending Reminders...' : 'Send Payment SMS Reminders'}
    </button>
  );
};

const ActionList = ({ 
  title, 
  items, 
  color, 
  ctaLabel, 
  ctaIcon: CtaIcon,
  showSmsAction = false
}: { 
  title: string, 
  items: ActionItem[], 
  color: string,
  ctaLabel: string,
  ctaIcon: any,
  showSmsAction?: boolean
}) => {
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
    <div className="flex-1 min-w-[300px] bg-white rounded-[24px] shadow-sm border border-slate-100 flex flex-col overflow-hidden group">
      <div className={`p-5 border-b border-slate-50 flex justify-between items-center ${color}`}>
        <div className="flex items-center gap-2">
          <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">{title}</h3>
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
                {items.length} Pending
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
                        {item.phone || <span className="text-rose-400 opacity-60">No Contact</span>}
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
            <p className="text-sm font-bold text-slate-800">All Settled</p>
            <p className="text-[11px] text-slate-400 font-medium px-4">No pending payments for this month.</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-50/50 border-t border-slate-50 mt-auto space-y-3">
        <button className="w-full py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 shadow-sm">
          <CtaIcon size={14} className="text-slate-400" />
          {ctaLabel}
        </button>
        
        {showSmsAction && items.length > 0 && <SendSmsButton listType={title.toLowerCase().replace(' ', '_')} />}
        
        <Link href="/admin" className="mt-3 flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-500 cursor-pointer transition-colors uppercase tracking-widest">
          <span>View full history</span>
          <ExternalLink size={10} />
        </Link>
      </div>
    </div>
  );
};

const ActionCenter = ({ unpaidEmployees, unpaidFees }: ActionCenterProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      <ActionList 
        title="Unpaid Employees" 
        items={unpaidEmployees} 
        color="bg-indigo-500/5 text-indigo-600" 
        ctaLabel="Process Salaries & Payouts" 
        ctaIcon={HandCoins}
      />
      <ActionList 
        title="Uncollected Fees" 
        items={unpaidFees} 
        color="bg-amber-500/5 text-amber-600" 
        ctaLabel="Collect Student Payments" 
        ctaIcon={Calendar}
        showSmsAction={true}
      />
    </div>
  );
};

export default ActionCenter;
