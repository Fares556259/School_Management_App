import { getRole } from "@/lib/role";
import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Notice, Class, Prisma } from "@prisma/client";
import { getSchoolId } from "@/lib/school";
import { Megaphone, Plus, FileText, Image as ImageIcon, Pencil, Trash2 } from "lucide-react";
import AnnouncementFilters from "./AnnouncementFilters";
import AnnouncementPreviewModal from "./AnnouncementPreviewModal";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";

type NoticeList = Notice & { class: Class | null };

const AnnouncementListPage = async ({ searchParams }: { searchParams: { [key: string]: string | undefined } }) => {
  const role = await getRole();
  const { page, search, classId } = searchParams;
  const p = page ? parseInt(page) : 1;
  const schoolId = await getSchoolId();

  const cookieStore = cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale) || "en";
  const t = translations[locale];

  const query: Prisma.NoticeWhereInput = { schoolId };
  if (search) {
    query.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { message: { contains: search, mode: "insensitive" } },
    ];
  }
  if (classId) {
    query.classId = parseInt(classId);
  }

  const [data, count] = await Promise.all([
    prisma.notice.findMany({
      where: query,
      include: { class: true },
      orderBy: { date: "desc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.notice.count({ where: query }),
  ]);

  // Fetch classes for the filter dropdown
  const classes = await prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: 'asc' } });

  return (
    <div className="p-6 flex flex-col gap-8 flex-1 bg-white rounded-[16px] border border-[#dddddd] shadow-sm">
      {/* Header Section */}
      <div className="flex flex-col gap-6 w-full mb-2">
        
        {/* Top Row: Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Megaphone size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-[28px] font-semibold text-[#181d26] leading-none tracking-tight mb-2">{t.announcementsPage?.title || "Announcements"}</h1>
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#5a5a5a]">
                <span>{t.announcementsPage?.communications || "School Communications"}</span>
                <span className="w-1 h-1 rounded-full bg-[#dddddd]"></span>
                <span className="text-indigo-600 font-medium">{count} {t.announcementsPage?.total || "Total"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(role === "admin" || role === "teacher") && (
              <FormModal 
                table="announcement" 
                type="create" 
                relatedData={{ classes }}
                trigger={
                  <button className="px-4 py-2.5 rounded-[6px] bg-[#181d26] text-white hover:bg-[#0d1218] border border-transparent font-medium text-[13px] active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm">
                    <Plus size={14} className="text-white/80" /> {t.announcementsPage?.createAnnouncement || "Create Announcement"}
                  </button>
                }
              />
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <AnnouncementFilters 
          classes={classes} 
          defaultSearch={search} 
          defaultClass={classId} 
        />
      </div>

      {/* Table Area */}
      <div className="bg-[#ffffff] border border-[#dddddd] rounded-[8px] overflow-x-auto">
        <table className="w-full text-start border-collapse">
          <thead>
            <tr className="border-b border-[#dddddd] bg-[#f8fafc]">
              <th className="px-4 py-3 text-[12px] font-medium text-[#41454d] w-[40%]">{t.announcementsPage?.table?.title || "Title"}</th>
              <th className="px-4 py-3 text-[12px] font-medium text-[#41454d]">{t.announcementsPage?.table?.target || "Target"}</th>
              <th className="px-4 py-3 text-[12px] font-medium text-[#41454d] hidden sm:table-cell">{t.announcementsPage?.table?.date || "Date"}</th>
              <th className="px-4 py-3 text-[12px] font-medium text-[#41454d]">{t.announcementsPage?.table?.attachments || "Attachments"}</th>
              {(role === "admin" || role === "teacher") && (
                <th className="px-4 py-3 text-[12px] font-medium text-[#41454d]">{t.announcementsPage?.table?.actions || "Actions"}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[13px] text-[#9297a0]">
                  {t.announcementsPage?.noAnnouncements || "No announcements found. Try adjusting your filters."}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="border-b border-[#f0f0f0] last:border-none hover:bg-[#fafafa] group">
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-[#181d26] group-hover:text-indigo-600 transition-colors">{item.title}</span>
                      <span className="text-[12px] text-[#5a5a5a] max-w-xs sm:max-w-md truncate">{item.message}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wide uppercase ${item.class ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'}`}>
                        {item.class ? `${t.announcementsPage?.filters?.classPrefix || "Class "}${item.class.name}` : (t.announcementsPage?.global || "GLOBAL")}
                      </span>
                      {item.important && (
                        <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wide uppercase bg-rose-50 text-rose-700 border border-rose-200/50">
                          {t.announcementsPage?.urgent || "URGENT"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[12px] font-medium text-[#5a5a5a] hidden sm:table-cell">
                    {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(item.date)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2.5">
                      {item.img ? <ImageIcon size={16} className="text-indigo-500" /> : <span className="text-[#dddddd] font-medium text-[12px]">-</span>}
                      {item.pdfUrl ? <FileText size={16} className="text-emerald-500" /> : null}
                    </div>
                  </td>
                  {(role === "admin" || role === "teacher") && (
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <AnnouncementPreviewModal item={item} />
                        <FormModal 
                           table="announcement" 
                           type="update" 
                           data={item}
                           relatedData={{ classes }}
                           trigger={
                             <button className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-colors text-[#41454d]" title="Edit">
                               <Pencil size={14} strokeWidth={2} />
                             </button>
                           } 
                        />
                        <FormModal 
                           table="announcement" 
                           type="delete" 
                           id={item.id}
                           trigger={
                             <button className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-rose-50 hover:text-rose-600 transition-colors group text-[#41454d]" title="Delete">
                               <Trash2 size={16} strokeWidth={2} className="group-hover:text-rose-600" />
                             </button>
                           }
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={p} count={count} />
    </div>
  );
};
export default AnnouncementListPage;
