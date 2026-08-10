import prisma from "@/lib/prisma";
import dynamic from "next/dynamic";

const BigCalendar = dynamic(() => import("./BigCalender"), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full bg-slate-100 animate-pulse rounded-md"></div>
});
import { adjustScheduleToCurrentWeek } from "@/lib/utils";

const BigCalendarContainer = async ({
  type,
  id,
}: {
  type: "teacherId" | "classId";
  id: string | number;
}) => {
  const dataRes = await prisma.lesson.findMany({
    where: {
      ...(type === "teacherId"
        ? { teacherId: id as string }
        : { classId: id as number }),
    },
  });

  const lessons = dataRes.map((lesson) => ({
    title: lesson.name,
    start: lesson.startTime,
    end: lesson.endTime,
  }));

  const data = adjustScheduleToCurrentWeek(lessons);

  return (
    <div className="">
      <BigCalendar data={data} />
    </div>
  );
};

export default BigCalendarContainer;
