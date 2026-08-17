import { getRole } from "@/lib/role";
import CrudFormModal from "@/components/CrudFormModal";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { seedDefaultSubjects } from "@/lib/crudActions";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";

export const dynamic = "force-dynamic";

const DOMAIN_EMOJIS: Record<string, string> = {
  "Languages":          "🔤",
  "Sciences":           "🔬",
  "Religion & Values":  "🕌",
  "Humanities":         "🌍",
  "Arts & Technology":  "🎨",
  "Sport":              "⚽",
  "General":            "📚",
};

function parseSubjectName(name: string) {
  const parts = name.split("|").map((p) => p.trim());
  if (parts.length >= 3) return { arabic: parts[0], french: parts[1], english: parts[2] };
  return { arabic: null, french: null, english: parts[0] };
}

const SubjectListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const supabase = createClient();
  await supabase.auth.getUser();
  const role = await getRole();
  const schoolId = await getSchoolId();

  const langCookie = cookies().get("NEXT_LOCALE")?.value || "en";
  const lang = (["en", "fr", "ar"].includes(langCookie) ? langCookie : "en") as Locale;
  const t = translations[lang];

  await seedDefaultSubjects();

  const query: Prisma.SubjectWhereInput = { schoolId };
  const searchValue = searchParams?.search;
  if (searchValue) {
    query.name = { contains: searchValue, mode: "insensitive" };
  }

  const subjects = await getCachedTenantData(
    schoolId,
    'subjects',
    [searchValue || 'all'],
    () => prisma.subject.findMany({
      where: query,
      include: {
        teachers: { select: { id: true, name: true, surname: true } },
        _count: { select: { teachers: true, lessons: true } },
      },
      orderBy: [{ domain: "asc" }, { name: "asc" }],
    }),
    300
  );

  const grouped = subjects.reduce<Record<string, typeof subjects>>((acc, s) => {
    const d = s.domain || "General";
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});

  const domainCount = Object.keys(grouped).length;
  const totalTeachers = new Set(subjects.flatMap(s => s.teachers.map(t => t.id))).size;
  const totalLessons = subjects.reduce((sum, s) => sum + s._count.lessons, 0);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">

        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t.subjectsPage.pageTitle}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {t.subjectsPage.pageDesc}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {role === "admin" && (
              <CrudFormModal 
                entity="subject" 
                mode="create" 
                trigger={
                  <button className="flex items-center gap-2 bg-[#181d26] text-white px-4 py-2.5 rounded-[6px] text-[13px] font-medium hover:bg-[#0d1218] transition-colors shadow-sm">
                    <span className="text-lg leading-none">+</span> {t.subjectsPage.addSubject}
                  </button>
                }
              />
            )}
          </div>
        </div>

        {/* ── STATS BAR (PREMIUM MINIMALIST) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { label: t.subjectsPage.totalSubjects, value: subjects.length, emoji: "📚" },
            { label: t.subjectsPage.activeTeachers, value: totalTeachers, emoji: "👩‍🏫" },
            { label: t.subjectsPage.scheduledLessons, value: totalLessons, emoji: "🗓️" },
          ].map((stat) => (
            <div 
              key={stat.label} 
              className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center justify-between shadow-[0_2px_8px_-3px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_12px_-3px_rgba(0,0,0,0.05)] transition-shadow duration-200"
            >
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50/70 border border-indigo-100/50 flex items-center justify-center text-xl text-indigo-600 shrink-0">
                {stat.emoji}
              </div>
            </div>
          ))}
        </div>

        {/* ── SUBJECT GROUPS ── */}
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([domain, domainSubjects]) => {
            const emoji = DOMAIN_EMOJIS[domain] || DOMAIN_EMOJIS["General"];
            const translatedDomain = t.subjectsPage.domains[domain as keyof typeof t.subjectsPage.domains] || domain;

            return (
              <section 
                key={domain} 
                className="bg-white rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden"
              >
                {/* Clean, Premium Header Band */}
                <div className="border-b border-slate-100/70 px-6 py-4 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm shrink-0">
                      {emoji}
                    </span>
                    <div>
                      <h2 className="text-slate-800 font-bold text-base tracking-tight">{translatedDomain}</h2>
                      <p className="text-slate-400 text-xs font-medium mt-0.5">
                        {domainSubjects.length} {domainSubjects.length !== 1 ? t.subjectsPage.subjectsInCategory : t.subjectsPage.subjectInCategory}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Subject Rows */}
                <div className="divide-y divide-slate-100">
                  {domainSubjects.map((subject, idx) => {
                    const { arabic, french, english } = parseSubjectName(subject.name);
                    const teacherNames = subject.teachers.map(t => `${t.name} ${t.surname}`).join(", ");

                    return (
                      <div
                        key={subject.id}
                        className="group flex items-center gap-6 px-6 py-4 hover:bg-slate-50/30 transition-all duration-150"
                      >
                        {/* Index number */}
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100">
                          {String(idx + 1).padStart(2, "0")}
                        </div>

                        {/* Trilingual name block */}
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-center">
                          {/* Arabic */}
                          <div className="text-right order-1 md:order-1" dir="rtl" lang="ar">
                            <p className="text-base font-bold text-slate-800 leading-snug truncate">
                              {arabic || english}
                            </p>
                          </div>
                          {/* French */}
                          <div className="text-center order-3 md:order-2 border-slate-100 md:border-x px-4 py-1 md:py-0">
                            <p className="text-sm font-semibold text-slate-500 italic leading-snug truncate">
                              {french || "—"}
                            </p>
                          </div>
                          {/* English */}
                          <div className="order-2 md:order-3">
                            <p className="text-xs font-bold text-slate-400 leading-snug truncate">
                              {english}
                            </p>
                          </div>
                        </div>

                        {/* Teachers */}
                        <div className="hidden lg:flex flex-col items-end min-w-[140px] max-w-[180px]">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t.subjectsPage.assignedTeachers}</span>
                          <span className="text-xs font-semibold text-slate-500 text-right truncate w-full" title={teacherNames || t.subjectsPage.noTeachersAssigned}>
                            {teacherNames || "—"}
                          </span>
                        </div>

                        {/* Stats chips */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 flex items-center gap-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                            <span className="text-xs font-extrabold text-slate-700">{subject._count.lessons}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t.subjectsPage.lessons}</span>
                          </div>
                        </div>

                        {/* Admin actions — appear on hover */}
                        {role === "admin" && (
                          <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5">
                            <CrudFormModal entity="subject" mode="delete" id={subject.id} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* ── EMPTY STATE ── */}
        {subjects.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-20 gap-4 text-center shadow-sm">
            <span className="text-5xl">📚</span>
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-1">{t.subjectsPage.noSubjectsFound}</h3>
              <p className="text-xs font-medium text-slate-400 max-w-xs mx-auto">
                {searchValue ? t.subjectsPage.tryDifferentSearch : t.subjectsPage.clickToAdd}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectListPage;
