import prisma from "@/lib/prisma";
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
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">GRADE MANAGEMENT</h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Manual entry for academic reports</p>
        </div>
        <div className="flex items-center gap-3">
          <GradeFilter classes={classes} classId={classId} term={term} />
        </div>
      </div>


      {/* ─── GRADE SHEETS LIST ─── */}
      {sheets.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recorded Sheet{sheets.length !== 1 ? "s" : ""} — Term {term}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sheets.map((sheet) => {
              const isPdf = sheet.proofUrl.endsWith(".pdf");
              return (
                <div key={sheet.id} className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:shadow-slate-100 hover:border-indigo-100 transition-all flex">
                  {/* Proof thumbnail */}
                  <div className="w-20 flex-shrink-0 bg-slate-50 flex items-center justify-center border-r border-slate-100 text-2xl">
                    {isPdf ? "📄" : (
                      <img src={sheet.proofUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>

                  <div className="flex-1 p-4 flex flex-col justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-800 tracking-tight">{sheet.subject.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{sheet.class.name} · Term {sheet.term}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400">{sheet.grades.length} students graded</span>
                      {sheet.teacher && (
                        <span className="text-[10px] font-bold text-slate-400">{sheet.teacher.name}</span>
                      )}
                    </div>
                  </div>

                  {/* View proof link */}
                  <a
                    href={sheet.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-3 border-l border-slate-100 text-slate-300 hover:text-indigo-500 transition-colors"
                    title="View Proof"
                  >
                    ↗
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

