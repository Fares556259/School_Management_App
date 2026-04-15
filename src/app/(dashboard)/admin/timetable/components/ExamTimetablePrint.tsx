import React, { forwardRef } from "react";
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
        @page { size: landscape; margin: 10mm; }\
        body { -webkit-print-color-adjust: exact; font-family: 'Times New Roman', Times, serif; }\
      "}</style>
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-start mb-10">
        <div className="w-1/3 text-[10px] leading-tight flex flex-col items-start gap-2">
          <p className="font-bold whitespace-pre-line">{schoolConfig.schoolName}</p>
          {schoolConfig.schoolLogo ? (
            <img src={schoolConfig.schoolLogo} alt="School Logo" className="w-16 h-16 object-contain" />
          ) : (
            <div className="w-16 h-16 bg-slate-50 border border-slate-200 flex items-center justify-center">
              <span className="text-[8px] text-slate-400 font-sans uppercase">Logo</span>
            </div>
          )}
        </div>

        <div className="w-1/3 flex flex-col items-center gap-2">
            <div className="text-center font-bold text-[10px] uppercase leading-tight whitespace-pre-line">
                {schoolConfig.ministryName}
            </div>
            <div className="w-12 h-12 flex flex-col items-center justify-center">
                {schoolConfig.ministryLogo ? (
                   <img src={schoolConfig.ministryLogo} alt="Ministry Logo" className="w-10 h-10 object-contain" />
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full border border-slate-300"></div>
                    <span className="text-[6px] text-slate-400 mt-1 uppercase font-sans">Logo</span>
                  </>
                )}
            </div>
        </div>

        <div className="w-1/3 text-[10px] leading-tight flex flex-col items-end gap-2 text-right">
          <div className="flex flex-col items-end gap-2">
             <p className="font-bold uppercase tracking-tighter whitespace-pre-line">{schoolConfig.universityName}</p>
             {schoolConfig.universityLogo ? (
                <img src={schoolConfig.universityLogo} alt="University Logo" className="w-12 h-12 object-contain" />
             ) : (
               <div className="w-12 h-12 bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <span className="text-[6px] text-slate-400 font-sans uppercase">Logo</span>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* TITLE SECTION */}
      <div className="flex flex-col items-center gap-2 mb-8 text-center uppercase">
        <h1 className="text-xl font-black underline decoration-2 underline-offset-4">
          Calendrier des Examens {schoolConfig.currentSemester}{schoolConfig.currentSemester === 1 ? 'er' : 'ème'} Semestre - Période {examPeriod}
        </h1>
        <h2 className="text-base font-bold">
          Année Universitaire {schoolConfig.academicYear}
        </h2>
        <h3 className="text-sm font-bold opacity-80 mt-1">
          {classInfo.level}{classInfo.level === 1 ? 'ère' : 'ème'} Année - {classInfo.name}
        </h3>
      </div>

      {/* TABLE SECTION */}
      <table className="w-full border-collapse border-2 border-slate-900 text-[10px]">
        <thead>
          <tr>
            <th className="border border-slate-900 p-2 bg-slate-50 font-black uppercase w-[100px]">Horaire</th>
            {displayDays.map((item, idx) => (
              <th key={idx} className="border border-slate-900 p-2 bg-slate-50 font-black uppercase">
                {dayLabels[item.day]} {item.date?.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td className="border border-slate-900 p-3 font-black text-center whitespace-nowrap bg-white">
                {session.time.replace(" - ", " - ")}
              </td>
              {displayDays.map((item, idx) => {
                const s = findSlot(session.id, item.date);
                const teacherNames = s?.lesson?.teacher ? `${s.lesson.teacher.name} ${s.lesson.teacher.surname}` : "";
                const subjectName = s?.lesson?.subject?.name || "";
                const examType = s?.title?.includes("DS") ? "DS" : s?.title?.includes("EX") ? "EX" : "EX";

                return (
                  <td key={idx} className="border border-slate-900 p-3 text-center align-middle min-h-[60px]">
                    {s ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-bold leading-tight uppercase">
                          {examType}:{subjectName}
                        </span>
                        <span className="text-[8px] italic opacity-70">
                          {teacherNames}
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

      {/* FOOTER */}
      <div className="mt-10 flex justify-between items-end">
        <div className="text-[8px] opacity-40">Généré le {new Date().toLocaleDateString('fr-FR')}</div>
        <div className="text-[8px] font-black underline">1</div>
      </div>
    </div>
  );
});

ExamTimetablePrint.displayName = "ExamTimetablePrint";

export default ExamTimetablePrint;
