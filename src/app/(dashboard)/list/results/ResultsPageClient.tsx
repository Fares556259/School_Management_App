"use client";

import GradeSheetRecorder from "../../admin/grades/GradeSheetRecorder";

interface Props {
  role: string | undefined;
  classes: any[];
  subjects: any[];
  teachers: any[];
  initialStudents: any[];
}

export default function ResultsPageClient({
  classes,
  subjects,
  teachers,
  initialStudents,
}: Props) {
  return (
    <div className="h-[calc(100vh-180px)] bg-slate-50 relative rounded-[32px] overflow-hidden border border-slate-200 shadow-sm">
      <GradeSheetRecorder
        students={initialStudents}
        subjects={subjects}
        classes={classes}
        teachers={teachers}
        initialClassId={classes[0]?.id}
      />
    </div>
  );
}
