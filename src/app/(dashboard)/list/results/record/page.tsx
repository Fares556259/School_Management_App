import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import GradeSheetRecorder from "../../../admin/grades/GradeSheetRecorder";
import { redirect } from "next/navigation";

export default async function RecordResultsPage() {
  const role = await getRole();
  if (role !== "admin" && role !== "teacher") {
    redirect("/list/results");
  }

  const [classes, subjects, teachers] = await Promise.all([
    prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ orderBy: { domain: "asc" } }),
    prisma.teacher.findMany({ select: { id: true, name: true, surname: true }, orderBy: { name: "asc" } }),
  ]);

  // For the recorder, we need a list of students for the first class by default
  const defaultClassId = classes.length > 0 ? classes[0].id : null;
  const students = defaultClassId 
    ? await prisma.student.findMany({ where: { classId: defaultClassId }, orderBy: { name: "asc" } })
    : [];

  return (
    <div className="flex-1 bg-white min-h-screen">
      <GradeSheetRecorder
        students={students}
        subjects={subjects}
        classes={classes}
        teachers={teachers}
        initialClassId={defaultClassId ?? undefined}
        onCloseRedirect="/list/results"
      />
    </div>
  );
}
