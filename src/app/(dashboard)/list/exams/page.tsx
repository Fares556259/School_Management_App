import { getRole } from "@/lib/role";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import ExamTimetableClient from "./ExamTimetableClient";
import { getSchoolId } from "@/lib/school";

const ExamListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  const { classId, teacherId, search } = searchParams;

  const schoolId = await getSchoolId();

  // URL QUERY PARAMS CONDITION
  const query: Prisma.ExamWhereInput = { schoolId };

  if (classId) {
    query.lesson = { classId: parseInt(classId) };
  }
  if (teacherId) {
    query.lesson = { teacherId: teacherId };
  }
  if (search) {
    query.lesson = {
      OR: [
        { subject: { name: { contains: search, mode: "insensitive" } } },
        { teacher: { name: { contains: search, mode: "insensitive" } } },
        { teacher: { surname: { contains: search, mode: "insensitive" } } },
      ],
    };
  }

  // Fetch only this week's exams for the grid (or based on selected week if added later)
  // For now, let's just fetch ALL exams for the class to populate the grid
  const data = await prisma.exam.findMany({
    where: query,
    include: {
      lesson: {
        include: {
          subject: true,
          class: true,
          teacher: true,
        },
      },
    },
    orderBy: {
        startTime: 'asc'
    }
  });

  const classes = await prisma.class.findMany({
    where: { schoolId },
    include: {
        level: true
    },
    orderBy: { name: 'asc' }
  });
  const teachers = await prisma.teacher.findMany({ where: { schoolId } });
  const subjects = await prisma.subject.findMany({ where: { schoolId } });
  const rooms = await prisma.room.findMany({ where: { schoolId } });

  return (
    <ExamTimetableClient 
        classes={classes} 
        teachers={teachers} 
        subjects={subjects}
        rooms={rooms}
        role={role!} 
    />
  );
};

export default ExamListPage;
