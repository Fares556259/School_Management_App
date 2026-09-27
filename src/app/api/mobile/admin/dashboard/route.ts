import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateMobileRequest(request);
    if (auth.error) return auth.error;

    const { userId, userType, schoolId } = auth.payload;
    if (userType !== "admin") {
      return NextResponse.json(
        { success: false, error: "Accès réservé à la direction / administrateur." },
        { status: 403 }
      );
    }

    const now = new Date();
    const activeMonth = now.getMonth() + 1;
    const activeYear = now.getFullYear();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const monthNamesFr = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    const monthLabel = `${monthNamesFr[now.getMonth()]} ${activeYear}`;

    // 1. Fetch School & Admin info
    const [admin, school] = await Promise.all([
      prisma.admin.findUnique({
        where: { id: userId },
        select: { name: true, surname: true, username: true, img: true },
      }),
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true },
      }),
    ]);

    const adminName = admin ? ([admin.name, admin.surname].filter(Boolean).join(" ") || admin.username) : "Direction";

    // 2. Operations snapshot (matching web dashboard exactly)
    const [studentCount, teacherCount, staffCount, classCount] = await Promise.all([
      prisma.student.count({ where: { schoolId } }),
      prisma.teacher.count({ where: { schoolId } }),
      prisma.staff.count({ where: { schoolId } }),
      prisma.class.count({ where: { schoolId } }),
    ]);

    // 3. Tuition metrics for active month (matching web dashboard calculation)
    const [monthlyCollectedTuitionAgg, expectedTuitionRows] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          schoolId,
          userType: { equals: "student", mode: "insensitive" },
          status: { in: ["PAID", "PARTIAL"] },
          month: activeMonth,
          year: activeYear,
        },
        _sum: { amount: true },
      }),
      prisma.$queryRaw`
        SELECT COALESCE(SUM(COALESCE(s."customTuition", l."tuitionFee", 450)), 0)::float as "expectedTotal"
        FROM "Student" s
        LEFT JOIN "Level" l ON s."levelId" = l.id
        WHERE s."schoolId" = ${schoolId}
      ` as Promise<any[]>,
    ]);

    const collectedTuition = monthlyCollectedTuitionAgg._sum.amount || 0;
    const expectedTuition = (expectedTuitionRows?.[0]?.expectedTotal as number) || (studentCount * 450);
    const collectionRate = expectedTuition > 0 ? Math.min(100, Math.round((collectedTuition / expectedTuition) * 100)) : 0;
    const remainingToCollect = Math.max(0, expectedTuition - collectedTuition);

    // 4. Attendance pulse for today
    const [todayAttendanceCount, todayAbsences, recentAbsenteesList] = await Promise.all([
      prisma.attendance.count({
        where: { schoolId, date: { gte: startOfDay, lte: endOfDay } },
      }),
      prisma.attendance.count({
        where: { schoolId, date: { gte: startOfDay, lte: endOfDay }, status: "ABSENT" },
      }),
      prisma.attendance.findMany({
        where: { schoolId, date: { gte: startOfDay, lte: endOfDay }, status: "ABSENT" },
        take: 4,
        orderBy: { date: "desc" },
        select: {
          id: true,
          date: true,
          student: {
            select: {
              name: true,
              surname: true,
              class: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const attendanceRate = todayAttendanceCount > 0
      ? Math.max(0, Math.round(((todayAttendanceCount - todayAbsences) / todayAttendanceCount) * 100))
      : 98; // Default optimistic school attendance if not yet fully taken

    // 5. Important Notices / Flash Alerts
    const notices = await prisma.notice.findMany({
      where: { schoolId },
      take: 3,
      orderBy: { date: "desc" },
      select: {
        id: true,
        title: true,
        message: true,
        date: true,
        important: true,
      },
    });

    return NextResponse.json({
      success: true,
      adminName,
      schoolName: school?.name || "SnapSchool",
      monthLabel,
      operations: {
        students: studentCount,
        teachers: teacherCount,
        staff: staffCount,
        classes: classCount,
      },
      financialPulse: {
        collectedTuition,
        expectedTuition,
        remainingToCollect,
        collectionRate,
        monthLabel,
      },
      attendanceToday: {
        attendanceRate,
        absentCount: todayAbsences,
        totalRecorded: todayAttendanceCount,
        recentAbsentees: recentAbsenteesList.map((a) => ({
          id: a.id,
          studentName: `${a.student.name} ${a.student.surname}`,
          className: a.student.class?.name || "Classe",
          time: a.date.toISOString(),
        })),
      },
      notices: notices.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        date: n.date.toISOString(),
        important: n.important,
      })),
    });
  } catch (error: any) {
    console.error("[Admin Dashboard API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
