import { Day } from "@prisma/client";

export const adjustWorkWeek = (lessons: any[]) => {
  const currentStartOfWeek = new Date();
  const day = currentStartOfWeek.getDay();
  const diff = currentStartOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(currentStartOfWeek.setDate(diff));

  return lessons.map((lesson) => {
    const lessonDay = lesson.day as Day;
    const dayIndex = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].indexOf(lessonDay);

    const start = new Date(monday);
    start.setDate(monday.getDate() + dayIndex);
    start.setHours(lesson.startTime.getHours(), lesson.startTime.getMinutes(), 0, 0);

    const end = new Date(monday);
    end.setDate(monday.getDate() + dayIndex);
    end.setHours(lesson.endTime.getHours(), lesson.endTime.getMinutes(), 0, 0);

    return {
      title: lesson.name,
      start,
      end,
    };
  });
};
