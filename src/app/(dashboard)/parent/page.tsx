import BigCalendarContainer from "@/components/BigCalendarContainer";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

const ParentPage = async () => {
  const { userId } = auth();

  const students = await prisma.student.findMany({
    where: {
      parentId: userId!,
    },
  });

  return (
    <div className="flex-1 p-4 flex gap-4 flex-col xl:flex-row">
      {/* LEFT */}
      <div className="w-full">
        {students.map((student) => (
          <div className="h-full bg-white p-4 rounded-md mb-8" key={student.id}>
            <h1 className="text-xl font-semibold">Schedule ({student.name + " " + student.surname})</h1>
            <BigCalendarContainer type="classId" id={student.classId} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParentPage;
