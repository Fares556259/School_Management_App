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

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    const now = new Date();
    const activeMonth = monthParam ? Math.min(12, Math.max(1, parseInt(monthParam, 10))) : now.getMonth() + 1;
    const activeYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const monthNamesFr = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    const monthLabel = `${monthNamesFr[activeMonth - 1]} ${activeYear}`;

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

    // 3. Tuition metrics & Unpaid queries for active month
    const [
      monthlyCollectedTuitionAgg,
      expectedTuitionRows,
      unpaidStudentRows,
      unpaidTeacherRows,
      unpaidStaffRows,
    ] = await Promise.all([
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
      // Unpaid Students query
      prisma.$queryRaw`
        SELECT 
          s.id, s.name, s.surname, 
          p.name as "pName", p.surname as "pSurname", p.phone as "parentPhone",
          COALESCE(s."customTuition", l."tuitionFee", 450)::float as "tuitionFee",
          c.name as "className",
          pay.status as "paymentStatus", 
          COALESCE(pay.amount, 0)::float as "paidAmount", 
          COALESCE(pay."deferredAmount", 0)::float as "deferredAmount"
        FROM "Student" s
        LEFT JOIN "Level" l ON s."levelId" = l.id
        LEFT JOIN "Class" c ON s."classId" = c.id
        LEFT JOIN "Parent" p ON s."parentId" = p.id
        LEFT JOIN "Payment" pay ON s.id = pay."studentId" 
          AND pay.month = ${activeMonth} 
          AND pay.year = ${activeYear}
        WHERE s."schoolId" = ${schoolId}
          AND (pay.status IS NULL OR pay.status != 'PAID')
        ORDER BY 
          CASE WHEN pay.status = 'PARTIAL' THEN 1 ELSE 2 END,
          s.surname ASC
      ` as Promise<any[]>,
      // Unpaid Teachers query
      prisma.$queryRaw`
        SELECT 
          t.id, t.name, t.surname, t.phone, 
          COALESCE(t.salary, 0)::float as "salary", 
          COALESCE(t."hourlyRate", 0)::float as "hourlyRate", 
          COALESCE(t."hoursPerMonth", 0)::float as "hoursPerMonth",
          pay.status as "paymentStatus", 
          COALESCE(pay.amount, 0)::float as "paymentAmount", 
          COALESCE(pay."deferredAmount", 0)::float as "deferredAmount", 
          COALESCE(pay."missedHours", 0)::float as "missedHours"
        FROM "Teacher" t
        LEFT JOIN "Payment" pay ON t.id = pay."teacherId" 
          AND pay.month = ${activeMonth} 
          AND pay.year = ${activeYear}
        WHERE t."schoolId" = ${schoolId} 
          AND (pay.status IS NULL OR pay.status != 'PAID')
        ORDER BY 
          CASE WHEN pay.status = 'PARTIAL' THEN 1 WHEN (pay."missedHours" IS NOT NULL AND pay."missedHours" > 0) THEN 2 ELSE 3 END,
          t.surname ASC
      ` as Promise<any[]>,
      // Unpaid Staff query
      prisma.$queryRaw`
        SELECT 
          s.id, s.name, s.surname, s.phone, 
          COALESCE(s.salary, 0)::float as "salary", 
          s.role,
          pay.status as "paymentStatus", 
          COALESCE(pay.amount, 0)::float as "paymentAmount", 
          COALESCE(pay."deferredAmount", 0)::float as "deferredAmount", 
          COALESCE(pay."missedHours", 0)::float as "missedHours"
        FROM "Staff" s
        LEFT JOIN "Payment" pay ON s.id = pay."staffId" 
          AND pay.month = ${activeMonth} 
          AND pay.year = ${activeYear}
        WHERE s."schoolId" = ${schoolId} 
          AND (pay.status IS NULL OR pay.status != 'PAID')
        ORDER BY 
          CASE WHEN pay.status = 'PARTIAL' THEN 1 WHEN (pay."missedHours" IS NOT NULL AND pay."missedHours" > 0) THEN 2 ELSE 3 END,
          s.surname ASC
      ` as Promise<any[]>,
    ]);

    const collectedTuition = monthlyCollectedTuitionAgg._sum.amount || 0;
    const expectedTuition = (expectedTuitionRows?.[0]?.expectedTotal as number) || (studentCount * 450);
    const collectionRate = expectedTuition > 0 ? Math.min(100, Math.round((collectedTuition / expectedTuition) * 100)) : 0;
    const remainingToCollect = Math.max(0, expectedTuition - collectedTuition);

    // Process Unpaid Students
    const unpaidStudents = unpaidStudentRows.map((r) => {
      const fullFee = Number(r.tuitionFee) || 450;
      const isPartial = r.paymentStatus === "PARTIAL";
      const paidAmount = Number(r.paidAmount) || 0;

      let dueAmount = fullFee;
      if (isPartial) {
        const deferred = Number(r.deferredAmount);
        dueAmount = deferred > 0 ? deferred : Math.max(0, fullFee - paidAmount);
      } else if (r.paymentStatus === "PENDING") {
        dueAmount = Number(r.paidAmount) || fullFee;
      }

      return {
        id: r.id,
        type: "student" as const,
        name: `${r.name} ${r.surname}`,
        className: r.className || "Sans classe",
        parentName: r.pName ? `${r.pName} ${r.pSurname || ""}`.trim() : "Parent",
        parentPhone: r.parentPhone ? r.parentPhone.replace(/\s+/g, "") : "",
        fullFee,
        paidAmount,
        dueAmount,
        status: r.paymentStatus || "UNPAID",
      };
    });

    // Process Unpaid Teachers
    const unpaidTeachers = unpaidTeacherRows.map((t) => {
      const rate = Number(t.hourlyRate) || 0;
      const monthlyHours = Number(t.hoursPerMonth) || 0;
      const baseSalary = (rate > 0 && monthlyHours > 0) ? (rate * monthlyHours) : (Number(t.salary) || 3000);
      const missedHours = Number(t.missedHours) || 0;
      const deduction = missedHours * (rate > 0 ? rate : 15);
      const isAdvance = t.paymentStatus === "PARTIAL";
      const advanceAmount = isAdvance ? (Number(t.paymentAmount) || 0) : 0;

      let dueAmount = Math.max(0, baseSalary - deduction - advanceAmount);
      if (t.deferredAmount && Number(t.deferredAmount) > 0) {
        dueAmount = Number(t.deferredAmount);
      } else if (t.paymentStatus === "PENDING" && t.paymentAmount && Number(t.paymentAmount) > 0) {
        dueAmount = Number(t.paymentAmount);
      }

      return {
        id: t.id,
        type: "teacher" as const,
        name: `${t.name} ${t.surname}`,
        phone: t.phone ? t.phone.replace(/\s+/g, "") : "",
        role: "Enseignant",
        baseSalary,
        hourlyRate: rate,
        advanceAmount: advanceAmount > 0 ? advanceAmount : 0,
        missedHours: missedHours > 0 ? missedHours : 0,
        deduction: deduction > 0 ? deduction : 0,
        dueAmount,
        status: t.paymentStatus || "UNPAID",
      };
    });

    // Process Unpaid Staff
    const unpaidStaff = unpaidStaffRows.map((s) => {
      const baseSalary = Number(s.salary) || 1500;
      const isAdvance = s.paymentStatus === "PARTIAL";
      const advanceAmount = isAdvance ? (Number(s.paymentAmount) || 0) : 0;

      let dueAmount = Math.max(0, baseSalary - advanceAmount);
      if (s.deferredAmount && Number(s.deferredAmount) > 0) {
        dueAmount = Number(s.deferredAmount);
      } else if (s.paymentStatus === "PENDING" && s.paymentAmount && Number(s.paymentAmount) > 0) {
        dueAmount = Number(s.paymentAmount);
      }

      return {
        id: s.id,
        type: "staff" as const,
        name: `${s.name} ${s.surname}`,
        phone: s.phone ? s.phone.replace(/\s+/g, "") : "",
        role: s.role || "Personnel",
        baseSalary,
        advanceAmount: advanceAmount > 0 ? advanceAmount : 0,
        dueAmount,
        status: s.paymentStatus || "UNPAID",
      };
    });

    const unpaidStudentsCount = unpaidStudents.length;
    const unpaidStudentsTotal = unpaidStudents.reduce((acc, curr) => acc + curr.dueAmount, 0);

    const unpaidEmployees = [...unpaidTeachers, ...unpaidStaff];
    const unpaidEmployeesCount = unpaidEmployees.length;
    const unpaidEmployeesTotal = unpaidEmployees.reduce((acc, curr) => acc + curr.dueAmount, 0);

    const allUnpaid = [
      ...unpaidStudents,
      ...unpaidTeachers,
      ...unpaidStaff,
    ];

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
      selectedMonth: activeMonth,
      selectedYear: activeYear,
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
      unpaidSummary: {
        unpaidStudentsCount,
        unpaidStudentsTotal,
        unpaidEmployeesCount,
        unpaidEmployeesTotal,
        totalUnpaidCount: allUnpaid.length,
        totalUnpaidAmount: unpaidStudentsTotal + unpaidEmployeesTotal,
      },
      allUnpaid,
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
