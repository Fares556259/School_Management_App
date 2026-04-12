import prisma from "../../../../lib/prisma";
import { getRole } from "@/lib/role";
import GradeEntryForm from "./GradeEntryForm";
import GradeFilter from "./GradeFilter";
import { getAllGradeSheets } from "./actions";
import Link from "next/link";

export default async function GradesPage({
  searchParams,
}: {
  searchParams: { classId?: string; term?: string };
}) {
  const role = await getRole();
  if (role !== "admin") return <div>Unauthorized</div>;

  const [classes, subjects, teachers] = await Promise.all([
    prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ orderBy: { domain: "asc" } }),
    prisma.teacher.findMany({ select: { id: true, name: true, surname: true }, orderBy: { name: "asc" } }),
  ]);

  const term = searchParams.term ? parseInt(searchParams.term) : 1;
  const classId = searchParams.classId
    ? parseInt(searchParams.classId)
    : classes.length > 0 ? classes[0].id : null;

  let students: any[] = [];
  if (classId) {
    students = await prisma.student.findMany({
      where: { classId },
      include: { grades: { where: { term } } },
      orderBy: { name: "asc" },
    });
  }

  const sheets = await getAllGradeSheets(classId ?? undefined, undefined, term);

  return (
    <div className="p-6 flex flex-col gap-8 bg-slate-50 min-h-screen">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
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
          students={students}
          subjects={subjects}
          term={term}
          classId={classId}
        />
      )}
    </div>
  );
}

