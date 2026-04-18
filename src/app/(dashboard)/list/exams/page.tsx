import { getRole } from "@/lib/role";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import ExamTimetableClient from "./ExamTimetableClient";

const ExamListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  const { classId, teacherId, search } = searchParams;

  // URL QUERY PARAMS CONDITION
  const query: Prisma.ExamWhereInput = {};

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
    include: {
        level: true
    }
  });
  const teachers = await prisma.teacher.findMany();
  const subjects = await prisma.subject.findMany();
  const rooms = await prisma.room.findMany();

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
