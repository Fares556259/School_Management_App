import { getRole } from "@/lib/role";
import { auth } from "@clerk/nextjs/server";
import prisma from "../../../../lib/prisma";
import ResultsPageClient from "./ResultsPageClient";

const ResultListPage = async () => {
  const { userId } = auth();
  const role = await getRole();

  const [classes, subjects, teachers, sheets] = await Promise.all([
    prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ orderBy: { domain: "asc" } }),
    prisma.teacher.findMany({ select: { id: true, name: true, surname: true }, orderBy: { name: "asc" } }),
    prisma.gradeSheet.findMany({
      include: {
        class: { select: { name: true, _count: { select: { students: true } } } },
        subject: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
        grades: { select: { id: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

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
