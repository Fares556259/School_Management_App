"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";

export default function CashRegisterLink() {
  const { t } = useLanguage();
  return (
    <Link href="/admin/cash-register" className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50">
      <Wallet size={16} aria-hidden />
      {t.menu["cash-register"]}
    </Link>
  );
}
