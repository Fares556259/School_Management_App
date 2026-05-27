import { getRole } from "@/lib/role";
import CrudFormModal from "@/components/CrudFormModal";
import { getSchoolId } from "@/lib/school";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { seedDefaultSubjects } from "@/lib/crudActions";
import TableSearch from "@/components/TableSearch";

export const dynamic = "force-dynamic";

const DOMAIN_CONFIG: Record<string, { emoji: string; gradient: string; accent: string; light: string; text: string }> = {
  "Languages":          { emoji: "🔤", gradient: "from-indigo-500 to-violet-500",   accent: "bg-indigo-500",  light: "bg-indigo-50 border-indigo-100",  text: "text-indigo-700" },
  "Sciences":           { emoji: "🔬", gradient: "from-emerald-500 to-teal-500",    accent: "bg-emerald-500", light: "bg-emerald-50 border-emerald-100", text: "text-emerald-700" },
  "Religion & Values":  { emoji: "☪️", gradient: "from-amber-500 to-orange-500",    accent: "bg-amber-500",   light: "bg-amber-50 border-amber-100",    text: "text-amber-700" },
  "Humanities":         { emoji: "🌍", gradient: "from-rose-500 to-pink-500",       accent: "bg-rose-500",    light: "bg-rose-50 border-rose-100",      text: "text-rose-700" },
  "Arts & Technology":  { emoji: "🎨", gradient: "from-purple-500 to-fuchsia-500",  accent: "bg-purple-500",  light: "bg-purple-50 border-purple-100",  text: "text-purple-700" },
  "Sport":              { emoji: "⚽", gradient: "from-sky-500 to-cyan-500",        accent: "bg-sky-500",     light: "bg-sky-50 border-sky-100",        text: "text-sky-700" },
  "General":            { emoji: "📚", gradient: "from-slate-500 to-gray-500",      accent: "bg-slate-500",   light: "bg-slate-50 border-slate-100",    text: "text-slate-700" },
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
  auth();
  const role = await getRole();
  const schoolId = await getSchoolId();

  await seedDefaultSubjects();

  const query: Prisma.SubjectWhereInput = { schoolId };
  const searchValue = searchParams?.search;
  if (searchValue) {
    query.name = { contains: searchValue, mode: "insensitive" };
  }

  const subjects = await prisma.subject.findMany({
    where: query,
    include: {
      teachers: { select: { id: true, name: true, surname: true } },
      _count: { select: { teachers: true, lessons: true } },
    },
    orderBy: [{ domain: "asc" }, { name: "asc" }],
  });

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
    <div className="min-h-screen bg-[#F5F4FC] p-5 md:p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-7">

        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Subjects</h1>
            <p className="text-sm text-slate-400 font-semibold mt-1">
              {subjects.length} subjects · {domainCount} domains
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TableSearch />
            {role === "admin" && <CrudFormModal entity="subject" mode="create" />}
          </div>
        </div>

        {/* ── STAT PILLS ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Subjects", value: subjects.length, emoji: "📚", color: "text-purple-700 bg-purple-50 border-purple-100" },
            { label: "Assigned Teachers", value: totalTeachers, emoji: "👩‍🏫", color: "text-indigo-700 bg-indigo-50 border-indigo-100" },
            { label: "Scheduled Lessons", value: totalLessons, emoji: "🗓️", color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl border px-5 py-4 flex items-center gap-3 ${stat.color}`}>
              <span className="text-2xl">{stat.emoji}</span>
              <div>
                <p className="text-2xl font-black leading-none">{stat.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── DOMAIN SECTIONS ── */}
        {Object.entries(grouped).map(([domain, domainSubjects]) => {
          const cfg = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG["General"];

          return (
            <section key={domain} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">

              {/* Domain header band */}
              <div className={`bg-gradient-to-r ${cfg.gradient} px-6 py-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{cfg.emoji}</span>
                  <div>
                    <h2 className="text-white font-black text-base tracking-tight">{domain}</h2>
                    <p className="text-white/70 text-xs font-semibold">
                      {domainSubjects.length} subject{domainSubjects.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subject rows */}
              <div className="divide-y divide-slate-50">
                {domainSubjects.map((subject, idx) => {
                  const { arabic, french, english } = parseSubjectName(subject.name);
                  const teacherNames = subject.teachers.map(t => `${t.name} ${t.surname}`).join(", ");

                  return (
                    <div
                      key={subject.id}
                      className="group flex items-center gap-4 px-6 py-4 hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Index number */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black text-white bg-gradient-to-br ${cfg.gradient}`}>
                        {idx + 1}
                      </div>

                      {/* Trilingual name block */}
                      <div className="flex-1 min-w-0 grid grid-cols-3 gap-4 items-center">
                        {/* Arabic */}
                        <div className="text-right" dir="rtl" lang="ar">
                          <p className="text-base font-black text-slate-800 leading-snug truncate">
                            {arabic || english}
                          </p>
                        </div>
                        {/* French */}
                        <div className="text-center border-x border-slate-100 px-4">
                          <p className="text-sm font-bold text-slate-500 italic leading-snug truncate">
                            {french || "—"}
                          </p>
                        </div>
                        {/* English */}
                        <div>
                          <p className="text-xs font-bold text-slate-400 leading-snug truncate">
                            {english}
                          </p>
                        </div>
                      </div>

                      {/* Teachers */}
                      <div className="hidden lg:flex flex-col items-end min-w-[140px] max-w-[160px]">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Teachers</span>
                        <span className="text-xs font-semibold text-slate-500 text-right truncate w-full">
                          {teacherNames || "—"}
                        </span>
                      </div>

                      {/* Stats chips */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`px-2.5 py-1 rounded-lg ${cfg.light} border`}>
                          <span className={`text-xs font-black ${cfg.text}`}>{subject._count.lessons}</span>
                          <span className="text-[9px] font-bold text-slate-400 ml-1 uppercase">lessons</span>
                        </div>
                      </div>

                      {/* Admin actions — appear on hover */}
                      {role === "admin" && (
                        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
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

        {/* ── COLUMN LEGEND ── */}
        {subjects.length > 0 && (
          <div className="flex items-center gap-8 px-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
            <span className="w-8" />
            <div className="flex-1 grid grid-cols-3 gap-4">
              <span className="text-right">عربي</span>
              <span className="text-center">Français</span>
              <span>English</span>
            </div>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {subjects.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center py-24 gap-4 text-center shadow-sm">
            <span className="text-5xl">📚</span>
            <div>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wider mb-1">No Subjects Found</h3>
              <p className="text-xs font-semibold text-slate-400 max-w-xs mx-auto">
                {searchValue ? "Try a different search term." : "Click + Add Subject to get started."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectListPage;
