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
      <AISchedulerWrapper>
        <TimetableClient 
          classes={classes} 
          subjects={subjects} 
          teachers={teachers} 
          sessions={sessions}
          rooms={rooms}
          forceDraft={true}
        />
      </AISchedulerWrapper>
    );
  }

  if (type === "exam") {
    return (
      <AISchedulerWrapper>
        <ExamTimetableClient 
          classes={classes}
          subjects={subjects}
          teachers={teachers}
          rooms={rooms}
          role={role!}
          forceDraft={true}
        />
      </AISchedulerWrapper>
    );
  }

  // Render editorial workflow-software interface (Airtable-style)
  return (
    <AISchedulerWrapper>
      <div className="flex flex-col items-center justify-center w-full min-h-[calc(100vh-60px)] bg-white selection:bg-[#1b61c9] selection:text-white font-sans overflow-y-auto py-8">
        
        {/* Hero Band */}
        <div className="w-full max-w-[1280px] px-12 pb-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-[#181d26] rounded-full flex items-center justify-center text-white mb-6">
            <Sparkles size={20} className="stroke-[2px]" />
          </div>
          
          <h1 className="text-[32px] md:text-[40px] font-normal text-[#181d26] leading-[1.1] tracking-normal max-w-3xl">
            AI Scheduler Playground
          </h1>
          
          <p className="text-[16px] font-medium text-[#41454d] mt-4 max-w-2xl leading-[1.4]">
            Plan, generate, and optimize conflict-free curriculum drafts for classes and assessment periods in a secure sandbox.
          </p>
        </div>

        {/* Workspace Cards Grid */}
        <div className="w-full max-w-[1280px] px-12 pb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Timetable Scheduler (Signature Cream) */}
          <div className="flex flex-col bg-[#f5e9d4] rounded-[12px] p-8 md:p-10 h-full relative group">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#181d26] mb-6 shadow-sm">
              <Calendar size={20} className="stroke-[2px]" />
            </div>

            <h2 className="text-[24px] md:text-[28px] font-normal text-[#181d26] leading-[1.2] mb-3">
              Weekly Timetables
            </h2>
            
            <p className="text-[16px] font-medium text-[#333840] leading-[1.4] mb-8 flex-grow max-w-[400px]">
              Draft class lesson hours, assign teacher hours, prevent room double-bookings, and optimize subject distributions.
            </p>

            <Link 
              href="/admin/timetable/ai?type=timetable"
              className="inline-flex items-center justify-center gap-2 bg-[#181d26] hover:bg-[#0d1218] text-white text-[16px] font-medium rounded-[12px] px-6 py-4 transition-colors w-max"
            >
              Enter Workspace
              <ArrowRight size={18} className="stroke-[2px]" />
            </Link>
          </div>

          {/* Card 2: Exam Scheduler (Signature Mint) */}
          <div className="flex flex-col bg-[#a8d8c4] rounded-[12px] p-8 md:p-10 h-full relative group">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#181d26] mb-6 shadow-sm">
              <ClipboardCheck size={20} className="stroke-[2px]" />
            </div>

            <h2 className="text-[24px] md:text-[28px] font-normal text-[#181d26] leading-[1.2] mb-3">
              Exam Calendars
            </h2>
            
            <p className="text-[16px] font-medium text-[#333840] leading-[1.4] mb-8 flex-grow max-w-[400px]">
              Schedule test blocks, midterms, and final exam grids safely in drafts before publishing them. Build balanced assessment periods.
            </p>

            <Link 
              href="/admin/timetable/ai?type=exam"
              className="inline-flex items-center justify-center gap-2 bg-[#181d26] hover:bg-[#0d1218] text-white text-[16px] font-medium rounded-[12px] px-6 py-4 transition-colors w-max"
            >
              Enter Workspace
              <ArrowRight size={18} className="stroke-[2px]" />
            </Link>
          </div>

        </div>
      </div>
    </AISchedulerWrapper>
  );
};

export default AiTimetablePage;
