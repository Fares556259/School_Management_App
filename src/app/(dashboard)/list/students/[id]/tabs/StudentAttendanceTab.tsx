"use client";

import { useState, useMemo, useTransition } from "react";
import { 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  FileCheck, 
  Filter, 
  ShieldAlert, 
  BookOpen,
  User,
  Check,
  X
} from "lucide-react";
import { updateAttendanceJustification } from "../actions";

interface AttendanceRecord {
  id: number;
  date: Date | string;
  status: "PRESENT" | "ABSENT" | "LATE";
  note?: string | null;
  justificationStatus?: string | null;
  justificationNote?: string | null;
  lesson?: {
    id: number;
    name?: string | null;
    subject?: {
      id: number;
      name: string;
    } | null;
    teacher?: {
      name: string;
      surname: string;
    } | null;
  } | null;
}

interface StudentAttendanceTabProps {
  studentId: string;
  studentName: string;
  attendances: AttendanceRecord[];
  isAdmin: boolean;
}

export default function StudentAttendanceTab({
  studentId,
  studentName,
  attendances: initialAttendances = [],
  isAdmin,
}: StudentAttendanceTabProps) {
  const [attendances, setAttendances] = useState<AttendanceRecord[]>(initialAttendances);
  const [filter, setFilter] = useState<"ALL" | "UNEXCUSED" | "EXCUSED" | "LATE" | "PRESENT">("ALL");
  const [isPending, startTransition] = useTransition();
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
  const [justificationInput, setJustificationInput] = useState("");

  // Statistics calculation
  const stats = useMemo(() => {
    const total = attendances.length;
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;
    let unexcused = 0;

    attendances.forEach((a) => {
      if (a.status === "PRESENT") present++;
      else if (a.status === "LATE") late++;
      else if (a.status === "ABSENT") {
        absent++;
        if (a.justificationStatus === "APPROVED" || a.justificationStatus === "EXCUSED") {
          excused++;
        } else {
          unexcused++;
        }
      }
    });

    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

    return {
      total,
      present,
      late,
      absent,
      excused,
      unexcused,
      rate,
    };
  }, [attendances]);

  // Filtered attendances
  const filteredList = useMemo(() => {
    return attendances.filter((a) => {
      if (filter === "ALL") return true;
      if (filter === "PRESENT") return a.status === "PRESENT";
      if (filter === "LATE") return a.status === "LATE";
      if (filter === "EXCUSED") {
        return a.status === "ABSENT" && (a.justificationStatus === "APPROVED" || a.justificationStatus === "EXCUSED");
      }
      if (filter === "UNEXCUSED") {
        return a.status === "ABSENT" && a.justificationStatus !== "APPROVED" && a.justificationStatus !== "EXCUSED";
      }
      return true;
    });
  }, [attendances, filter]);

  const handleUpdateJustification = (attId: number, status: "APPROVED" | "REJECTED", note?: string) => {
    startTransition(async () => {
      const res = await updateAttendanceJustification(attId, status, note);
      if (res.success) {
        setAttendances((prev) =>
          prev.map((a) =>
            a.id === attId ? { ...a, justificationStatus: status, justificationNote: note || a.justificationNote } : a
          )
        );
        setSelectedAttendance(null);
        setJustificationInput("");
      }
    });
  };

  const formatDate = (d: Date | string) => {
    try {
      return new Date(d).toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(d);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. TOP HEADER */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-800">
              Assiduité & Ponctualité
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Suivi des présences, des absences justifiées ou non, et des retards enregistrés.
          </p>
        </div>

        {/* Attendance Rate Pill */}
        <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 self-start sm:self-auto ${
          stats.rate >= 90 
            ? "bg-emerald-50/80 border-emerald-200 text-emerald-800" 
            : stats.rate >= 80 
            ? "bg-amber-50/80 border-amber-200 text-amber-800" 
            : "bg-rose-50/80 border-rose-200 text-rose-800"
        }`}>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75 leading-none">
              Taux d&apos;assiduité
            </span>
            <span className="text-xl font-black mt-0.5 block leading-none">
              {stats.rate}%
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center font-bold">
            {stats.rate >= 90 ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          </div>
        </div>
      </div>

      {/* 2. 4 KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Taux Global */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Présence</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-800">{stats.present}</span>
            <span className="text-xs text-slate-400 ml-1 font-medium">/ {stats.total} séances</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Séances assistées</p>
          </div>
        </div>

        {/* Absences Injustifiées */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Injustifiées</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert size={14} />
            </div>
          </div>
          <div className="mt-2">
            <span className={`text-2xl font-black ${stats.unexcused > 0 ? "text-rose-600" : "text-slate-800"}`}>
              {stats.unexcused}
            </span>
            <span className="text-xs text-slate-400 ml-1 font-medium">manquées</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Sans motif validé</p>
          </div>
        </div>

        {/* Absences Justifiées */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Justifiées</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileCheck size={14} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-800">{stats.excused}</span>
            <span className="text-xs text-slate-400 ml-1 font-medium">séances</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Motif ou certificat</p>
          </div>
        </div>

        {/* Retards */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Retards</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={14} />
            </div>
          </div>
          <div className="mt-2">
            <span className={`text-2xl font-black ${stats.late > 0 ? "text-amber-600" : "text-slate-800"}`}>
              {stats.late}
            </span>
            <span className="text-xs text-slate-400 ml-1 font-medium">enregistrés</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Arrivées tardives</p>
          </div>
        </div>
      </div>

      {/* 3. FILTER TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={filter === "ALL"}
          onClick={() => setFilter("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            filter === "ALL" 
              ? "bg-slate-900 text-white shadow-2xs" 
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60"
          }`}
        >
          Tous ({attendances.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={filter === "UNEXCUSED"}
          onClick={() => setFilter("UNEXCUSED")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            filter === "UNEXCUSED" 
              ? "bg-rose-600 text-white shadow-2xs" 
              : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200/60"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span>Non justifiées ({stats.unexcused})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={filter === "EXCUSED"}
          onClick={() => setFilter("EXCUSED")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            filter === "EXCUSED" 
              ? "bg-blue-600 text-white shadow-2xs" 
              : "bg-white text-blue-700 hover:bg-blue-50 border border-blue-200/60"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>Justifiées ({stats.excused})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={filter === "LATE"}
          onClick={() => setFilter("LATE")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            filter === "LATE" 
              ? "bg-amber-500 text-white shadow-2xs" 
              : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200/60"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>Retards ({stats.late})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={filter === "PRESENT"}
          onClick={() => setFilter("PRESENT")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            filter === "PRESENT" 
              ? "bg-emerald-600 text-white shadow-2xs" 
              : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200/60"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Présences ({stats.present})</span>
        </button>
      </div>

      {/* 4. ATTENDANCE LOG TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {filteredList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Séance / Matière</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Justification & Motif</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((record) => {
                  const isExcused = record.status === "ABSENT" && (record.justificationStatus === "APPROVED" || record.justificationStatus === "EXCUSED");
                  const isUnexcused = record.status === "ABSENT" && !isExcused;
                  const subjectName = record.lesson?.subject?.name?.split("|")[0].trim() || record.lesson?.name || "Séance";
                  const teacherName = record.lesson?.teacher ? `${record.lesson.teacher.name} ${record.lesson.teacher.surname}` : null;

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{formatDate(record.date)}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{subjectName}</span>
                          {teacherName && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <User size={10} />
                              {teacherName}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {record.status === "PRESENT" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} />
                            Présent
                          </span>
                        )}
                        {record.status === "LATE" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={11} />
                            En retard
                          </span>
                        )}
                        {record.status === "ABSENT" && (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isExcused 
                              ? "bg-blue-50 text-blue-700 border border-blue-200" 
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            <XCircle size={11} />
                            Absent
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {record.status === "ABSENT" ? (
                          isExcused ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                <Check size={12} />
                                Justifiée
                              </span>
                              {record.justificationNote && (
                                <span className="text-[11px] text-slate-500 italic mt-0.5">
                                  « {record.justificationNote} »
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                              <X size={12} />
                              Non justifiée
                            </span>
                          )
                        ) : record.note ? (
                          <span className="text-[11px] text-slate-500">{record.note}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {isAdmin && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {record.status === "ABSENT" && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAttendance(record);
                                setJustificationInput(record.justificationNote || "");
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              {isExcused ? "Modifier" : "Justifier"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              Aucun incident d&apos;assiduité
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Tous les enregistrements correspondent à une présence normale ou aucun événement ne correspond au filtre sélectionné.
            </p>
          </div>
        )}
      </div>

      {/* 5. JUSTIFICATION MODAL FOR ADMIN */}
      {selectedAttendance && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Gérer la justification d&apos;absence
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Date : {formatDate(selectedAttendance.date)} · Séance : {selectedAttendance.lesson?.subject?.name?.split("|")[0] || "Séance"}
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Motif ou certificat médical (optionnel)
                </label>
                <textarea
                  value={justificationInput}
                  onChange={(e) => setJustificationInput(e.target.value)}
                  placeholder="Ex : Certificat médical remis par les parents le 15/10..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setSelectedAttendance(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleUpdateJustification(selectedAttendance.id, "REJECTED", "")}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs hover:bg-rose-100 cursor-pointer"
                >
                  Marquer Injustifiée
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleUpdateJustification(selectedAttendance.id, "APPROVED", justificationInput)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-xs cursor-pointer"
                >
                  Valider la Justification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
