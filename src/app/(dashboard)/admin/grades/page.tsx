import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import GradeEntryForm from "./GradeEntryForm";

export default async function GradesPage({
  searchParams,
}: {
  searchParams: { classId?: string; term?: string };
}) {
  const role = await getRole();
  if (role !== "admin") return <div>Unauthorized</div>;

  const classId = searchParams.classId ? parseInt(searchParams.classId) : null;
  const term = searchParams.term ? parseInt(searchParams.term) : 1;

  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
  });

  const subjects = await prisma.subject.findMany({
    orderBy: { domain: "asc" },
  });

  let students: any[] = [];
  if (classId) {
    students = await prisma.student.findMany({
      where: { classId },
      include: {
        grades: {
          where: { term },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  return (
    <div className="p-6 flex flex-col gap-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">GRADE MANAGEMENT</h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Manual entry for academic reports</p>
        </div>
        
        <form className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Class</label>
            <select 
              name="classId" 
              defaultValue={classId || ""}
              className="bg-slate-50 border border-slate-100 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Academic Term</label>
            <select 
              name="term" 
              defaultValue={term}
              className="bg-slate-50 border border-slate-100 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
          </div>

          <button 
            type="submit"
            className="self-end px-6 py-2 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
          >
            LOAD STUDENTS
          </button>
        </form>
      </div>

      {!classId ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl opacity-50">📚</span>
            </div>
            <p className="text-slate-500 font-bold">Please select a class and term to start entering grades.</p>
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
