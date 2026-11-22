import { getRole } from "@/lib/role";
import CrudFormModal from "@/components/CrudFormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import { schoolWorkspaceCopy } from "@/lib/schoolWorkspaceCopy";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Class, Teacher, Level, Prisma } from "@prisma/client";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import Link from "next/link";
import { Users, Search, RotateCcw, Plus, Edit2, Trash2, GraduationCap } from "lucide-react";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";

type ClassList = Class & { level: Level } & {
  _count: { students: number };
} & {
  lessons: { teacher: { id: string; name: string; surname: string; img: string | null } }[];
};

const ClassListPage = async (
  props: {
    searchParams?: Promise<{ [key: string]: string | undefined }>;
  }
) => {
  const searchParams = await props.searchParams;
  const cookieLang = (await cookies()).get("NEXT_LOCALE")?.value || "en";
  const lang = (cookieLang.startsWith("ar") ? "ar" : cookieLang.startsWith("fr") ? "fr" : "en") as Locale;
  const t = translations[lang] || translations.fr || translations.en;
  const copy = schoolWorkspaceCopy[lang];

  const columns = [
    {
      header: t.classes.className,
      accessor: "name",
    },
    {
      header: t.classes.studentCount,
      accessor: "studentCount",
      className: "hidden md:table-cell",
    },
    {
      header: t.classes.level,
      accessor: "level",
      className: "hidden md:table-cell",
    },
    {
      header: t.classes.teachers,
      accessor: "teachers",
      className: "hidden md:table-cell",
    },
    {
      header: t.classes.actions,
      accessor: "action",
      className: "text-right",
    },
  ];

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const userId = user?.id;
  const role = await getRole();
  const safeSearchParams = searchParams || {};
  const { page, ...queryParams } = safeSearchParams;
  const p = Math.max(1, Number.parseInt(page || "1", 10) || 1);

  const schoolId = await getSchoolId();

  // URL QUERY PARAMS CONDITION
  const query: Prisma.ClassWhereInput = { schoolId };

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "supervisorId":
            // supervisor is removed, maybe keep query logic if used elsewhere but we don't have supervisorId on Class anymore? 
            // Wait, Class still has supervisorId in schema, but we don't show it here.
            query.supervisorId = value;
            break;
          case "levelId":
            if (/^\d+$/.test(value)) query.levelId = parseInt(value);
            break;
          case "search":
            query.name = { contains: value, mode: "insensitive" };
            break;
          default:
            break;
        }
      }
    }
  }

  const renderRow = (item: ClassList) => (
    <tr
      key={item.id}
      className="border-b border-[#dddddd] text-[15px] text-[#41454d] hover:bg-[#f8fafc] transition-colors group"
    >
      <td className="py-4 px-6">
        <span className="font-medium text-[#181d26]">{item.name}</span>
      </td>
      <td className="hidden md:table-cell py-4 px-6">
        <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-blue-50 px-2.5 py-1 text-[13px] font-semibold text-blue-700">
          {item._count.students}
        </span>
      </td>
      <td className="hidden md:table-cell py-4 px-6">
        {item.level?.level === 0 ? (lang === 'ar' ? 'تحضيري' : 'Préscolaire (تحضيري)') : item.level?.level}
      </td>
      <td className="hidden md:table-cell py-4 px-6">
        <div className="flex flex-wrap gap-1">
          {Array.from(new Map(item.lessons.filter(l => l.teacher).map(l => [l.teacher.id, l.teacher])).values()).map((teacher) => (
            <div key={teacher.id} className="flex items-center gap-1.5 bg-[#f8fafc] border border-[#dddddd] px-2 py-1 rounded-md" title={`${teacher.name} ${teacher.surname}`}>
              {teacher.img ? (
                <img src={teacher.img} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#1b61c9] text-white flex items-center justify-center text-[10px] font-bold">
                  {teacher.name[0]}{teacher.surname[0]}
                </div>
              )}
              <span className="text-[12px] font-medium text-[#41454d] truncate max-w-[80px]">
                {teacher.name} {teacher.surname?.[0]}.
              </span>
            </div>
          ))}
          {item.lessons.length === 0 && <span className="text-[#9297a0] text-[13px]">-</span>}
        </div>
      </td>
      <td className="py-4 px-6">
        <div className="flex items-center justify-end gap-3">
          {role === "admin" && (
            <>
              <div className="flex items-center gap-2">
                <Link 
                  href={`/list/classes/${item.id}`}
                  className="flex items-center gap-1.5 bg-white border border-[#dddddd] text-[#181d26] px-3 py-1.5 rounded-full text-[13px] font-medium hover:bg-slate-50 hover:shadow-sm transition-all"
                >
                  <Users size={14} />
                  <span>{t.classes.viewStudents}</span>
                </Link>
                <Link 
                  href={`/list/classes/${item.id}/teachers`}
                  className="flex items-center gap-1.5 bg-white border border-[#dddddd] text-[#181d26] px-3 py-1.5 rounded-full text-[13px] font-medium hover:bg-slate-50 hover:shadow-sm transition-all"
                >
                  <GraduationCap size={14} />
                  <span>{t.classes.viewTeachers}</span>
                </Link>
              </div>
              <CrudFormModal 
                entity="class" 
                mode="update" 
                data={item} 
                id={item.id} 
                relatedData={classRelatedData} 
                trigger={
                  <button aria-label={`${lang === "ar" ? "تعديل" : lang === "fr" ? "Modifier" : "Edit"} ${item.name}`} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#dddddd] text-[#41454d] hover:bg-slate-50 transition-colors">
                    <Edit2 size={14} />
                  </button>
                }
              />
              <CrudFormModal 
                entity="class" 
                mode="delete" 
                id={item.id} 
                trigger={
                  <button aria-label={`${lang === "ar" ? "حذف" : lang === "fr" ? "Supprimer" : "Delete"} ${item.name}`} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#dddddd] text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors">
                    <Trash2 size={14} />
                  </button>
                }
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  // 1. Static reference data for class modals (levels & teachers, TTL: 1 hour / 3600s)
  const fetchStaticReferences = () =>
    Promise.all([
      prisma.level.findMany({ 
        where: { schoolId }, 
        select: { 
          id: true, 
          level: true, 
          variations: true,
          classes: {
            select: {
              name: true
            }
          }
        },
        orderBy: { level: 'asc' }
      }),
      prisma.teacher.findMany({ where: { schoolId }, select: { id: true, name: true, surname: true } }),
    ]);

  // 2. Dynamic paginated class data (TTL: 5 min / 300s)
  const fetchDynamicData = () =>
    Promise.all([
      prisma.class.findMany({
        where: query,
        include: {
          lessons: {
            select: {
              teacher: {
                select: {
                  id: true,
                  name: true,
                  surname: true,
                  img: true,
                }
              }
            }
          },
          level: true,
          _count: {
            select: {
              students: true,
            },
          },
        },
        orderBy: [
          { level: { level: 'asc' } },
          { name: 'asc' }
        ],
        take: ITEM_PER_PAGE,
        skip: ITEM_PER_PAGE * (p - 1),
      }),
      prisma.class.count({ where: query }),
    ]);

  let levels: any[] = [];
  let teachers: any[] = [];
  let data: any[] = [];
  let count: number = 0;

  try {
    const staticRefPromise = getCachedTenantData(
      schoolId,
      'classes',
      ['class_modal_references'],
      fetchStaticReferences,
      3600
    );

    const [staticRes, dynamicRes] = await Promise.all([
      staticRefPromise.catch(() => fetchStaticReferences()),
      getCachedTenantData(
        schoolId,
        "classes",
        ["dynamic", String(p), JSON.stringify(queryParams)],
        fetchDynamicData,
        60
      ).catch(() => fetchDynamicData()),
    ]);

    if (Array.isArray(staticRes) && staticRes.length >= 2) {
      [levels, teachers] = staticRes;
    } else {
      [levels, teachers] = await fetchStaticReferences();
    }

    if (Array.isArray(dynamicRes) && dynamicRes.length >= 2) {
      [data, count] = dynamicRes;
    } else {
      [data, count] = await fetchDynamicData();
    }
  } catch (err) {
    console.error("[ClassListPage] Error fetching classes data, falling back:", err);
    try {
      const [staticRes, dynamicRes] = await Promise.all([
        fetchStaticReferences(),
        fetchDynamicData(),
      ]);
      [levels, teachers] = staticRes;
      [data, count] = dynamicRes;
    } catch (dbErr) {
      console.error("[ClassListPage] Direct DB fallback failed:", dbErr);
    }
  }

  const safeLevels = Array.isArray(levels) ? levels : [];
  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const safeData = Array.isArray(data) ? data : [];
  const safeCount = typeof count === "number" ? count : safeData.length;

  const availableClassNames: { value: string; label: string }[] = [];
  const ARABIC_LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن", "س", "ع", "ف", "ص", "ق", "ر", "ش", "ت", "ث", "خ", "ذ", "ض", "ظ", "غ"];
  safeLevels.forEach((l) => {
    const existingNames = Array.isArray(l.classes) ? l.classes.map((c: any) => c.name) : [];
    const count = (l.level === 0 && l.variations === 0 && existingNames.length === 0) ? 1 : (l.variations || 0);
    for (let i = 0; i < count; i++) {
      const name = l.level === 0
        ? `تحضيري ${ARABIC_LETTERS[i] || String.fromCharCode(65 + i)}`
        : `${l.level}${String.fromCharCode(65 + i)}`;
      if (!existingNames.includes(name)) {
        availableClassNames.push({ value: name, label: name });
      }
    }
  });

  const classRelatedData = {
    name: availableClassNames,
    teachers: safeTeachers.map((t: any) => ({ value: t.id, label: `${t.name} ${t.surname || ''}`.trim() })),
    levels: safeLevels.map((l: any) => ({ value: l.id.toString(), label: l.level.toString() })),
  };


  return (
  <div className="school-class-list">
    <section className="school-panel school-search-panel" aria-labelledby="class-search-title">
      <h2 id="class-search-title" className="school-panel-heading">{copy.searchOptions}</h2>
      <form action="/list/classes" className="school-panel-body">
        {queryParams.supervisorId && <input type="hidden" name="supervisorId" value={queryParams.supervisorId} />}
        <div className="school-search-grid">
          <label className="school-field">{copy.className}<input name="search" defaultValue={queryParams.search || ""} /></label>
          <label className="school-field">{copy.level}
            <select name="levelId" defaultValue={queryParams.levelId || ""}>
              <option value="">{copy.allLevels}</option>
              {safeLevels.map(level => <option key={level.id} value={level.id}>{level.level === 0 ? (lang === "ar" ? "تحضيري" : lang === "fr" ? "Préscolaire" : "Preschool") : `${copy.level} ${level.level}`}</option>)}
            </select>
          </label>
        </div>
        <div className="school-search-actions">
          <button className="school-action" type="submit"><Search size={15} />{copy.search}</button>
          <Link href="/list/classes" className="school-action school-action-secondary"><RotateCcw size={15} />{copy.reset}</Link>
        </div>
      </form>
    </section>
    <p className="text-xs text-slate-500">{copy.levelHint}</p>
    <nav aria-label={copy.level} className="school-levels">
      <Link href="/list/classes" className="school-level-link" aria-current={!query.levelId ? "page" : undefined}>{copy.allLevels}</Link>
      {safeLevels.map(level => <Link key={level.id} href={`/list/classes?levelId=${level.id}`} className="school-level-link" aria-current={query.levelId === level.id ? "page" : undefined}>{level.level === 0 ? (lang === "ar" ? "تحضيري" : lang === "fr" ? "Préscolaire" : "Preschool") : `${copy.level} ${level.level}`}</Link>)}
    </nav>
    <section className="school-panel" aria-labelledby="class-list-title">
      <div className="school-panel-heading">
        <h2 id="class-list-title">{copy.classList} · {safeCount}</h2>
        {role === "admin" && <CrudFormModal entity="class" mode="create" relatedData={classRelatedData} trigger={<button className="inline-flex items-center gap-2 rounded border border-white/40 px-3 py-1 text-xs hover:bg-white/10"><Plus size={15}/>{t.classes.addClass}</button>} />}
      </div>
      <Table columns={columns} renderRow={renderRow} data={safeData} emptyState={lang === "ar" ? "لا توجد أقسام مطابقة" : lang === "fr" ? "Aucune classe trouvée" : "No classes found"} />
      <div className="px-4 pb-3"><Pagination page={p} count={safeCount} /></div>
    </section>
  </div>
);
};

export default ClassListPage;
