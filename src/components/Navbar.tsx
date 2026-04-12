"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Image from "next/image"
import { getAdminProfile } from "@/app/(dashboard)/admin/actions/profileActions";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { useEffect, useState } from "react";
import { getAIUsageStats } from "@/app/(dashboard)/admin/actions/aiActions";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const Navbar = () => {
  const { user } = useUser();
  const { t } = useLanguage();
  const [adminData, setAdminData] = useState<any>(null);
  const [aiStats, setAiStats] = useState<{usage: number, quota: number} | null>(null);

  const fullName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "User";
  const role = (user?.publicMetadata?.role as string) || "User";

  useEffect(() => {
    if (role === "admin") {
      getAdminProfile().then(resp => setAdminData(resp?.data)).catch(console.error);
      getAIUsageStats().then(setAiStats).catch(console.error);
    }
  }, [role]);

  return (
    <div className='flex items-center justify-between p-6 bg-white/50 backdrop-blur-sm sticky top-0 z-50'>
      {/* SEARCH BAR */}
      <div className='hidden md:flex items-center gap-3 text-xs rounded-2xl bg-slate-100/80 border border-slate-200 px-4 py-2 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all group'>
        <Image src="/search.png" alt="" width={16} height={16} className="opacity-40 group-hover:opacity-100 transition-opacity"/>
        <input type="text" placeholder={t.navbar.search} className="w-[240px] bg-transparent outline-none text-slate-600 placeholder:text-slate-400 font-medium"/>
      </div>
        {/* ICONS AND USER */}
      <div className='flex items-center gap-5 justify-end w-full'>
        <div className='bg-white border border-slate-100 shadow-sm rounded-xl w-10 h-10 flex items-center justify-center cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-all group'>
          <Image src="/message.png" alt="" width={20} height={20} className="group-hover:scale-110 transition-transform"/>
        </div>
        <div className='bg-white border border-slate-100 shadow-sm rounded-xl w-10 h-10 flex items-center justify-center cursor-pointer relative hover:bg-indigo-50 hover:text-indigo-600 transition-all group'>
          <Image src="/announcement.png" alt="" width={20} height={20} className="group-hover:scale-110 transition-transform"/>
          <div className='absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-indigo-500 text-white rounded-full text-[10px] font-bold border-2 border-white shadow-sm'>1</div>
        </div>
        
        {/* LANGUAGE SWITCHER */}
        <LanguageSwitcher />

        {/* AI USAGE TRACKER (Admin Only) */}
        {role === "admin" && aiStats && (
          <div className='hidden lg:flex items-center gap-2 bg-indigo-50/50 px-3 py-1.5 rounded-2xl border border-indigo-100/50 hover:bg-white transition-all group cursor-help ml-2' title="Quota AI Quotidien">
             <div className="p-1 rounded-lg bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-500/10 group-hover:scale-110 transition-transform">
                <Sparkles size={10} />
             </div>
             <div className="flex flex-col -space-y-0.5">
                <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Zbiba AI</span>
                <div className="flex items-center gap-1.5">
                   <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(aiStats.usage / (aiStats.quota || 10)) * 100}%` }}
                        className={`h-full rounded-full ${aiStats.usage / (aiStats.quota || 10) > 0.8 ? 'bg-amber-400' : 'bg-indigo-500'}`}
                      />
                   </div>
                   <span className="text-[9px] font-black text-slate-500">{aiStats.usage}/{aiStats.quota}</span>
                </div>
             </div>
          </div>
        )}

        <div className='h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block'></div>
        <div className='flex items-center gap-3 pl-2'>
          <div className='flex flex-col text-right hidden sm:flex leading-tight'>
            <span className="text-sm font-black text-slate-800">
                {fullName}
            </span>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              {role || "User"}
            </span>
          </div>
          {adminData?.img ? (
            <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-sm cursor-pointer hover:scale-105 transition-transform overflow-hidden">
               <Image src={adminData.img} alt="" width={38} height={38} className="rounded-full border-2 border-white object-cover w-[38px] h-[38px]"/>
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