"use client";

import { useState, useTransition } from "react";
import { User, CheckCircle2, AlertCircle, Save, FileText } from "lucide-react";
import Link from "next/link";

interface Subject {
  id: number;
  name: string;
  domain: string;
}

interface GradeEntry {
  subjectId: number;
  score: number;
}

interface Student {
  id: string;
  name: string;
  surname: string;
  grades: {
    subjectId: number;
    score: number;
  }[];
}

const subjectTranslations: Record<string, string> = {
  // Arabic Language Domain
  "Arabic Communication": "تواصل شفوي",
  "Reading": "قراءة",
  "Writing": "إنتاج كتابي",
  "Grammar": "قواعد اللغة",
  // Science & Technology Domain
  "Mathematics": "رياضيات",
  "Scientific Activities": "أيقاظ علمي",
  "Technology": "تكنولوجيا",
  // Discovery/Social Domain
  "Islamic Education": "تربية إسلامية",
  "History": "تاريخ",
  "Geography": "جغرافيا",
  "Civic Education": "تربية مدنية",
  "Artistic Education": "تربية تشكيلية",
  "Plastic Arts": "تربية تشكيلية",
  "Music Education": "تربية موسيقية",
  "Physical Education": "تربية بدنية",
  // Foreign Languages
  "French Oral Expression": "تواصل شفوي (فرنسية)",
  "French Reading": "قراءة (فرنسية)",
  "French Written Production": "إنتاج كتابي (فرنسية)",
  "English": "إنقليزية",
};

export default function GradeEntryForm({
  students,
  subjects,
  term,
  classId,
}: {
  students: Student[];
  subjects: Subject[];
  term: number;
  classId: number;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    students[0]?.id || null
  );
  const [localGrades, setLocalGrades] = useState<Record<string, Record<number, number>>>(() => {
    const initial: Record<string, Record<number, number>> = {};
    students.forEach(s => {
      initial[s.id] = {};
      s.grades.forEach(g => {
        initial[s.id][g.subjectId] = g.score;
      });
    });
    return initial;
  });

  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const handleScoreChange = (studentId: string, subjectId: number, value: string) => {
    let num = parseFloat(value);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 20) num = 20;

    setLocalGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: num
      }
    }));
    setSaveStatus("idle");
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedStudentId) return;
    
    setSaveStatus("saving");
    const scores = Object.entries(localGrades[selectedStudentId]).map(([subId, score]) => ({
      subjectId: parseInt(subId),
      score,
    }));

    try {
      const res = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          term,
          scores,
        }),
      });

      if (res.ok) {
        setSaveStatus("success");
        setIsDirty(false);
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      setSaveStatus("error");
    }
  };

  // Group subjects by domain
  const domains = Array.from(new Set(subjects.map(s => s.domain)));

  const calculateAverages = (studentId: string) => {
    const scores = Object.values(localGrades[studentId] || {});
    if (scores.length === 0) return 0;
    const total = scores.reduce((acc, s) => acc + s, 0);
    return (total / subjects.length).toFixed(2);
  };

  if (students.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl opacity-50">👥</span>
        </div>
        <p className="text-slate-500 font-bold">No students found in this class.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
      {/* Student List Sidebar */}
      <div className="w-full lg:w-72 bg-white rounded-[24px] shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Students</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {students.map((student) => (
            <button
              key={student.id}
              onClick={() => setSelectedStudentId(student.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                selectedStudentId === student.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "hover:bg-slate-50 text-slate-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    selectedStudentId === student.id ? "bg-white/20" : "bg-slate-100"
                }`}>
                    {student.name[0]}
                </div>
                <div className="flex flex-col items-start">
                    <span className="text-sm font-bold truncate max-w-[120px]">{student.name}</span>
                    <span className={`text-[10px] ${selectedStudentId === student.id ? "text-indigo-100" : "text-slate-400"}`}>
                        Avg: {calculateAverages(student.id)}
                    </span>
                </div>
              </div>
              {selectedStudentId === student.id && <CheckCircle2 size={14} />}
            </button>
          ))}
        </div>
      </div>

      {/* Grade Entry Matrix */}
      <div className="flex-1 flex flex-col bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
        {selectedStudent ? (
          <>
            <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center">
                    <User size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">{selectedStudent.name} {selectedStudent.surname}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-md uppercase tracking-widest">طالب</span>
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-widest">الثلاثي {term}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/grades/${selectedStudent.id}/report-card?term=${term}`}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all"
                >
                  <FileText size={14} />
                  عرض بطاقة الأعداد
                </Link>
                {(isDirty || saveStatus !== "idle") && (
                  <button
                    onClick={handleSave}
                    disabled={saveStatus === "saving"}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black text-xs transition-all shadow-md animate-in fade-in zoom-in duration-300 ${
                      saveStatus === "success" 
                        ? "bg-emerald-500 text-white shadow-emerald-100" 
                        : saveStatus === "error" 
                        ? "bg-rose-500 text-white shadow-rose-100"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                    }`}
                  >
                    {saveStatus === "saving" ? (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : saveStatus === "success" ? (
                      <CheckCircle2 size={14} />
                    ) : saveStatus === "error" ? (
                      <AlertCircle size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {saveStatus === "saving" ? "جاري الحفظ..." : saveStatus === "success" ? "تم الحفظ!" : saveStatus === "error" ? "خطأ" : "حفظ الأعداد"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-slim">
              <div className="space-y-8">
                {domains.map((domain) => (
                  <div key={domain} className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-4 w-1 bg-indigo-500 rounded-full" />
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          {domain === "Arabic Language Domain" ? "مجال اللغة العربية" :
                           domain === "Science & Technology Domain" ? "مجال العلوم والتكنولوجيا" :
                           domain === "Discovery Domain" ? "مجال التنشئة" :
                           domain === "Foreign Languages Domain" ? "مجال اللغات الأجنبية" : 
                           domain}
                        </h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subjects
                        .filter((s) => s.domain === domain)
                        .map((subject) => (
                          <div 
                            key={subject.id} 
                            className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-indigo-100 transition-all"
                          >
                            <label className="flex flex-col">
                              <span className="text-sm font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                                {subject.name}
                              </span>
                              {subjectTranslations[subject.name] && (
                                <span className="text-[10px] font-bold text-slate-400">
                                  {subjectTranslations[subject.name]}
                                </span>
                              )}
                            </label>
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                step="0.5"
                                value={localGrades[selectedStudentId!]?.[subject.id] ?? ""}
                                onChange={(e) => handleScoreChange(selectedStudentId!, subject.id, e.target.value)}
                                className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none text-center"
                              />
                              <span className="text-[10px] font-black text-slate-400">/ 20</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Term {term} Overview for {selectedStudent.name}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">General Average:</span>
                    <span className="text-sm font-black text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">
                        {calculateAverages(selectedStudent.id)}
                    </span>
                </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 font-bold">
            Select a student to enter grades
          </div>
        )}
      </div>
    </div>
  );
}
