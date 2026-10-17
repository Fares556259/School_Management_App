import { getRole } from "@/lib/role";
import { getCachedTenantData } from "@/lib/cache";
import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Notice, Class, Prisma } from "@prisma/client";
import { getSchoolId } from "@/lib/school";
import { Megaphone, Plus, FileText, Image as ImageIcon, Pencil, Trash2 } from "lucide-react";
import AnnouncementPreviewModal from "./AnnouncementPreviewModal";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";
import OperationsListShell from "@/components/operations/OperationsListShell";
import OperationsFilters from "@/components/operations/OperationsFilters";

type NoticeList = Notice & { class: Class | null };

const AnnouncementListPage = async (props: { searchParams?: Promise<{ [key: string]: string | undefined }> }) => {
  const searchParams = await props.searchParams;
  const role = await getRole();
  const safeSearchParams = searchParams || {};
  const { page, search, classId } = safeSearchParams;
  const p = page ? parseInt(page) : 1;
  const schoolId = await getSchoolId();

  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("NEXT_LOCALE")?.value || "en";
  const locale = (["en", "fr", "ar"].includes(rawLocale) ? rawLocale : "en") as Locale;
  const t = translations[locale] || translations.en;

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

  const cached = await getCachedTenantData(
    schoolId,
    "institution",
    [p, search, classId, schoolId],
    () => Promise.all([
      prisma.notice.findMany({
        where: query,
        include: { class: true },
        orderBy: { date: "desc" },
        take: ITEM_PER_PAGE,
        skip: ITEM_PER_PAGE * (p - 1),
      }),
      prisma.notice.count({ where: query }),
      prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]),
    300
  ).catch(() => null);

  const [data, count, classes] = Array.isArray(cached) && cached.length === 3 ? cached : await Promise.all([
    prisma.notice.findMany({
      where: query,
      include: { class: true },
      orderBy: { date: "desc" },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.notice.count({ where: query }),
    prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <OperationsListShell
      icon={<Megaphone size={21} />}
      title={t.announcementsPage?.title || "Announcements"}
      subtitle={t.announcementsPage?.communications || "School Communications"}
      count={count}
      totalLabel={t.announcementsPage?.total || "Total"}
      action={(role === "admin" || role === "teacher") ? <FormModal table="announcement" type="create" relatedData={{ classes }} trigger={
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700">
          <Plus size={17} />{t.announcementsPage?.createAnnouncement || "Create Announcement"}
        </button>
      } /> : undefined}
      filters={<OperationsFilters classes={classes} defaultSearch={search} defaultClass={classId} searchPlaceholder={t.announcementsPage?.filters?.search || "Search announcements..."} allClassesLabel={t.announcementsPage?.filters?.globalOption || "All classes"} />}
      pagination={<Pagination page={p} count={count} />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-start border-collapse">
          <thead>
            <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="w-[40%] px-6 py-3.5">{t.announcementsPage?.table?.title || "Title"}</th>
              <th className="px-6 py-3.5">{t.announcementsPage?.table?.target || "Target"}</th>
              <th className="hidden px-6 py-3.5 sm:table-cell">{t.announcementsPage?.table?.date || "Date"}</th>
              <th className="px-6 py-3.5">{t.announcementsPage?.table?.attachments || "Attachments"}</th>
              {(role === "admin" || role === "teacher") && (
                <th className="px-6 py-3.5">{t.announcementsPage?.table?.actions || "Actions"}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-14 text-center">
                  <Megaphone className="mx-auto mb-3 text-slate-300" size={30} />
                  <p className="text-sm text-slate-500">{t.announcementsPage?.noAnnouncements || "No announcements found. Try adjusting your filters."}</p>
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 text-sm text-slate-600 transition-colors last:border-none hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-slate-900">{item.title}</span>
                      <span className="max-w-xs truncate text-xs text-slate-500 sm:max-w-md">{item.message}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
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
                  <td className="hidden px-6 py-4 text-xs text-slate-500 sm:table-cell">
                    {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(item.date))}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {item.img ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[11px] font-semibold border border-indigo-100" title="Attached Images">
                          <ImageIcon size={13} />
                          {item.img.split(',').filter(Boolean).length}
                        </span>
                      ) : null}
                      {item.pdfUrl ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[11px] font-semibold border border-emerald-100" title="Attached Documents">
                          <FileText size={13} />
                          {item.pdfUrl.split(',').filter(Boolean).length}
                        </span>
                      ) : null}
                      {!item.img && !item.pdfUrl && (
                        <span className="text-[#dddddd] font-medium text-[12px]">-</span>
                      )}
                    </div>
                  </td>
                  {(role === "admin" || role === "teacher") && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <AnnouncementPreviewModal item={item} />
                        <FormModal 
                           table="announcement" 
                           type="update" 
                           data={item}
                           relatedData={{ classes }}
                           trigger={
                             <button aria-label={t.announcementsPage.actions.edit} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900">
                               <Pencil size={14} strokeWidth={2} />
                             </button>
                           } 
                        />
                        <FormModal 
                           table="announcement" 
                           type="delete" 
                           id={item.id}
                           trigger={
                             <button aria-label={t.announcementsPage.actions.delete} className="group flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50">
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
    </OperationsListShell>
  );
};
export default AnnouncementListPage;
