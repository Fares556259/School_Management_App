"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Image from "next/image"
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { useEffect, useState } from "react";
import { getAIUsageStats, toggleTestAIQuota } from "@/app/(dashboard)/admin/actions/aiActions";
import { Sparkles, Lock, Unlock, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const Navbar = ({ adminData: initialAdminData }: { adminData?: any }) => {
  const { user } = useUser();
  const { t } = useLanguage();
  const [adminData, setAdminData] = useState<any>(initialAdminData);
  const [aiStats, setAiStats] = useState<{usage: number, quota: number} | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const router = useRouter();

  const fullName = adminData?.name || adminData?.surname 
    ? `${adminData.name || ""} ${adminData.surname || ""}`.trim() 
    : user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "User";
    
  const role = (user?.publicMetadata?.role as string) || "User";

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
    <div className='flex items-center justify-between px-8 py-5 bg-[#F5F6F8]/80 backdrop-blur-md sticky top-0 z-50 border-b border-transparent transition-all'>
      {/* SEARCH BAR */}
      <div className='hidden md:flex items-center gap-3 text-[13px] rounded-lg bg-white border border-[#e5e7eb] px-3 py-1.5 hover:border-[#d1d5db] hover:shadow-sm transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)] group flex-1 max-w-md'>
        <Image src="/search.png" alt="" width={14} height={14} className="opacity-40 group-hover:opacity-60 transition-opacity"/>
        <input type="text" placeholder={`${t.navbar.search}...`} className="w-full bg-transparent outline-none text-[#181d26] placeholder:text-[#9297a0] font-medium"/>
        <div className="flex items-center gap-1 bg-[#F5F6F8] border border-[#e5e7eb] px-1.5 py-0.5 rounded text-[10px] font-bold text-[#9297a0] shrink-0 ml-auto">
          <span>⌘</span>
          <span>K</span>
        </div>
      </div>
        {/* ICONS AND USER */}
      <div className='flex items-center gap-5 justify-end w-full'>
        <div className='bg-white border border-[#e5e7eb] shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-lg w-9 h-9 flex items-center justify-center cursor-pointer hover:bg-[#F9FAFB] transition-all group'>
          <Image src="/message.png" alt="" width={18} height={18} className="group-hover:scale-105 transition-transform opacity-70"/>
        </div>
        <div className='bg-white border border-[#e5e7eb] shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-lg w-9 h-9 flex items-center justify-center cursor-pointer relative hover:bg-[#F9FAFB] transition-all group'>
          <Image src="/announcement.png" alt="" width={18} height={18} className="group-hover:scale-105 transition-transform opacity-70"/>
          <div className='absolute -top-1.5 -right-1.5 w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white rounded-full text-[9px] font-bold border-2 border-[#F5F6F8] shadow-sm'>1</div>
        </div>
        
        {/* LANGUAGE SWITCHER */}
        <LanguageSwitcher />



        <div className='h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block'></div>
        <div className='flex items-center gap-3 pl-2'>
          <div className='flex flex-col text-right hidden sm:flex leading-tight'>
            <span className="text-[13px] font-semibold text-[#181d26]">
                {fullName}
            </span>
            <span className="text-[10px] text-[#9297a0] font-medium uppercase tracking-wider">
              {role || "User"}
            </span>
          </div>
          {adminData?.img ? (
            <div className="relative p-0.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-[#e5e7eb] cursor-pointer hover:scale-105 transition-transform overflow-hidden">
               <Image src={adminData.img} alt="" width={34} height={34} className="rounded-full object-cover w-[34px] h-[34px]"/>
            </div>
          ) : (
            <UserButton />
          )}
        </div>
      </div>
    </div>
  )
}

export default Navbar