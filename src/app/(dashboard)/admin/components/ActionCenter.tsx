import QuickPayButton from '../finance/QuickPayButton';
import { User, Calendar, ExternalLink, CheckCircle2, ArrowRight, HandCoins, Wallet } from 'lucide-react';

interface ActionItem {
  id: string;
  name: string;
  amount: number;
  type: 'student' | 'teacher' | 'staff';
  phone?: string;
}

interface ActionCenterProps {
  unpaidStudents: ActionItem[];
  unpaidTeachers: ActionItem[];
  unpaidStaff: ActionItem[];
}

const ActionList = ({ 
  title, 
  items, 
  color, 
  ctaLabel, 
  ctaIcon: CtaIcon 
}: { 
  title: string, 
  items: ActionItem[], 
  color: string,
  ctaLabel: string,
  ctaIcon: any
}) => (
  <div className="flex-1 min-w-[300px] bg-white rounded-[24px] shadow-sm border border-slate-100 flex flex-col overflow-hidden group">
    <div className={`p-5 border-b border-slate-50 flex justify-between items-center ${color}`}>
      <div className="flex items-center gap-2">
        <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <span className="text-[10px] font-black bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-slate-500 shadow-sm border border-slate-100">
        {items.length} Pending
      </span>
    </div>
    
    <div className="p-4 space-y-3 flex-1">
      {items.length > 0 ? (
        <>
          {items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50/50 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group/item">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 text-slate-400 group-hover/item:text-indigo-500 transition-colors">
                  <User size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700">{item.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{item.phone || 'No Contact'}</span>
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
          {items.length > 3 && (
            <button className="w-full py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-500 transition-colors flex items-center justify-center gap-1 group/more">
              + {items.length - 3} more items <ArrowRight size={10} className="group-hover/more:translate-x-1 transition-transform" />
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
            <CheckCircle2 size={24} />
          </div>
          <p className="text-sm font-bold text-slate-800">All Settled</p>
          <p className="text-[11px] text-slate-400 font-medium px-4">No pending payments for this category.</p>
        </div>
      )}
    </div>

    <div className="p-4 bg-slate-50/50 border-t border-slate-50 mt-auto">
      <button className="w-full py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 shadow-sm">
        <CtaIcon size={14} className="text-slate-400" />
        {ctaLabel}
      </button>
      <div className="mt-3 flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-500 cursor-pointer transition-colors uppercase tracking-widest">
        <span>View full history</span>
        <ExternalLink size={10} />
      </div>
    </div>
  </div>
);

const ActionCenter = ({ unpaidStudents, unpaidTeachers, unpaidStaff }: ActionCenterProps) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
      <ActionList 
        title="Students" 
        items={unpaidStudents} 
        color="bg-amber-500/5 text-amber-600" 
        ctaLabel="Collect Payments" 
        ctaIcon={Calendar}
      />
      <ActionList 
        title="Teachers" 
        items={unpaidTeachers} 
        color="bg-rose-500/5 text-rose-600" 
        ctaLabel="Pay Salaries" 
        ctaIcon={HandCoins}
      />
      <ActionList 
        title="Staff" 
        items={unpaidStaff} 
        color="bg-indigo-500/5 text-indigo-600" 
        ctaLabel="Process Payouts" 
        ctaIcon={Wallet}
      />
    </div>
  );
};

export default ActionCenter;
