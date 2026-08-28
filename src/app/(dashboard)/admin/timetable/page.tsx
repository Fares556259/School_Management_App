export const dynamic = "force-dynamic";

import { getAllClasses, getAllSubjectsAndTeachers, getAllRooms, getAllActiveTimetableSlots } from "../actions/timetableActions";
import { getSchoolConfig } from "../actions/schoolActions";
import TimetableClient from "./TimetableClient";

const TimetablePage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  // Parallelize actions for fast page loads
  const [classesRes, subjectsTeachersRes, configRes, roomsRes, allSlotsRes] = await Promise.all([
    getAllClasses(),
    getAllSubjectsAndTeachers(),
    getSchoolConfig(),
    getAllRooms(),
    getAllActiveTimetableSlots(),
  ]);

  const classes = (classesRes.success ? classesRes.data : []) as any[];
  const subjects = (subjectsTeachersRes.success ? subjectsTeachersRes.subjects : []) as any[];
  const teachers = (subjectsTeachersRes.success ? subjectsTeachersRes.teachers : []) as any[];
  const rooms = (roomsRes.success ? roomsRes.data : []) as any[];
  const allActiveSlots = (allSlotsRes.success ? allSlotsRes.data : []) as any[];
  
  // Extract sessions from config
  const dayStartTime = configRes.success ? (configRes.data as any).dayStartTime || "08:00" : "08:00";
  const dayEndTime = configRes.success ? (configRes.data as any).dayEndTime || "18:00" : "18:00";

  return (
    <TimetableClient 
      classes={classes} 
      subjects={subjects} 
      teachers={teachers} 
      dayStartTime={dayStartTime}
      dayEndTime={dayEndTime}
      rooms={rooms}
      allActiveSlots={allActiveSlots}
    />
  );
};

export default TimetablePage;
