import { getRole } from "@/lib/role";
import { getCachedTenantData } from "@/lib/cache";
import { createClient } from "@/utils/supabase/server";
import prisma from "../../../../lib/prisma";
import ResultsPageClient from "./ResultsPageClient";
import { getSchoolId } from "@/lib/school";

import { LEVEL_CONFIGS } from "@/lib/report-cards/level-config";


const ResultListPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const userId = user?.id;
  const role = await getRole();

  const schoolId = await getSchoolId();

  const fetchResultsData = () =>
    Promise.all([
      prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true, level: true }, orderBy: { name: "asc" } }),
      prisma.subject.findMany({ where: { schoolId }, orderBy: { domain: "asc" } }),
      prisma.teacher.findMany({ where: { schoolId }, select: { id: true, name: true, surname: true }, orderBy: { name: "asc" } }),
      prisma.gradeSheet.findMany({
        where: { schoolId },
        include: {
          class: { select: { name: true, _count: { select: { students: true } } } },
          subject: { select: { name: true } },
          teacher: { select: { name: true, surname: true } },
          grades: { select: { id: true, studentId: true, score: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
      }),
      prisma.student.findMany({ 
        where: { schoolId, classId: { not: null } },
        select: { id: true, name: true, surname: true, classId: true }, 
        orderBy: { name: "asc" } 
      }),
      prisma.lesson.findMany({
        where: { schoolId },
        select: {
          classId: true,
          subjectId: true,
          teacher: { select: { id: true, name: true, surname: true } }
        }
      })
    ]);

  const cached = await getCachedTenantData(
    schoolId,
    "exams",
    [schoolId],
    fetchResultsData,
    300
  ).catch(() => null);

  const [classesRaw, subjects, teachers, sheets, allStudents, lessons] =
    Array.isArray(cached) && cached.length === 6 ? cached : await fetchResultsData();

  const safeClassesRaw = classesRaw || [];
  const safeSubjects = subjects || [];
  const safeTeachers = teachers || [];
  const safeSheets = sheets || [];
  const safeAllStudents = allStudents || [];
  const safeLessons = lessons || [];

  // Derive initial students after fetch completes
  const firstClassId = safeClassesRaw.length > 0 ? safeClassesRaw[0].id : null;
  const initialStudents = safeAllStudents.filter((s: any) => s.classId === firstClassId);

  // Hard-filter any placeholder "all" classes
  const classes = safeClassesRaw.filter((c: any) => String(c.id).toLowerCase() !== "all" && c.name?.toLowerCase() !== "all classes");

  return (
    <ResultsPageClient
      role={role}
      classes={classes}
      subjects={subjects}
      teachers={teachers}
      initialStudents={initialStudents}
      allStudents={allStudents}
      sheets={sheets}
      lessons={lessons}
      levelConfigs={LEVEL_CONFIGS}
    />
  );
};

export default ResultListPage;
