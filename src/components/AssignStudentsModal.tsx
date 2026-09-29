"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import {
  Users,
  Search,
  X,
  Check,
  Loader2,
  Plus,
  CheckSquare,
  Square,
  UserCheck,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { assignStudentsToClass } from "@/lib/crudActions";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { fetchAllStudentsOptionAction } from "@/app/(dashboard)/list/classes/actions";

interface StudentOption {
  id: string;
  name: string;
  surname: string;
  nationalId?: string | null;
  classId?: number | null;
  class: { id?: number; name: string } | null;
  levelId?: number;
  level?: { id: number; level: number } | null;
}

interface AssignStudentsModalProps {
  classId: number;
  className: string;
  levelNumber?: number;
  capacity?: number;
}

export default function AssignStudentsModal({
  classId,
  className,
  levelNumber,
  capacity = 30,
}: AssignStudentsModalProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"unassigned" | "enrolled" | "all">("unassigned");
  const [filterLevelOnly, setFilterLevelOnly] = useState(true);

  // Initialize and fetch students of this level
  const handleOpen = async () => {
    setOpen(true);
    setError("");
    setSearch("");
    setLoading(true);
    setActiveTab("unassigned");

    try {
      // Fetch students belonging to this class's level
      const lvlParam = filterLevelOnly && levelNumber !== undefined ? levelNumber : undefined;
      const allStudents = (await fetchAllStudentsOptionAction(lvlParam)) as StudentOption[];
      setStudents(allStudents);

      // Pre-select students already in this class
      const currentClassStudentIds = allStudents
        .filter((s) => s.classId === classId || s.class?.name === className)
        .map((s) => s.id);
      setSelectedIds(currentClassStudentIds);

      // If no unassigned students in this level, default to "all"
      const unassignedCount = allStudents.filter((s) => !s.classId).length;
      if (unassignedCount === 0) {
        setActiveTab("all");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des élèves.");
    } finally {
      setLoading(false);
    }
  };

  // Refetch when toggling level scope
  const handleToggleLevelFilter = async (onlyThisLevel: boolean) => {
    setFilterLevelOnly(onlyThisLevel);
    setLoading(true);
    try {
      const lvlParam = onlyThisLevel && levelNumber !== undefined ? levelNumber : undefined;
      const allStudents = (await fetchAllStudentsOptionAction(lvlParam)) as StudentOption[];
      setStudents(allStudents);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection for a single student
  const toggleStudent = (studentId: string) => {
    setSelectedIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Categorize students
  const unassignedStudents = useMemo(() => {
    return students.filter((s) => !s.classId);
  }, [students]);

  const enrolledInThisClassStudents = useMemo(() => {
    return students.filter((s) => s.classId === classId || s.class?.name === className);
  }, [students, classId, className]);

  // Tab filtered students
  const tabStudents = useMemo(() => {
    if (activeTab === "unassigned") return unassignedStudents;
    if (activeTab === "enrolled") return enrolledInThisClassStudents;
    return students;
  }, [activeTab, unassignedStudents, enrolledInThisClassStudents, students]);

  // Search filtered students
  const visibleStudents = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return tabStudents;

    return tabStudents.filter((student) => {
      const fullName = `${student.name} ${student.surname}`.toLowerCase();
      const nationalId = String(student.nationalId || "").toLowerCase();
      const currentClassName = String(student.class?.name || "").toLowerCase();
      return (
        fullName.includes(s) ||
        nationalId.includes(s) ||
        currentClassName.includes(s)
      );
    });
  }, [tabStudents, search]);

  // Select all / Deselect all in current view
  const areAllVisibleSelected = useMemo(() => {
    if (visibleStudents.length === 0) return false;
    return visibleStudents.every((s) => selectedIds.includes(s.id));
  }, [visibleStudents, selectedIds]);

  const toggleSelectAllVisible = () => {
    const visibleIds = visibleStudents.map((s) => s.id);
    if (areAllVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const set = new Set([...prev, ...visibleIds]);
        return Array.from(set);
      });
    }
  };

  const handleSave = () => {
    setError("");
    startTransition(async () => {
      const result = await assignStudentsToClass(classId, selectedIds);
      if (result.success) {
        toast.success(
          t.toasts?.assignmentsUpdated || `Affectation des élèves à ${className} enregistrée !`
        );
        setOpen(false);
        router.refresh();
      } else {
        const errMsg =
          result.error || t.toasts?.assignmentsUpdateFailed || "Échec de l'affectation des élèves.";
        toast.error(errMsg);
        setError(errMsg);
      }
    });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 border border-purple-600 text-purple-600 bg-white hover:bg-purple-50 px-4 py-2 rounded-[10px] text-[14px] font-medium transition-colors shadow-sm shrink-0"
        title="Affecter des élèves à cette classe"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.5} />}
        <span>{t.classStudents?.addStudents || "Ajouter des élèves"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* BACKDROP */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isPending && setOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* MODAL CONTAINER */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[16px] w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] relative overflow-hidden z-10"
            >
              {/* HEADER */}
              <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-[20px] font-bold text-[#181d26] tracking-tight">
                      Affecter des élèves à {className}
                    </h3>
                    {levelNumber !== undefined && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Niveau {levelNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[13px] font-medium mt-1">
                    Répartissez et inscrivez les élèves du{" "}
                    <b>Niveau {levelNumber ?? ""}</b> dans la classe <b>{className}</b>
                  </p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => setOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-[10px] transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              {/* TABS & LEVEL SCOPE TOGGLE */}
              <div className="px-6 pt-4 pb-2 border-b border-slate-200 bg-white flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  {/* TABS */}
                  <div className="flex p-1 bg-slate-100 rounded-[10px] border border-slate-200/80 text-[13px] font-semibold gap-1">
                    <button
                      onClick={() => setActiveTab("unassigned")}
                      className={`px-3 py-1.5 rounded-[8px] transition-all flex items-center gap-2 ${
                        activeTab === "unassigned"
                          ? "bg-white text-emerald-700 shadow-sm border border-slate-200/50"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <UserPlus size={15} />
                      <span>Non classés</span>
                      <span
                        className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                          activeTab === "unassigned"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {unassignedStudents.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab("enrolled")}
                      className={`px-3 py-1.5 rounded-[8px] transition-all flex items-center gap-2 ${
                        activeTab === "enrolled"
                          ? "bg-white text-indigo-700 shadow-sm border border-slate-200/50"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <UserCheck size={15} />
                      <span>Dans {className}</span>
                      <span
                        className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                          activeTab === "enrolled"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {enrolledInThisClassStudents.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab("all")}
                      className={`px-3 py-1.5 rounded-[8px] transition-all flex items-center gap-2 ${
                        activeTab === "all"
                          ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Users size={15} />
                      <span>Tous ({students.length})</span>
                    </button>
                  </div>

                  {/* LEVEL FILTER TOGGLE */}
                  {levelNumber !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-medium">Portée :</span>
                      <button
                        onClick={() => handleToggleLevelFilter(true)}
                        className={`px-2.5 py-1 rounded-md font-semibold border transition-all ${
                          filterLevelOnly
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        Niveau {levelNumber} uniquement
                      </button>
                      <button
                        onClick={() => handleToggleLevelFilter(false)}
                        className={`px-2.5 py-1 rounded-md font-semibold border transition-all ${
                          !filterLevelOnly
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        Tous les niveaux
                      </button>
                    </div>
                  )}
                </div>

                {/* SEARCH INPUT & BULK ACTION */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="Rechercher par nom, prénom ou المعرف التربوي..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-[8px] pl-10 pr-9 py-2 text-[13.5px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={toggleSelectAllVisible}
                    disabled={visibleStudents.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-[8px] text-xs font-semibold text-slate-700 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {areAllVisibleSelected ? (
                      <>
                        <Square size={14} className="text-slate-400" />
                        <span>Tout désélectionner</span>
                      </>
                    ) : (
                      <>
                        <CheckSquare size={14} className="text-indigo-600" />
                        <span>Tout sélectionner ({visibleStudents.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* STUDENTS LIST */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2 min-h-[320px] max-h-[460px] bg-slate-50/50">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
                    <Loader2 size={28} className="animate-spin text-indigo-600" />
                    <p className="text-sm font-medium">Chargement des élèves du niveau...</p>
                  </div>
                ) : visibleStudents.length > 0 ? (
                  visibleStudents.map((student) => {
                    const isSelected = selectedIds.includes(student.id);
                    const isOriginallyInThisClass =
                      student.classId === classId || student.class?.name === className;
                    const isOriginallyUnassigned = !student.classId;
                    const isOriginallyInOtherClass =
                      !isOriginallyInThisClass && !isOriginallyUnassigned;

                    return (
                      <motion.div
                        layout
                        key={student.id}
                        onClick={() => toggleStudent(student.id)}
                        className={`flex items-center justify-between p-3.5 rounded-[10px] border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50/60 border-indigo-300 shadow-sm"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* CHECKBOX */}
                          <div
                            className={`w-5 h-5 rounded-[5px] border flex items-center justify-center transition-colors shrink-0 ${
                              isSelected
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-white border-slate-300"
                            }`}
                          >
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </div>

                          {/* AVATAR / INITIALS */}
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSelected
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {student.name.charAt(0)}
                            {student.surname?.charAt(0) || ""}
                          </div>

                          {/* NAME & NATIONAL ID */}
                          <div className="flex flex-col leading-snug">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-bold text-slate-800">
                                {student.name} {student.surname || ""}
                              </span>
                              {student.nationalId && (
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-mono px-1.5 py-0.2 rounded font-semibold">
                                  🆔 {student.nationalId}
                                </span>
                              )}
                            </div>

                            {/* CURRENT STATUS */}
                            <span className="text-[12px] font-medium mt-0.5">
                              {isSelected ? (
                                isOriginallyInThisClass ? (
                                  <span className="text-indigo-600">✓ Reste dans {className}</span>
                                ) : isOriginallyUnassigned ? (
                                  <span className="text-emerald-600 font-semibold">
                                    ✓ Sera affecté à {className}
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-semibold">
                                    ⇄ Sera transféré de {student.class?.name} vers {className}
                                  </span>
                                )
                              ) : (
                                isOriginallyInThisClass ? (
                                  <span className="text-rose-600 font-semibold">
                                    ✗ Retiré de {className} (deviendra non classé)
                                  </span>
                                ) : isOriginallyUnassigned ? (
                                  <span className="text-slate-500">Non classé (disponible)</span>
                                ) : (
                                  <span className="text-slate-500">
                                    Déjà inscrit en {student.class?.name}
                                  </span>
                                )
                              )}
                            </span>
                          </div>
                        </div>

                        {/* RIGHT BADGE */}
                        <div className="flex items-center gap-2">
                          {isOriginallyUnassigned ? (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Non classé
                            </span>
                          ) : isOriginallyInThisClass ? (
                            <span className="text-[11px] font-bold text-indigo-800 bg-indigo-100/80 border border-indigo-200 px-2 py-0.5 rounded-full">
                              Dans {className}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              {student.class?.name}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-[12px] bg-white p-6">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                      <Users size={22} />
                    </div>
                    <h5 className="text-[14.5px] font-bold text-slate-800 mb-1">
                      {search ? "Aucun élève trouvé" : "Aucun élève dans cette catégorie"}
                    </h5>
                    <p className="text-[12.5px] text-slate-500 max-w-sm">
                      {search
                        ? "Essayez de modifier votre recherche par nom ou المعرف التربوي."
                        : activeTab === "unassigned"
                        ? "Tous les élèves de ce niveau ont déjà été répartis dans des classes !"
                        : "Consultez l'onglet « Tous » pour visualiser l'ensemble des élèves du niveau."}
                    </p>
                  </div>
                )}
              </div>

              {/* FOOTER */}
              <div className="p-5 border-t border-slate-200 bg-white flex flex-col gap-3">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] flex items-center gap-2 text-rose-700 text-xs font-semibold">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-bold text-slate-800">
                      {selectedIds.length} élève(s) sélectionné(s)
                    </span>
                    <span className="text-slate-400 text-xs">•</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                        selectedIds.length > capacity
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      Capacité : {selectedIds.length} / {capacity}
                    </span>
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setOpen(false)}
                      className="px-5 py-2.5 bg-white border border-slate-300 rounded-[10px] text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleSave}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-[10px] text-[13.5px] font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          <span>Enregistrement...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Enregistrer l&apos;affectation</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

