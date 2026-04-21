import { getRole } from "@/lib/role";
import { auth } from "@clerk/nextjs/server";
import prisma from "../../../../lib/prisma";
import ResultsPageClient from "./ResultsPageClient";
import { getSchoolId } from "@/lib/school";

const ResultListPage = async () => {
  const { userId } = auth();
  const role = await getRole();

  const schoolId = await getSchoolId();

  // 🐘 V3 Stabilization: Re-parallelize optimized queries with hardened pool settings
  const [classesRaw, subjects, teachers, sheets, allStudents] = await Promise.all([
    prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ where: { schoolId }, orderBy: { domain: "asc" } }),
    prisma.teacher.findMany({ where: { schoolId }, select: { id: true, name: true, surname: true }, orderBy: { name: "asc" } }),
    prisma.gradeSheet.findMany({
      where: { schoolId },
      include: {
        class: { select: { name: true, _count: { select: { students: true } } } },
        subject: { select: { name: true } },
        teacher: { select: { name: true, surname: true } },
        grades: { select: { id: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.student.findMany({ 
      where: { schoolId, classId: { not: undefined } },
      select: { id: true, name: true, surname: true, classId: true }, 
      orderBy: { name: "asc" } 
    })
  ]);

  // Derive initial students after parallel fetch completes
  const firstClassId = classesRaw?.length > 0 ? classesRaw[0].id : null;
  const initialStudents = allStudents.filter(s => s.classId === firstClassId);

  // Hard-filter any placeholder "all" classes
  const classes = classesRaw.filter(c => String(c.id).toLowerCase() !== "all" && c.name.toLowerCase() !== "all classes");

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
