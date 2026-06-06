import React, { forwardRef } from "react";
import Image from "next/image";
import { Day } from "@prisma/client";

interface ExamTimetablePrintProps {
  slots: any[];
  schoolConfig: {
    schoolName: string;
    schoolLogo?: string | null;
    ministryName: string;
    ministryLogo?: string | null;
    universityName: string;
    universityLogo?: string | null;
    academicYear: string;
    currentSemester: number;
  };
  classInfo: { name: string; level: number };
  examPeriod: number;
  startDate?: Date;
  endDate?: Date;
  subjects: any[];
  teachers: any[];
  sessions: { id: number; label: string; time: string }[];
}

const ExamTimetablePrint = forwardRef<HTMLDivElement, ExamTimetablePrintProps>(({
  slots,
  schoolConfig,
  classInfo,
  examPeriod,
  startDate,
  endDate,
  subjects,
  teachers,
  sessions
}, ref) => {
  const dayLabels: { [key in Day]: string } = {
    [Day.MONDAY]: "Lundi",
    [Day.TUESDAY]: "Mardi",
    [Day.WEDNESDAY]: "Mercredi",
    [Day.THURSDAY]: "Jeudi",
    [Day.FRIDAY]: "Vendredi",
    [Day.SATURDAY]: "Samedi",
  };

  const getDisplayDays = () => {
    if (!startDate) {
        return [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY, Day.SATURDAY].map(d => ({ day: d, date: undefined }));
    }
    const end = endDate || new Date(new Date(startDate).setDate(startDate.getDate() + 5));
    const diffTime = Math.abs(end.getTime() - startDate.getTime());
    const diffDays = Math.min(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1, 14);
    
    const result: { day: Day; date: Date }[] = [];
    for (let i = 0; i < diffDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dayNames = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY, Day.SATURDAY];
        const nativeDay = d.getDay(); 
        const mappedDay = nativeDay === 0 ? Day.SATURDAY : dayNames[nativeDay - 1] || Day.MONDAY;
        result.push({ day: mappedDay, date: d });
    }
    return result;
  };

  const displayDays = getDisplayDays();

  const findSlot = (sessionId: number, targetDate?: Date) => {
    return slots.find(s => {
      if (!s || !s.startTime) return false;
      const sDate = new Date(s.startTime);
      const isSameDate = targetDate 
        ? sDate.toLocaleDateString('en-CA') === targetDate.toLocaleDateString('en-CA')
        : true;
      if (!isSameDate) return false;

      const hour = sDate.getHours();
      const session = sessions.find(sess => sess.id === sessionId);
      if (!session) return false;
      const [hStart] = session.time.split(" - ")[0].split(":").map(Number);
      const [hEnd] = session.time.split(" - ")[1].split(":").map(Number);
      return hour >= hStart && hour < hEnd;
    });
  };

  return (
    <div ref={ref} className="bg-white p-8 text-slate-900 hidden print:block" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
      <style type="text/css" media="print">{"\
        @page { size: landscape; margin: 0; }\
        body { -webkit-print-color-adjust: exact; font-family: 'Times New Roman', Times, serif; margin: 10mm; }\
      "}</style>
      
      {/* TITLE SECTION */}
      <div className="flex flex-col items-center mb-8 text-center text-black">
        <h1 className="text-[20px] font-bold leading-tight">
          {classInfo.level}{classInfo.level === 1 ? 'ère' : 'ème'} Année - {classInfo.name}
        </h1>
      </div>

      {/* TABLE SECTION */}
      <table className="w-full border-collapse border-2 border-black text-[12px]">
        <thead>
          <tr>
            <th className="border border-black p-2 font-bold w-[120px]">Horaire</th>
            {displayDays.map((item, idx) => (
              <th key={idx} className="border border-black p-2 font-bold">
                {dayLabels[item.day]} {item.date?.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td className="border border-black p-3 font-bold text-center whitespace-nowrap bg-white text-[12px]">
                {session.time.split(" - ").map(t => t.replace(/^0/, "").replace(/:00/, "h").replace(/:30/, "h30")).join("-")}
              </td>
              {displayDays.map((item, idx) => {
                const s = findSlot(session.id, item.date);
                const teacherNames = s?.lesson?.teacher ? `${s.lesson.teacher.name} ${s.lesson.teacher.surname}` : "";
                
                let subjectName = s?.lesson?.subject?.name || "";
                if (subjectName.includes("|")) {
                  const parts = subjectName.split("|").map((p: string) => p.trim());
                  const arabicPart = parts.find((p: string) => /[\u0600-\u06FF]/.test(p));
                  subjectName = arabicPart || parts[0];
                }

                return (
                  <td key={idx} className="border border-black p-3 text-center align-middle min-h-[60px] text-[14px]">
                    {s ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-bold leading-tight">
                          {subjectName}
                        </span>
                      </div>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
});

ExamTimetablePrint.displayName = "ExamTimetablePrint";

export default ExamTimetablePrint;
