import { getAllClasses, getAllSubjectsAndTeachers } from "../actions/timetableActions";
import { getSchoolConfig } from "../actions/schoolActions";
import TimetableClient from "./TimetableClient";

const TimetablePage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const [classesRes, subjectsTeachersRes, configRes] = await Promise.all([
    getAllClasses(),
    getAllSubjectsAndTeachers(),
    getSchoolConfig()
  ]);

  const classes = (classesRes.success ? classesRes.data : []) as any[];
  const subjects = (subjectsTeachersRes.success ? subjectsTeachersRes.subjects : []) as any[];
  const teachers = (subjectsTeachersRes.success ? subjectsTeachersRes.teachers : []) as any[];
  
  // Extract sessions from config
  let sessions = configRes.success ? (configRes.data as any).sessions : [];
  if (typeof sessions === 'string') {
    try { sessions = JSON.parse(sessions); } catch (e) { sessions = []; }
  }

  return (
    <TimetableClient 
      classes={classes} 
      subjects={subjects} 
      teachers={teachers} 
      sessions={sessions}
    />
  );
};

export default TimetablePage;
