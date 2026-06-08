import prisma from "@/lib/prisma";
import { addSubscriber, removeSubscriber } from "./actions";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";
import { Mail, Send, Trash2, UserPlus, Users } from "lucide-react";

export default async function ReportsManagementPage() {
  const cookieStore = cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale) || "en";
  const t = translations[locale];

  const subscribers = await prisma.reportSubscriber.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 flex flex-col gap-8 flex-1 bg-white rounded-[16px] border border-[#dddddd] shadow-sm">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full mb-2">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <Mail size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-semibold text-[#181d26] leading-none tracking-tight mb-2">{t.dailyReports.title}</h1>
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#5a5a5a]">
              <span>{t.dailyReports.subtitle}</span>
            </div>
          </div>
        </div>
        
        {/* Manual Trigger Button */}
        <form action="/api/cron/daily-report" method="GET" target="_blank" className="flex items-center">
          <button
            type="submit"
            className="px-4 py-2.5 rounded-[6px] bg-[#181d26] text-white hover:bg-[#0d1218] border border-transparent font-medium text-[13px] active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm"
          >
            <Send size={14} className="text-white/80" />
            {t.dailyReports.sendButton}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Subscriber Form */}
        <div className="col-span-1 border border-[#dddddd] rounded-[8px] p-6 bg-[#f8fafc] h-fit">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus size={16} className="text-[#5a5a5a]" />
            <h2 className="text-[14px] font-semibold text-[#181d26]">{t.dailyReports.addStakeholder}</h2>
          </div>
          <form action={addSubscriber} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-[12px] font-medium text-[#41454d]">{t.dailyReports.fullName}</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder={t.dailyReports.namePlaceholder}
                className="w-full px-3 py-2.5 border border-[#dddddd] rounded-[6px] text-[13px] font-medium text-[#181d26] focus:border-indigo-500 focus:outline-none transition-all placeholder:font-normal placeholder:text-[#9297a0] bg-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[12px] font-medium text-[#41454d]">{t.dailyReports.email}</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder={t.dailyReports.emailPlaceholder}
                required
                className="w-full px-3 py-2.5 border border-[#dddddd] rounded-[6px] text-[13px] font-medium text-[#181d26] focus:border-indigo-500 focus:outline-none transition-all placeholder:font-normal placeholder:text-[#9297a0] bg-white"
              />
            </div>
            <button
              type="submit"
              className="mt-2 w-full bg-[#181d26] hover:bg-[#0d1218] text-white rounded-[6px] py-2.5 font-medium text-[13px] transition-all shadow-sm active:scale-[0.99]"
            >
              {t.dailyReports.addToList}
            </button>
          </form>
        </div>

        {/* List of Subscribers */}
        <div className="col-span-1 lg:col-span-2 border border-[#dddddd] rounded-[8px] bg-white overflow-hidden shadow-sm">
          <div className="bg-[#f8fafc] border-b border-[#dddddd] px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#5a5a5a]" />
              <h2 className="text-[14px] font-semibold text-[#181d26]">{t.dailyReports.activeRecipients}</h2>
            </div>
            <span className="bg-indigo-50 text-indigo-700 font-bold text-[10px] px-2 py-0.5 rounded-[4px] border border-indigo-200/50">
              {subscribers.length} {t.dailyReports.total}
            </span>
          </div>
          
          <div>
            {subscribers.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <Users size={32} className="text-[#dddddd] mb-3" />
                <p className="text-[14px] font-medium text-[#181d26]">{t.dailyReports.noSubscribers}</p>
                <p className="text-[13px] text-[#9297a0] mt-1">{t.dailyReports.noSubscribersDesc}</p>
              </div>
            ) : (
              <ul className="flex flex-col">
                {subscribers.map((sub) => (
                  <li key={sub.id} className="p-4 flex items-center justify-between hover:bg-[#fafafa] border-b border-[#f0f0f0] last:border-none transition-colors group">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[14px]">
                        {sub.name ? sub.name[0].toUpperCase() : sub.email[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[13px] font-medium text-[#181d26]">{sub.name || t.dailyReports.unknownName}</p>
                        <p className="text-[12px] text-[#5a5a5a]">{sub.email}</p>
                      </div>
                    </div>
                    <form action={async () => {
                      "use server";
                      await removeSubscriber(sub.id);
                    }}>
                      <button 
                        type="submit"
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-[4px] transition-colors border border-transparent hover:border-rose-200 flex items-center justify-center"
                        title={t.dailyReports.removeSubscriber}
                      >
                        <Trash2 size={16} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
