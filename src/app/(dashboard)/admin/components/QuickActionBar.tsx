import Link from 'next/link';
import { Plus, Wallet, HandCoins, Receipt } from 'lucide-react';

const QuickAction = ({ icon: Icon, label, color, href }: { icon: any, label: string, color: string, href: string }) => (
  <Link href={href} className={`flex items-center gap-2 px-4 py-2 bg-${color}-500 hover:bg-${color}-600 rounded-xl shadow-sm transition-all text-white group`}>
    <Icon size={16} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
    <span className="text-[11px] font-black tracking-widest uppercase">{label}</span>
  </Link>
);

const QuickActionBar = () => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      <QuickAction icon={Plus} label="Add Income" color="emerald" href="/list/incomes?add=true" />
      <QuickAction icon={Receipt} label="Add Expense" color="rose" href="/list/expenses?add=true" />
    </div>
  );
};

export default QuickActionBar;
