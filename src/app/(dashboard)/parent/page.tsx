import BigCalendarContainer from "@/components/BigCalendarContainer";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { getCachedTenantData } from "@/lib/cache";
import { getSchoolId } from "@/lib/school";

const ParentPage = async () => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const userId = user?.id;
  const schoolId = await getSchoolId();

  const students = await getCachedTenantData(
    schoolId,
    "parents",
    [userId, schoolId],
    () =>
      prisma.student.findMany({
        where: {
          parentId: userId!,
        },
      }),
    300
  );

  return (
    <div className="flex-1 p-4 flex gap-4 flex-col xl:flex-row">
      {/* LEFT */}
      <div className="w-full">
        {students.map((student) => (
          <div className="h-full bg-white p-4 rounded-md mb-8" key={student.id}>
            <h1 className="text-xl font-semibold">Schedule ({student.name + " " + student.surname})</h1>
            <BigCalendarContainer type="classId" id={student.classId || 0} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParentPage;
