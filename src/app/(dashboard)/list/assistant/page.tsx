"use client";
import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import SnapAssistant from "../../admin/components/SnapAssistant";
import AssistantSidebar from "../../admin/components/AssistantSidebar";
import { useState, useEffect } from "react";

const AssistantPage = ({
  dashboardContext
}: {
  dashboardContext: any;
}) => {
  const [activeSession, setActiveSession] = useState("1");
  const [chatKey, setChatKey] = useState(0); // To force re-render on new chat

  const mockConversations = [
    { id: "1", title: "Analyse des revenus de Juin", date: "AUJOURD'HUI" },
    { id: "2", title: "Gap de paiement Amine Student", date: "HIER" },
    { id: "3", title: "Mise à jour des notes 2C", date: "10 AVRIL" },
  ];

  const handleNewChat = () => {
    setChatKey(prev => prev + 1);
    setActiveSession("new");
  };

  return (
    <div className="h-[calc(100vh-100px)] -m-6 flex overflow-hidden bg-white">
      {/* 1. ChatGPT-Style Sidebar */}
      <AssistantSidebar 
        conversations={mockConversations}
        activeId={activeSession}
        onSelect={setActiveSession}
        onNewChat={handleNewChat}
      />

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex-1 p-6 overflow-hidden">
          <SnapAssistant 
            key={chatKey}
            context={dashboardContext} 
            fullPage={true} 
            onNewChat={handleNewChat}
          />
        </div>
      </div>
    </div>
  );
};

// Server component wrapper to fetch data
export default function AssistantPageWrapper() {
  // We'll need a way to pass data to the client component. 
  // For now, I'll move the data fetching to a separate action or use a layout-based approach.
  // Actually, I'll keep the server side logic and just pass it down.
  return <AssistantServerData />;
}

async function AssistantServerData() {
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
    revenueGapThisPeriod
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
    })
  ]);

  const dashboardContext = {
    month: MONTHS[startDate.getMonth()],
    year: startDate.getFullYear(),
    metrics: { income: incomeThisPeriod._sum.amount || 0, gap: revenueGapThisPeriod._sum.deferredAmount || 0 },
    census: { students: studentCount, teachers: teacherCount, classDetails: schoolClasses.map(c => ({ name: c.name, students: c._count.students })) },
    academics: { overallAvg: allGrades.length ? (allGrades.reduce((acc, curr) => acc + curr.score, 0) / allGrades.length).toFixed(1) : 0, totalLessons: allLessons.length, gradeSheets: gradeSheets },
    operations: { notices: allNotices.map(n => ({ title: n.title, message: n.message, date: n.date })) }
  };

  return <AssistantPage dashboardContext={dashboardContext} />;
}
