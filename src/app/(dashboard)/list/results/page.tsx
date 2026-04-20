import { getRole } from "@/lib/role";
import { auth } from "@clerk/nextjs/server";
import prisma from "../../../../lib/prisma";
import ResultsPageClient from "./ResultsPageClient";

const ResultListPage = async () => {
  const { userId } = auth();
  const role = await getRole();

  // 🐘 V3 Stabilization: Serialize queries to avoid pool contention during heavy operations
  const classesRaw = await prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  
  // Hard-filter any placeholder "all" classes immediately
  const classes = classesRaw.filter(c => String(c.id).toLowerCase() !== "all" && c.name.toLowerCase() !== "all classes");

  const subjects = await prisma.subject.findMany({ orderBy: { domain: "asc" } });
  const teachers = await prisma.teacher.findMany({ select: { id: true, name: true, surname: true }, orderBy: { name: "asc" } });
  const sheets = await prisma.gradeSheet.findMany({
    include: {
      class: { select: { name: true, _count: { select: { students: true } } } },
      subject: { select: { name: true } },
      teacher: { select: { name: true, surname: true } },
      grades: { select: { id: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  // For the recorder, we need a list of students for the first class by default
  const defaultClassId = classes.length > 0 ? classes[0].id : null;
  const initialStudents = defaultClassId 
    ? await prisma.student.findMany({ where: { classId: defaultClassId }, select: { id: true, name: true, surname: true }, orderBy: { name: "asc" } })
    : [];

  return (
    <ResultsPageClient
      role={role}
      classes={classes}
      subjects={subjects}
      teachers={teachers}
      initialStudents={initialStudents}
      sheets={sheets}
    />
  );
};

export default ResultListPage;
