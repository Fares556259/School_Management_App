import { getAllClasses, getAllSubjectsAndTeachers } from "../actions/timetableActions";
import TimetableClient from "./TimetableClient";

const TimetablePage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const classesRes = await getAllClasses();
  const classes = (classesRes.success ? classesRes.data : []) as any[];
  
  const subjectsTeachersRes = await getAllSubjectsAndTeachers();
  const subjects = (subjectsTeachersRes.success ? subjectsTeachersRes.subjects : []) as any[];
  const teachers = (subjectsTeachersRes.success ? subjectsTeachersRes.teachers : []) as any[];

  return (
    <TimetableClient 
      classes={classes} 
      subjects={subjects} 
      teachers={teachers} 
    />
  );
};

export default TimetablePage;
