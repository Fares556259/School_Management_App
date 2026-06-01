"use client";

import Link from 'next/link';
import { Plus, Wallet, HandCoins, Receipt } from 'lucide-react';
import { useLanguage } from '@/lib/translations/LanguageContext';

const QuickAction = ({ icon: Icon, label, variant, href }: { icon: any, label: string, variant: 'primary' | 'secondary', href: string }) => {
  const baseClasses = "flex items-center gap-2 px-5 py-2.5 rounded-[4px] transition-all group font-medium border";
  const variants = {
    primary: "bg-[#080808] hover:bg-[#222222] text-[#ffffff] border-transparent",
    secondary: "bg-[#ffffff] hover:bg-[#f9f9f9] text-[#080808] border-[#d8d8d8]"
  };

  return (
    <Link href={href} className={`${baseClasses} ${variants[variant]}`}>
      <Icon size={16} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
      <span className="text-[16px] tracking-tight">{label}</span>
    </Link>
  );
};

const QuickActionBar = () => {
  const { t } = useLanguage();
  
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      <QuickAction icon={Plus} label={t.adminWidgets.addIncome} variant="primary" href="/list/incomes?add=true" />
      <QuickAction icon={Receipt} label={t.adminWidgets.addExpense} variant="secondary" href="/list/expenses?add=true" />
    </div>
  );
};

export default QuickActionBar;
