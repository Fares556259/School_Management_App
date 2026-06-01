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
    <div className='flex items-center justify-between p-6 bg-[#F5F6F8]/80 backdrop-blur-sm sticky top-0 z-50'>
      {/* SEARCH BAR */}
      <div className='hidden md:flex items-center gap-3 text-[13px] rounded-2xl bg-white border border-[#dddddd] px-4 py-2 hover:border-slate-300 hover:shadow-sm transition-all shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] group'>
        <Image src="/search.png" alt="" width={16} height={16} className="opacity-40 group-hover:opacity-100 transition-opacity"/>
        <input type="text" placeholder={t.navbar.search} className="w-[240px] bg-transparent outline-none text-[#181d26] placeholder:text-[#9297a0] font-medium"/>
      </div>
        {/* ICONS AND USER */}
      <div className='flex items-center gap-5 justify-end w-full'>
        <div className='bg-white border border-[#dddddd] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-xl w-10 h-10 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all group'>
          <Image src="/message.png" alt="" width={20} height={20} className="group-hover:scale-110 transition-transform"/>
        </div>
        <div className='bg-white border border-[#dddddd] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-xl w-10 h-10 flex items-center justify-center cursor-pointer relative hover:bg-slate-50 transition-all group'>
          <Image src="/announcement.png" alt="" width={20} height={20} className="group-hover:scale-110 transition-transform"/>
          <div className='absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-rose-500 text-white rounded-full text-[10px] font-bold border-2 border-white shadow-sm'>1</div>
        </div>
        
        {/* LANGUAGE SWITCHER */}
        <LanguageSwitcher />



        <div className='h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block'></div>
        <div className='flex items-center gap-3 pl-2'>
          <div className='flex flex-col text-right hidden sm:flex leading-tight'>
            <span className="text-[14px] font-semibold text-[#181d26]">
                {fullName}
            </span>
            <span className="text-[10px] text-[#9297a0] font-bold uppercase tracking-widest">
              {role || "User"}
            </span>
          </div>
          {adminData?.img ? (
            <div className="relative p-0.5 rounded-full bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-[#dddddd] cursor-pointer hover:scale-105 transition-transform overflow-hidden">
               <Image src={adminData.img} alt="" width={38} height={38} className="rounded-full object-cover w-[38px] h-[38px]"/>
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