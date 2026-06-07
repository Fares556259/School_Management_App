export const dynamic = "force-dynamic";

import { getAllClasses, getAllSubjectsAndTeachers, getAllRooms } from "../../actions/timetableActions";
import { getSchoolConfig } from "../../actions/schoolActions";
import { getRole } from "@/lib/role";
import TimetableClient from "../TimetableClient";
import ExamTimetableClient from "../../../list/exams/ExamTimetableClient";
import Link from "next/link";
import { Sparkles, ClipboardCheck, ArrowRight, Calendar } from "lucide-react";
import AISchedulerWrapper from "./components/AISchedulerWrapper";
import AiPlaygroundLanding from "./components/AiPlaygroundLanding";

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
      <AiPlaygroundLanding />
    </AISchedulerWrapper>
  );
};

export default AiTimetablePage;
