import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const adjustWorkWeek = (date: Date) => {
  const day = date.getDay();
  if (day === 0) {
    return new Date(date.setDate(date.getDate() + 1));
  }
  if (day === 6) {
    return new Date(date.setDate(date.getDate() + 2));
  }
  return date;
};

export const adjustScheduleToCurrentWeek = (
  lessons: { title: string; start: Date; end: Date }[]
) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // We want to map lessons to THIS week. 
  // Let's find the most recent Sunday/Monday.
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  startOfWeek.setHours(0, 0, 0, 0);

  return lessons.map((lesson) => {
    const lessonDay = lesson.start.getDay();
    const daysToAdd = lessonDay === 0 ? 6 : lessonDay - 1;
    
    const start = new Date(startOfWeek);
    start.setDate(startOfWeek.getDate() + daysToAdd);
    start.setHours(lesson.start.getHours(), lesson.start.getMinutes());

    const end = new Date(startOfWeek);
    end.setDate(startOfWeek.getDate() + daysToAdd);
    end.setHours(lesson.end.getHours(), lesson.end.getMinutes());

    return {
      title: lesson.title,
      start,
      end,
    };
  });
};
