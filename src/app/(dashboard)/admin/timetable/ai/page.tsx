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
    <div className="relative flex flex-col items-center justify-center flex-1 w-full bg-[#f8fafc] overflow-hidden min-h-[calc(100vh-60px)]">
      {/* Subtle Animated Background Gradients */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-200/40 rounded-full blur-[100px] opacity-60 animate-pulse mix-blend-multiply" style={{ animationDuration: '4s' }}></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-200/40 rounded-full blur-[100px] opacity-60 animate-pulse mix-blend-multiply" style={{ animationDuration: '6s' }}></div>

      <div className="relative z-10 flex flex-col items-center max-w-5xl w-full px-6 py-12">
        {/* Header Section */}
        <div className="text-center flex flex-col items-center gap-4 mb-14">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-md shadow-indigo-100/50 border border-slate-100 ring-4 ring-white">
            <Sparkles size={24} className="stroke-[2px]" />
          </div>
          
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight mt-2">
              AI Scheduler Playground
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-3 max-w-lg mx-auto leading-relaxed">
              Plan, generate, and optimize conflict-free curriculum drafts for classes and assessment periods in a secure sandbox.
            </p>
          </div>
        </div>

        {/* Workspace Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* Card 1: Timetable Scheduler */}
          <Link 
            href="/admin/timetable/ai?type=timetable"
            className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 hover:-translate-y-1 active:scale-[0.99] transition-all duration-300 flex flex-col overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-125 transition-transform duration-500"></div>
            
            <div className="relative z-10 w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
              <Calendar size={22} className="stroke-[2px]" />
            </div>

            <h2 className="relative z-10 text-lg font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors duration-300">
              Weekly Timetables
            </h2>
            <p className="relative z-10 text-slate-500 text-xs font-medium leading-relaxed mt-2 flex-grow">
              Draft class lesson hours, assign teacher hours, prevent room double-bookings, and optimize subject distributions.
            </p>

            <div className="relative z-10 flex items-center gap-2 mt-6 text-[11px] font-bold uppercase tracking-wider text-indigo-600 group-hover:gap-3 transition-all">
              Enter Workspace
              <ArrowRight size={14} className="stroke-[2.5px]" />
            </div>
          </Link>

          {/* Card 2: Exam Scheduler */}
          <Link 
            href="/admin/timetable/ai?type=exam"
            className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-purple-100/50 hover:-translate-y-1 active:scale-[0.99] transition-all duration-300 flex flex-col overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-125 transition-transform duration-500"></div>

            <div className="relative z-10 w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
              <ClipboardCheck size={22} className="stroke-[2px]" />
            </div>

            <h2 className="relative z-10 text-lg font-bold text-slate-800 tracking-tight group-hover:text-purple-600 transition-colors duration-300">
              Exam Calendars
            </h2>
            <p className="relative z-10 text-slate-500 text-xs font-medium leading-relaxed mt-2 flex-grow">
              Schedule test blocks, midterms, and final exam grids safely in drafts before publishing them. Build balanced assessment periods.
            </p>

            <div className="relative z-10 flex items-center gap-2 mt-6 text-[11px] font-bold uppercase tracking-wider text-purple-600 group-hover:gap-3 transition-all">
              Enter Workspace
              <ArrowRight size={14} className="stroke-[2.5px]" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AiTimetablePage;
