"use client";

import Image from "next/image"
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { useEffect, useState } from "react";
import { getAIUsageStats, toggleTestAIQuota } from "@/app/(dashboard)/admin/actions/aiActions";
import { Sparkles, Lock, Unlock, RefreshCw, Search, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";

const Navbar = ({ adminData: initialAdminData, role = "User" }: { adminData?: any, role?: string }) => {
  const { t } = useLanguage();
  const [adminData, setAdminData] = useState<any>(initialAdminData);
  const [aiStats, setAiStats] = useState<{usage: number, quota: number} | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const router = useRouter();

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
        <h1 className="text-[24px] font-normal text-[#181d26] leading-[1.35] tracking-[0.12px]">
          {(() => {
            if (pathSegments.length === 0) return "Dashboard";
            const lastSegment = pathSegments[pathSegments.length - 1];
            const isId = /^[0-9a-fA-F-]{10,}$|^\d+$/.test(lastSegment) || lastSegment.length > 20;
            const targetSegment = isId && pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : lastSegment;
            return (t.menu as any)?.[targetSegment] || targetSegment.charAt(0).toUpperCase() + targetSegment.slice(1);
          })()}
        </h1>
      </div>

      {/* RIGHT: UTILITIES */}
      <div className='flex items-center gap-3 justify-end flex-1'>


        {/* NOTIFICATIONS */}
        <div className='rounded-full w-9 h-9 flex items-center justify-center cursor-pointer relative transition-all group hover:bg-[#e5e7eb]/50'>
          <Bell size={18} className="text-[#9297a0] group-hover:text-[#41454d] transition-colors"/>
          <div className='absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border border-[#F5F6F8]'></div>
        </div>
        
        {/* LANGUAGE SWITCHER */}
        <div className="scale-90 origin-right">
          <LanguageSwitcher />
        </div>

        {/* USER PROFILE */}
        <div className="flex items-center ml-2 border-l border-[#dddddd] pl-4">
          {adminData?.img ? (
            <Image src={adminData.img} alt="Profile" width={32} height={32} className="rounded-full object-cover w-8 h-8 shadow-sm border border-[#dddddd]" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 border border-[#dddddd] flex items-center justify-center">
              <span className="text-gray-500 text-xs font-bold">U</span>
            </div>
          )}
          <form action="/api/auth/signout" method="POST" className="ml-3">
            <button type="submit" className="text-xs text-red-500 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Navbar