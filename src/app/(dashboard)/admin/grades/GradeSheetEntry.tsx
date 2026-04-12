"use client";

import { useState } from "react";
import GradeSheetRecorder from "./GradeSheetRecorder";

interface Props {
  students: any[];
  subjects: any[];
  classes: any[];
  teachers: any[];
  classId?: number;
  term?: number;
}

export default function GradeSheetEntry({ students, subjects, classes, teachers, classId, term }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center gap-3 px-5 py-3 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50 transition-all"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition-all text-lg">📋</div>
        <div className="text-left">
          <p className="text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">Record Sheet</p>
          <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">Upload Proof + Enter Grades</p>
        </div>
      </button>

      {open && (
        <GradeSheetRecorder
          students={students}
          subjects={subjects}
          classes={classes}
          teachers={teachers}
          initialClassId={classId}
          initialTerm={term}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
