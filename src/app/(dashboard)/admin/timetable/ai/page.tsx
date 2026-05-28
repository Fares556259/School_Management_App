export const dynamic = "force-dynamic";

import { getAllClasses, getAllSubjectsAndTeachers, getAllRooms } from "../../actions/timetableActions";
import { getSchoolConfig } from "../../actions/schoolActions";
import { getRole } from "@/lib/role";
import TimetableClient from "../TimetableClient";
import ExamTimetableClient from "../../../list/exams/ExamTimetableClient";
import Link from "next/link";
import { Sparkles, ClipboardCheck, ArrowRight, Calendar } from "lucide-react";

const AiTimetablePage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  // Sequentialize actions to reduce connection pool pressure
  const classesRes = await getAllClasses();
  const subjectsTeachersRes = await getAllSubjectsAndTeachers();
  const configRes = await getSchoolConfig();
  const roomsRes = await getAllRooms();
  const role = await getRole();

  const classes = (classesRes.success ? classesRes.data : []) as any[];
  const subjects = (subjectsTeachersRes.success ? subjectsTeachersRes.subjects : []) as any[];
  const teachers = (subjectsTeachersRes.success ? subjectsTeachersRes.teachers : []) as any[];
  const rooms = (roomsRes.success ? roomsRes.data : []) as any[];
  
  // Extract sessions from config
  let sessions = configRes.success ? (configRes.data as any).sessions : [];
  if (typeof sessions === 'string') {
    try { sessions = JSON.parse(sessions); } catch (e) { sessions = []; }
  }

  const { type } = searchParams;

  if (type === "timetable") {
    return (
      <TimetableClient 
        classes={classes} 
        subjects={subjects} 
        teachers={teachers} 
        sessions={sessions}
        rooms={rooms}
        forceDraft={true}
      />
    );
  }

  if (type === "exam") {
    return (
      <ExamTimetableClient 
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        rooms={rooms}
        role={role!}
        forceDraft={true}
      />
    );
  }

  // Render a gorgeous selection workspace portal
  return (
    <div className="p-8 flex flex-col items-center justify-center flex-1 bg-slate-50/50 min-h-[80vh] gap-12">
      {/* Title block */}
      <div className="text-center max-w-xl flex flex-col items-center gap-3">
        <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 ring-8 ring-indigo-50/50 animate-pulse">
          <Sparkles size={28} className="stroke-[2px]" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none mt-4">
          AI Scheduler Playground
        </h1>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed mt-2">
          Plan, generate, and optimize conflict-free curriculum drafts for classes and assessment periods.
        </p>
      </div>

      {/* Choice workspace cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        {/* Card 1: Timetable Scheduler */}
        <Link 
          href="/admin/timetable/ai?type=timetable"
          className="group bg-white p-8 rounded-[40px] border border-slate-100 shadow-lg shadow-slate-100/50 hover:shadow-2xl hover:shadow-indigo-100/80 hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 flex flex-col items-start text-left relative overflow-hidden"
        >
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full group-hover:scale-150 transition-all duration-300"></div>
          
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
            <Calendar size={26} className="stroke-[2.2px]" />
          </div>

          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase mt-8 group-hover:text-indigo-600 transition-colors">
            Weekly Timetables
          </h2>
          <p className="text-slate-500 text-xs font-medium leading-relaxed mt-3">
            Draft class lesson hours, assign teacher hours, prevent room double-bookings, and optimize subject distributions using advanced AI optimizations.
          </p>

          <div className="flex items-center gap-2 mt-8 text-[10px] font-black uppercase tracking-widest text-indigo-600 group-hover:gap-3 transition-all">
            Enter Workspace
            <ArrowRight size={14} className="stroke-[3px]" />
          </div>
        </Link>

        {/* Card 2: Exam Scheduler */}
        <Link 
          href="/admin/timetable/ai?type=exam"
          className="group bg-white p-8 rounded-[40px] border border-slate-100 shadow-lg shadow-slate-100/50 hover:shadow-2xl hover:shadow-purple-100/80 hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 flex flex-col items-start text-left relative overflow-hidden"
        >
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full group-hover:scale-150 transition-all duration-300"></div>

          <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm border border-purple-100 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
            <ClipboardCheck size={26} className="stroke-[2.2px]" />
          </div>

          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase mt-8 group-hover:text-purple-600 transition-colors">
            Exam Calendars
          </h2>
          <p className="text-slate-500 text-xs font-medium leading-relaxed mt-3">
            Schedule test blocks, midterms, and final exam grids safely in drafts before publishing them. Build balanced, stress-free assessment periods for students.
          </p>

          <div className="flex items-center gap-2 mt-8 text-[10px] font-black uppercase tracking-widest text-purple-600 group-hover:gap-3 transition-all">
            Enter Workspace
            <ArrowRight size={14} className="stroke-[3px]" />
          </div>
        </Link>
      </div>
    </div>
  );
};

export default AiTimetablePage;
