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

  // Determine Level Config for the selected class
  const selectedClass = classes.find((c: any) => c.id === classId);
  const levelNum = selectedClass?.level?.level;
  const levelConfig = levelNum ? LEVEL_CONFIGS[levelNum] : undefined;

  let subjects: any[] = [];

  if (levelConfig) {
    levelConfig.domains.forEach((domainConfig: any) => {
      domainConfig.subjects.forEach((sub: any) => {
        const searchTerm = sub.search.trim().toLowerCase();
        const dbSubject = rawSubjects.find((s: any) => {
          const parts = s.name.split('|').map((p: string) => p.trim().toLowerCase());
          return parts.includes(searchTerm) || s.name.toLowerCase() === searchTerm;
        });
        if (dbSubject) {
          subjects.push({
            ...dbSubject,
            domain: domainConfig.name,
            name: sub.display || dbSubject.name,
          });
        }
      });
    });
  } else {
    subjects = rawSubjects;
  }

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
          sheets={sheets}
        />
      )}
    </div>
  );
}
