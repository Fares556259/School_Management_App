import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import SnapAssistant from "../../admin/components/SnapAssistant";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";

export const dynamic = "force-dynamic";

const AssistantPage = async () => {
  const cookieStore = cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale) || "en";
  const t = translations[locale];

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Fetch data for context (mirroring Admin dashboard intelligence)
  const [
    studentCount,
    teacherCount,
    staffCount,
    classCount,
    incomeThisPeriod,
    expenseThisPeriod,
    allGrades,
    allNotices,
    allLessons,
    schoolClasses,
    recentAuditLogs,
    gradeSheets,
    revenueGapThisPeriod
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.staff.count(),
    prisma.class.count(),
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: startDate, lt: endDate } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: startDate, lt: endDate } } }),
    prisma.grade.findMany(),
    prisma.notice.findMany({ take: 5, orderBy: { date: "desc" } }),
    prisma.lesson.findMany(),
    prisma.class.findMany({ include: { _count: { select: { students: true } } } }),
    prisma.auditLog.findMany({ take: 10, orderBy: { timestamp: "desc" } }),
    prisma.gradeSheet.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    prisma.payment.aggregate({
      where: { status: "PARTIAL", month: startDate.getMonth() + 1, year: startDate.getFullYear() },
      _sum: { deferredAmount: true }
    })
  ]);

  const dashboardContext = {
    month: MONTHS[startDate.getMonth()],
    year: startDate.getFullYear(),
    metrics: {
      income: incomeThisPeriod._sum.amount || 0,
      expense: expenseThisPeriod._sum.amount || 0,
      gap: revenueGapThisPeriod._sum.deferredAmount || 0
    },
    census: {
      students: studentCount,
      teachers: teacherCount,
      staff: staffCount,
      classes: classCount,
      classDetails: schoolClasses.map(c => ({ name: c.name, students: c._count.students }))
    },
    academics: {
      overallAvg: allGrades.length ? (allGrades.reduce((acc, curr) => acc + curr.score, 0) / allGrades.length).toFixed(1) : 0,
      totalLessons: allLessons.length,
      gradeSheets: gradeSheets
    },
    operations: {
      notices: allNotices.map(n => ({ title: n.title, message: n.message, date: n.date })),
      recentAuditLogs: recentAuditLogs.map(log => ({ action: log.action, desc: log.description, time: log.timestamp }))
    }
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">Zbiba AI Control Center</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Deep analysis and operational control powered by Gemini</p>
        </div>
      </div>

      <div className="flex-1">
        <SnapAssistant context={dashboardContext} fullPage={true} />
      </div>
    </div>
  );
};

export default AssistantPage;
