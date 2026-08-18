import prisma from "../../../../lib/prisma";
import { getRole } from "@/lib/role";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import GradeEntryForm from "./GradeEntryForm";
import GradeFilter from "./GradeFilter";
import { getAllGradeSheets } from "./actions";
import Link from "next/link";
import { LEVEL_CONFIGS } from "@/lib/report-cards/level-config";
import { GraduationCap } from "lucide-react";

export default async function GradesPage({
  searchParams,
}: {
  searchParams: { classId?: string; term?: string };
}) {
  const role = await getRole();
  if (role !== "admin") return <div>Unauthorized</div>;

  const schoolId = await getSchoolId();

  const term = searchParams.term ? parseInt(searchParams.term) : 1;

  // Cache base lists (classes, subjects, teachers) — less volatile
  const [classes, rawSubjects, teachers] = await getCachedTenantData(
    schoolId,
    "exams",
    ["grades-base", schoolId],
    () => Promise.all([
      prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true, level: true }, orderBy: { name: "asc" } }),
      prisma.subject.findMany({ where: { schoolId }, orderBy: { domain: "asc" } }),
      prisma.teacher.findMany({ where: { schoolId }, select: { id: true, name: true, surname: true }, orderBy: { name: "asc" } }),
    ]),
    300
  );

  const classId = searchParams.classId
    ? parseInt(searchParams.classId)
    : classes.length > 0 ? classes[0].id : null;

  // Cache student grades & sheets per class+term — shorter TTL as grades change often
  let students: any[] = [];
  let sheets: any[] = [];

  if (classId) {
    [students, sheets] = await getCachedTenantData(
      schoolId,
      "exams",
      ["grades-entries", classId, term, schoolId],
      () => Promise.all([
        prisma.student.findMany({
          where: { classId, schoolId },
          include: { grades: { where: { term } } },
          orderBy: { name: "asc" },
        }),
        getAllGradeSheets(classId, undefined, term),
      ]),
      60 // 1-minute TTL — grade data is actively being entered
    );
  }

  // Helper to normalize domain name for standard Tunisian primary school reports
  const normalizeSubjectDomain = (domain: string, subjectName: string): string => {
    const n = subjectName.toLowerCase();
    if (
      n.includes("عربية") || n.includes("arabe") || n.includes("arabic") ||
      n.includes("تواصل") || n.includes("شفوي") || n.includes("خط") ||
      n.includes("قراءة") || n.includes("إنتاج") || n.includes("انتاج") ||
      n.includes("قواعد") || n.includes("املاء") || n.includes("إملاء")
    ) {
      if (n.includes("فرنسية") || n.includes("french") || n.includes("français")) {
        return "اللغة الفرنسية";
      }
      return "مجال العربية";
    }
    if (
      n.includes("فرنسية") || n.includes("french") || n.includes("français") ||
      n.includes("lecture") || n.includes("ecrite") || n.includes("orale") ||
      n.includes("orthographe") || n.includes("grammaire")
    ) {
      return "اللغة الفرنسية";
    }
    if (n.includes("anglais") || n.includes("english") || n.includes("إنجليزية") || n.includes("انجليزية")) {
      return "اللغات الأجنبية";
    }
    if (
      n.includes("رياضيات") || n.includes("math") ||
      n.includes("إيقاظ") || n.includes("ايقاظ") || n.includes("science") ||
      n.includes("تكنولوج") || n.includes("techno")
    ) {
      return "مجال العلوم";
    }
    if (
      n.includes("إسلام") || n.includes("اسلام") || n.includes("islam") ||
      n.includes("مدنية") || n.includes("civic") ||
      n.includes("تاريخ") || n.includes("history") ||
      n.includes("جغرافيا") || n.includes("geography") ||
      n.includes("موسيق") || n.includes("music") ||
      n.includes("تشكيل") || n.includes("art") ||
      n.includes("بدني") || n.includes("sport") || n.includes("physique")
    ) {
      return "مجال التنشئة";
    }
    if (domain === "Languages") return "مجال العربية";
    if (domain === "Sciences") return "مجال العلوم";
    if (domain === "Religion & Values" || domain === "Humanities" || domain === "Arts & Technology" || domain === "Sport") return "مجال التنشئة";
    return domain || "General";
  };

  // Ensure ALL database subjects are preserved with proper domains
  const subjects = rawSubjects.map((s: any) => ({
    ...s,
    domain: normalizeSubjectDomain(s.domain || "", s.name || ""),
  }));

  // Calculate class completion for the filter bar
  const gradeableCount = subjects.filter((s: any) => !s.parentId).length;
  const studentsComplete = students.filter((s: any) =>
    s.grades.length === gradeableCount && gradeableCount > 0
  ).length;

  return (
    <div className="p-6 flex flex-col gap-6 bg-slate-50 min-h-screen">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Bulletins & Saisie des Notes
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Évaluez les compétences par matière et générez les bulletins officiels.
          </p>
        </div>
        <GradeFilter
          classes={classes}
          classId={classId}
          term={term}
          studentsTotal={students.length}
          studentsComplete={studentsComplete}
        />
      </div>

      {/* ─── GRADE ENTRY FORM ─── */}
      {!classId ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-5 text-slate-400">
            <GraduationCap size={36} />
          </div>
          <p className="text-slate-600 font-bold text-lg mb-1">Aucune classe disponible</p>
          <p className="text-slate-400 text-sm">Créez une classe pour commencer la saisie des notes.</p>
        </div>
      ) : (
        <GradeEntryForm
          key={`${classId}-${term}`}
          students={students}
          subjects={subjects}
          term={term}
          classId={classId}
        />
      )}
    </div>
  );
}
