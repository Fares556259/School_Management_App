import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import AssistantClient from "./AssistantClient";
import { getAIUsageStats } from "../../admin/actions/aiActions";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    studentCount,
    teacherCount,
    staffCount,
    classCount,
    incomeThisPeriod,
    allGrades,
    allNotices,
    allLessons,
    schoolClasses,
    gradeSheets,
    revenueGapThisPeriod,
    aiLogs,
    dbConversations,
    usageStats
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.staff.count(),
    prisma.class.count(),
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: startDate, lt: endDate } } }),
    prisma.grade.findMany(),
    prisma.notice.findMany({ take: 5, orderBy: { date: "desc" } }),
    prisma.lesson.findMany(),
    prisma.class.findMany({ include: { _count: { select: { students: true } } } }),
    prisma.gradeSheet.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    prisma.payment.aggregate({
      where: { status: "PARTIAL", month: startDate.getMonth() + 1, year: startDate.getFullYear() },
      _sum: { deferredAmount: true }
    }),
    prisma.auditLog.findMany({
      where: { performedBy: "zbiba (AI)" },
      orderBy: { timestamp: "desc" },
      take: 10
    }),
    (prisma as any).conversation ? (prisma as any).conversation.findMany({
      where: { month: startDate.getMonth() + 1, year: startDate.getFullYear() },
      orderBy: { updatedAt: "desc" }
    }) : Promise.resolve([]),
    getAIUsageStats()
  ]);

  const aiActivities = aiLogs.map(log => ({
    id: `log-${log.id}`,
    type: "LOG",
    title: log.description.length > 40 ? log.description.substring(0, 37) + "..." : log.description,
    fullDesc: log.description,
    date: log.timestamp.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).toUpperCase()
  }));

  const chatHistory = (dbConversations || []).map((conv: any) => ({
    id: conv.id,
    type: "CHAT",
    title: conv.title,
    messages: conv.messages,
    date: conv.updatedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).toUpperCase()
  }));

  const dashboardContext = {
    month: MONTHS[startDate.getMonth()],
    year: startDate.getFullYear(),
    metrics: { income: incomeThisPeriod._sum.amount || 0, gap: revenueGapThisPeriod._sum.deferredAmount || 0 },
    census: { students: studentCount, teachers: teacherCount, classDetails: schoolClasses.map(c => ({ name: c.name, students: c._count.students })) },
    academics: { overallAvg: allGrades.length ? (allGrades.reduce((acc, curr) => acc + curr.score, 0) / allGrades.length).toFixed(1) : 0, totalLessons: allLessons.length, gradeSheets: gradeSheets },
    operations: { notices: allNotices.map(n => ({ title: n.title, message: n.message, date: n.date })) }
  };

  return (
    <AssistantClient 
      dashboardContext={dashboardContext} 
      activities={aiActivities} 
      chatHistory={chatHistory}
      month={startDate.getMonth() + 1}
      year={startDate.getFullYear()}
      usageStats={usageStats}
    />
  );
}
