import prisma from "../../../../lib/prisma";
import { getRole } from "@/lib/role";
import { getSchoolId } from "@/lib/school";
import GradeEntryForm from "./GradeEntryForm";
import GradeFilter from "./GradeFilter";
import { getAllGradeSheets } from "./actions";
import Link from "next/link";
import { LEVEL_CONFIGS } from "@/lib/report-cards/level-config";

export default async function GradesPage({
  searchParams,
}: {
  searchParams: { classId?: string; term?: string };
}) {
  const role = await getRole();
  if (role !== "admin") return <div>Unauthorized</div>;

  const schoolId = await getSchoolId();

  const [classes, rawSubjects, teachers] = await Promise.all([
    prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true, level: true }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ where: { schoolId }, orderBy: { domain: "asc" } }),
    prisma.teacher.findMany({ where: { schoolId }, select: { id: true, name: true, surname: true }, orderBy: { name: "asc" } }),
  ]);

  const term = searchParams.term ? parseInt(searchParams.term) : 1;
  const classId = searchParams.classId
    ? parseInt(searchParams.classId)
    : classes.length > 0 ? classes[0].id : null;

  let students: any[] = [];
  let sheets: any[] = [];

  [students, sheets] = await Promise.all([
    classId
      ? prisma.student.findMany({
          where: { classId, schoolId },
          include: { grades: { where: { term } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    getAllGradeSheets(classId ?? undefined, undefined, term),
  ]);

  // Determine Level Config for the selected class
  const selectedClass = classes.find((c) => c.id === classId);
  const levelNum = selectedClass?.level?.level;
  const levelConfig = levelNum ? LEVEL_CONFIGS[levelNum] : undefined;

  let subjects: any[] = [];

  if (levelConfig) {
    // Transform subjects according to the Level Config
    levelConfig.domains.forEach(domainConfig => {
      domainConfig.subjects.forEach(sub => {
        const dbSubject = rawSubjects.find(s => s.name.includes(sub.search.trim()));
        if (dbSubject) {
          subjects.push({
            ...dbSubject,
            domain: domainConfig.name, // Override with exactly what the user wants!
            name: sub.display || dbSubject.name, // Use the display name!
          });
        }
      });
    });
  } else {
    subjects = rawSubjects;
  }

  return (
    <div className="p-6 flex flex-col gap-8 bg-slate-50 min-h-screen">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Bulletins & Saisie des Notes
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Évaluez les compétences par matière et générez les bulletins officiels en temps réel.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GradeFilter classes={classes} classId={classId} term={term} />
        </div>
      </div>



      {/* ─── GRADE ENTRY FORM ─── */}
      {!classId ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl opacity-50">📚</span>
          </div>
          <p className="text-slate-500 font-bold">No classes available.</p>
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

