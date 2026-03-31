import Link from 'next/link';
import { Plus, Wallet, HandCoins, Receipt } from 'lucide-react';

const QuickAction = ({ icon: Icon, label, color, href }: { icon: any, label: string, color: string, href: string }) => (
  <Link href={href} className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 transition-all group">
    <div className={`p-1.5 rounded-lg ${color} group-hover:scale-110 transition-transform`}>
      <Icon size={16} className="text-white" />
    </div>
    <span className="text-sm font-bold text-slate-700 whitespace-nowrap">{label}</span>
  </Link>
);

const QuickActionBar = () => {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
      <QuickAction icon={Plus} label="Add Income" color="bg-emerald-500" href="/list/incomes?add=true" />
      <QuickAction icon={Receipt} label="Add Expense" color="bg-rose-500" href="/list/expenses?add=true" />
      <QuickAction icon={Wallet} label="Pay Salaries" color="bg-indigo-500" href="/admin?scroll=action-center" />
      <QuickAction icon={HandCoins} label="Collect Payments" color="bg-amber-500" href="/admin?scroll=action-center" />
    </div>
  );
};

export default QuickActionBar;
