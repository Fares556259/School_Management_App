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
    <div className="relative p-8 flex flex-col items-center justify-center flex-1 bg-slate-50/30 min-h-[85vh] overflow-hidden rounded-[40px] m-4 border border-white shadow-2xl shadow-slate-200/50">
      {/* Animated Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-400/20 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-400/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-pink-400/20 blur-[100px] animate-pulse" style={{ animationDelay: '4s' }}></div>

      {/* Hero Section */}
      <div className="relative z-10 text-center max-w-2xl flex flex-col items-center gap-6 mb-16">
        <div className="relative group cursor-default">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-40 group-hover:opacity-70 transition-opacity duration-700 animate-pulse"></div>
          <div className="relative w-24 h-24 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] rotate-3 group-hover:rotate-12 transition-transform duration-700 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 ring-4 ring-white">
            <Sparkles size={40} className="stroke-[1.5px] -rotate-3 group-hover:-rotate-12 transition-transform duration-700" />
          </div>
        </div>
        
        <div className="mt-4">
          <h1 className="text-5xl md:text-[64px] font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 tracking-tight uppercase leading-[1.1] drop-shadow-sm">
            AI Scheduler<br/>Playground
          </h1>
          <p className="text-slate-500 text-sm md:text-base font-semibold mt-6 leading-relaxed max-w-lg mx-auto">
            Experience the future of academic planning. Generate, optimize, and safely draft conflict-free curriculums and exam periods in seconds.
          </p>
        </div>
      </div>

      {/* Choice workspace cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full px-4">
        {/* Card 1: Timetable Scheduler */}
        <Link 
          href="/admin/timetable/ai?type=timetable"
          className="group relative bg-white/70 backdrop-blur-2xl p-10 rounded-[32px] border border-white shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-2 active:scale-[0.98] transition-all duration-500 flex flex-col items-start text-left overflow-hidden"
        >
          {/* Hover Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 flex items-center justify-center text-indigo-600 shadow-inner border border-indigo-100/50 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
            <Calendar size={36} className="stroke-[1.5px]" />
          </div>

          <h2 className="relative z-10 text-2xl font-black text-slate-800 tracking-tight mt-8 group-hover:text-indigo-600 transition-colors duration-300">
            Weekly Timetables
          </h2>
          <p className="relative z-10 text-slate-500 text-sm font-medium leading-relaxed mt-4">
            Draft class lesson hours, assign teacher hours, prevent room double-bookings, and optimize subject distributions using advanced AI optimizations.
          </p>

          <div className="relative z-10 flex items-center gap-3 mt-10 text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-5 py-3 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shadow-sm border border-indigo-100/50 group-hover:border-transparent">
            Enter Workspace
            <ArrowRight size={16} className="stroke-[2.5px] group-hover:translate-x-1 transition-transform duration-300" />
          </div>
        </Link>

        {/* Card 2: Exam Scheduler */}
        <Link 
          href="/admin/timetable/ai?type=exam"
          className="group relative bg-white/70 backdrop-blur-2xl p-10 rounded-[32px] border border-white shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-pink-500/20 hover:-translate-y-2 active:scale-[0.98] transition-all duration-500 flex flex-col items-start text-left overflow-hidden"
        >
          {/* Hover Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50/50 flex items-center justify-center text-purple-600 shadow-inner border border-purple-100/50 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
            <ClipboardCheck size={36} className="stroke-[1.5px]" />
          </div>

          <h2 className="relative z-10 text-2xl font-black text-slate-800 tracking-tight mt-8 group-hover:text-purple-600 transition-colors duration-300">
            Exam Calendars
          </h2>
          <p className="relative z-10 text-slate-500 text-sm font-medium leading-relaxed mt-4">
            Schedule test blocks, midterms, and final exam grids safely in drafts before publishing them. Build balanced, stress-free assessment periods for students.
          </p>

          <div className="relative z-10 flex items-center gap-3 mt-10 text-xs font-black uppercase tracking-widest text-purple-600 bg-purple-50 px-5 py-3 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300 shadow-sm border border-purple-100/50 group-hover:border-transparent">
            Enter Workspace
            <ArrowRight size={16} className="stroke-[2.5px] group-hover:translate-x-1 transition-transform duration-300" />
          </div>
        </Link>
      </div>
    </div>
  );
};

export default AiTimetablePage;
