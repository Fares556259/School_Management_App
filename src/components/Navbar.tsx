"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Image from "next/image"
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { useEffect, useState } from "react";
import { getAIUsageStats, toggleTestAIQuota } from "@/app/(dashboard)/admin/actions/aiActions";
import { Sparkles, Lock, Unlock, RefreshCw, Search, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";

const Navbar = ({ adminData: initialAdminData }: { adminData?: any }) => {
  const { user } = useUser();
  const { t } = useLanguage();
  const [adminData, setAdminData] = useState<any>(initialAdminData);
  const [aiStats, setAiStats] = useState<{usage: number, quota: number} | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const router = useRouter();

  const role = (user?.publicMetadata?.role as string) || "User";
  const pathname = usePathname();
  
  const pathSegments = pathname?.split('/').filter(Boolean) || [];

  // Update effect for adminData if prop changes from layout refresh
  useEffect(() => {
    setAdminData(initialAdminData);
  }, [initialAdminData]);

  useEffect(() => {
    if (role === "admin") {
      getAIUsageStats().then(setAiStats).catch(console.error);
    }
  }, [role]);

  return (
    <div className='flex items-center justify-between px-6 py-4 bg-[#F5F6F8]/80 backdrop-blur-md sticky top-0 z-50 border-b border-transparent transition-all'>
      {/* LEFT: PAGE TITLE */}
      <div className="hidden md:flex items-center flex-1">
        <h1 className="text-[24px] font-extrabold text-[#080808] tracking-[-1px]">
          {pathSegments.length > 0 ? pathSegments[pathSegments.length - 1].charAt(0).toUpperCase() + pathSegments[pathSegments.length - 1].slice(1) : "Dashboard"}
        </h1>
      </div>

      {/* RIGHT: UTILITIES */}
      <div className='flex items-center gap-3 justify-end flex-1'>
        {/* COMMAND BAR */}
        <div className='hidden md:flex items-center gap-3 text-[13px] rounded-[6px] bg-[#f9f9f9] border border-[#d8d8d8] px-3 py-1.5 hover:bg-[#ffffff] transition-all group w-[220px] cursor-pointer shadow-sm'>
          <Search size={15} className="text-[#898989] group-hover:text-[#080808] transition-colors" />
          <span className="text-[#5a5a5a] font-medium group-hover:text-[#080808] transition-colors flex-1">{(t.navbar as any)?.search || "Search"}</span>
        </div>

        {/* NOTIFICATIONS */}
        <div className='rounded-full w-9 h-9 flex items-center justify-center cursor-pointer relative transition-all group hover:bg-[#e5e7eb]/50'>
          <Bell size={18} className="text-[#9297a0] group-hover:text-[#41454d] transition-colors"/>
          <div className='absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border border-[#F5F6F8]'></div>
        </div>
        
        {/* LANGUAGE SWITCHER */}
        <div className="scale-90 origin-right">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  )
}

export default Navbar