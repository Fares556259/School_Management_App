import BigCalendarContainer from "@/components/BigCalendarContainer";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { getCachedTenantData } from "@/lib/cache";
import { getSchoolId } from "@/lib/school";

const StudentPage = async () => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const userId = user?.id;
  const schoolId = await getSchoolId();

  const classItem = await getCachedTenantData(
    schoolId,
    "students",
    [userId, schoolId],
    () =>
      prisma.class.findFirst({
        where: {
          students: { some: { id: userId! } },
        },
      }),
    300
  );

  return (
    <div className="p-4 flex gap-4 flex-col xl:flex-row">
      {/* LEFT */}
      <div className="w-full">
        <div className="h-full bg-white p-4 rounded-md">
          <h1 className="text-xl font-semibold">Schedule ({classItem?.name})</h1>
          <BigCalendarContainer type="classId" id={classItem?.id!} />
        </div>
      </div>
    </div>
  );
};

export default StudentPage;
