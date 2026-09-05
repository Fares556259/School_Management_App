"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { getUserAvatar } from "@/lib/avatar";
import { 
  GraduationCap, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  X, 
  Pin, 
  PinOff, 
  Users, 
  ExternalLink,
  ChevronDown,
  Sparkles,
  Layers,
  Filter,
  Loader2
} from "lucide-react";

export interface QuickStudentItem {
  id: string;
  name: string;
  surname: string;
  img?: string | null;
  sex?: string | null;
  className?: string | null;
  classId?: number | null;
  phone?: string | null;
}

interface StudentSideDrawerProps {
  currentStudentId: string;
  currentClassName?: string | null;
  students: QuickStudentItem[];
  isOpen: boolean;
  isPinned: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onTogglePin: () => void;
  onSelectStudent?: (id: string) => void;
  onPrefetchStudent?: (id: string) => void;
  onPrefetchClass?: (classId: number) => void;
  loadingStudentId?: string | null;
  activeTab?: string;
}

export function StudentBreadcrumbNav({
  currentStudentId,
  students,
  onOpenList,
  onSelectStudent,
  onPrefetchStudent,
  loadingStudentId,
  activeTab,
}: {
  currentStudentId: string;
  students: QuickStudentItem[];
  onOpenList: () => void;
  onSelectStudent?: (id: string) => void;
  onPrefetchStudent?: (id: string) => void;
  loadingStudentId?: string | null;
  activeTab?: string;
}) {
  const currentIndex = students.findIndex((s) => s.id === currentStudentId);
  const total = students.length;

  const prevStudent = currentIndex > 0 ? students[currentIndex - 1] : null;
  const nextStudent = currentIndex >= 0 && currentIndex < total - 1 ? students[currentIndex + 1] : null;
  const tabSuffix = activeTab && activeTab !== "tuition" ? `?tab=${activeTab}` : "";

  const isPrevLoading = Boolean(prevStudent && loadingStudentId === prevStudent.id);
  const isNextLoading = Boolean(nextStudent && loadingStudentId === nextStudent.id);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Index and Prev/Next buttons */}
      <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-0.5 shadow-2xs text-xs font-semibold text-slate-700">
        <a
          href={prevStudent ? `/list/students/${prevStudent.id}${tabSuffix}` : "#"}
          data-no-loader="true"
          onMouseEnter={() => prevStudent && onPrefetchStudent?.(prevStudent.id)}
          onTouchStart={() => prevStudent && onPrefetchStudent?.(prevStudent.id)}
          onClick={(e) => {
            if (!prevStudent) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            if (isPrevLoading) return;
            if (onSelectStudent) {
              onSelectStudent(prevStudent.id);
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            prevStudent 
              ? "hover:bg-slate-100 text-slate-700 hover:text-slate-900 cursor-pointer" 
              : "opacity-30 cursor-not-allowed text-slate-400 pointer-events-none"
          }`}
          title={prevStudent ? `Précédent : ${prevStudent.name} ${prevStudent.surname}` : "Premier élève"}
        >
          {isPrevLoading ? (
            <Loader2 size={13} className="animate-spin text-blue-600" />
          ) : (
            <ChevronLeft size={16} />
          )}
        </a>

        <button
          type="button"
          onClick={onOpenList}
          className="px-2 py-1 hover:bg-slate-100 rounded-md transition-colors text-[11px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
          title="Ouvrir la liste de tous les élèves"
        >
          <span>{currentIndex >= 0 ? currentIndex + 1 : "?"}</span>
          <span className="text-slate-300">/</span>
          <span>{total}</span>
        </button>

        <a
          href={nextStudent ? `/list/students/${nextStudent.id}${tabSuffix}` : "#"}
          data-no-loader="true"
          onMouseEnter={() => nextStudent && onPrefetchStudent?.(nextStudent.id)}
          onTouchStart={() => nextStudent && onPrefetchStudent?.(nextStudent.id)}
          onClick={(e) => {
            if (!nextStudent) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            if (isNextLoading) return;
            if (onSelectStudent) {
              onSelectStudent(nextStudent.id);
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            nextStudent 
              ? "hover:bg-slate-100 text-slate-700 hover:text-slate-900 cursor-pointer" 
              : "opacity-30 cursor-not-allowed text-slate-400 pointer-events-none"
          }`}
          title={nextStudent ? `Suivant : ${nextStudent.name} ${nextStudent.surname}` : "Dernier élève"}
        >
          {isNextLoading ? (
            <Loader2 size={13} className="animate-spin text-blue-600" />
          ) : (
            <ChevronRight size={16} />
          )}
        </a>
      </div>

      {/* Quick Switcher Trigger */}
      <button
        type="button"
        onClick={onOpenList}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
        title="Parcourir tous les élèves par classe"
      >
        <Users size={14} className="text-blue-600" />
        <span>Changer d&apos;élève</span>
      </button>
    </div>
  );
}

export function StudentSideDrawer({
  currentStudentId,
  currentClassName,
  students,
  isOpen,
  isPinned,
  onClose,
  onTogglePin,
  onSelectStudent,
  onPrefetchStudent,
  onPrefetchClass,
  loadingStudentId,
  activeTab,
}: StudentSideDrawerProps) {
  const [search, setSearch] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("ALL");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group all students by class name
  const { classGroups, allClassesList, currentClassCount } = useMemo(() => {
    const map = new Map<string, QuickStudentItem[]>();

    students.forEach((s) => {
      const cName = s.className || "Sans classe";
      if (!map.has(cName)) {
        map.set(cName, []);
      }
      map.get(cName)!.push(s);
    });

    const currentKey = currentClassName || "";
    let currentCount = 0;

    // Sort groups: current class first, then alphabetical
    const sortedEntries = Array.from(map.entries()).sort(([a], [b]) => {
      if (currentKey && a === currentKey) return -1;
      if (currentKey && b === currentKey) return 1;
      return a.localeCompare(b);
    });

    const groups = sortedEntries.map(([className, list]) => {
      if (currentKey && className === currentKey) {
        currentCount = list.length;
      }
      return {
        className,
        isCurrentClass: currentKey ? className === currentKey : false,
        students: list,
      };
    });

    const classNames = groups.map((g) => g.className);

    return {
      classGroups: groups,
      allClassesList: classNames,
      currentClassCount: currentCount,
    };
  }, [students, currentClassName]);

  // State to track which class accordions are expanded
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (currentClassName) {
      initial[currentClassName] = true;
    }
    return initial;
  });

  // Ensure current class is expanded if currentClassName changes
  useEffect(() => {
    if (currentClassName) {
      setExpandedClasses((prev) => ({
        ...prev,
        [currentClassName]: true,
      }));
    }
  }, [currentClassName]);

  const toggleClassAccordion = (className: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }));
  };

  const handleExpandAll = () => {
    const all: Record<string, boolean> = {};
    allClassesList.forEach((c) => {
      all[c] = true;
    });
    setExpandedClasses(all);
  };

  const handleCollapseAll = () => {
    const collapsed: Record<string, boolean> = {};
    if (currentClassName) {
      collapsed[currentClassName] = true; // Keep current class open
    }
    setExpandedClasses(collapsed);
  };

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isPinned) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPinned, onClose]);

  // Global search across all students in school
  const isSearching = Boolean(search.trim());
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = search.toLowerCase().trim();
    return students.filter((s) => {
      const fullName = `${s.name} ${s.surname}`.toLowerCase();
      const revFullName = `${s.surname} ${s.name}`.toLowerCase();
      const cName = (s.className || "").toLowerCase();
      return fullName.includes(q) || revFullName.includes(q) || cName.includes(q);
    });
  }, [students, search, isSearching]);

  // Filtered class groups when not searching
  const displayedGroups = useMemo(() => {
    if (selectedClassFilter === "ALL") {
      return classGroups;
    }
    return classGroups.filter((g) => g.className === selectedClassFilter);
  }, [classGroups, selectedClassFilter]);

  if (!isOpen && !isPinned) return null;

  return (
    <>
      {/* Backdrop for overlay drawer (when NOT pinned) */}
      {isOpen && !isPinned && (
        <div 
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-40 transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Side Panel / Drawer container */}
      <aside
        className={`fixed top-0 right-0 h-full w-[330px] sm:w-[380px] bg-white z-50 shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 ease-out ${
          isOpen || isPinned ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Annuaire des élèves par classe"
      >
        {/* 1. Drawer Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <GraduationCap size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">
                  Annuaire des Élèves
                </h2>
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-100/80 text-blue-700">
                  {students.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {classGroups.length} classes enregistrées
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Pin Toggle Button (Desktop only) */}
            <button
              type="button"
              onClick={onTogglePin}
              className={`hidden lg:flex w-8 h-8 rounded-lg items-center justify-center transition-colors ${
                isPinned 
                  ? "bg-blue-50 text-blue-600 border border-blue-200" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              }`}
              title={isPinned ? "Désépingler le volet" : "Épingler le volet sur le côté"}
            >
              {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Global Search Bar */}
        <div className="p-3 border-b border-slate-100 bg-white shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche globale (nom, prénom, classe)..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Effacer la recherche"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 3. Class Filter Quick Bar (When not searching) */}
        {!isSearching && (
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
              {/* All Classes Chip */}
              <button
                type="button"
                onClick={() => setSelectedClassFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedClassFilter === "ALL"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                }`}
              >
                Toutes ({students.length})
              </button>

              {/* Current Class Quick Chip */}
              {currentClassName && (
                <button
                  type="button"
                  onClick={() => setSelectedClassFilter(currentClassName)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    selectedClassFilter === currentClassName
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/70"
                  }`}
                >
                  <Sparkles size={11} className={selectedClassFilter === currentClassName ? "text-white" : "text-blue-500"} />
                  <span>Sa classe ({currentClassCount})</span>
                </button>
              )}

              {/* Other Class Chips */}
              {allClassesList.filter((c) => c !== currentClassName).map((cName) => {
                const group = classGroups.find((g) => g.className === cName);
                const count = group ? group.students.length : 0;
                return (
                  <button
                    key={cName}
                    type="button"
                    onClick={() => setSelectedClassFilter(cName)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedClassFilter === cName
                        ? "bg-purple-600 text-white shadow-2xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                    }`}
                  >
                    {cName} ({count})
                  </button>
                );
              })}
            </div>

            {/* Expand / Collapse All Toggle (only when viewing all classes) */}
            {selectedClassFilter === "ALL" && (
              <button
                type="button"
                onClick={() => {
                  const anyClosed = allClassesList.some((c) => !expandedClasses[c]);
                  if (anyClosed) {
                    handleExpandAll();
                  } else {
                    handleCollapseAll();
                  }
                }}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 whitespace-nowrap px-1.5 py-0.5 rounded hover:bg-slate-200/60 transition-colors shrink-0 cursor-pointer"
                title="Tout déplier ou tout replier"
              >
                {allClassesList.some((c) => !expandedClasses[c]) ? "Tout ouvrir" : "Replier"}
              </button>
            )}
          </div>
        )}

        {/* 4. Main Scrollable List Area */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {/* SEARCH MODE: Flat result list across all classes */}
          {isSearching ? (
            searchResults.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <Users size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">Aucun élève trouvé</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Aucun résultat pour « {search} » parmi les {students.length} élèves
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Résultats ({searchResults.length})</span>
                  <span className="text-[10px] font-normal text-slate-400">Toutes classes</span>
                </div>

                {searchResults.map((s) => (
                  <StudentRowItem
                    key={s.id}
                    student={s}
                    isCurrent={s.id === currentStudentId}
                    isLoading={loadingStudentId === s.id}
                    activeTab={activeTab}
                    isPinned={isPinned}
                    onClose={onClose}
                    onSelectStudent={onSelectStudent}
                    onPrefetchStudent={onPrefetchStudent}
                  />
                ))}
              </div>
            )
          ) : (
            /* GROUPED BY CLASS MODE */
            <div className="flex flex-col gap-3">
              {displayedGroups.map((group) => {
                const isCurrentClass = group.isCurrentClass;
                const isExpanded = expandedClasses[group.className] ?? isCurrentClass;

                return (
                  <div
                    key={group.className}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isCurrentClass
                        ? "bg-blue-50/20 border-blue-200/80 shadow-2xs"
                        : "bg-white border-slate-200/70"
                    }`}
                  >
                    {/* Class Accordion Header with background prefetching */}
                    <button
                      type="button"
                      onMouseEnter={() => {
                        if (group.students.length > 0 && group.students[0].classId) {
                          onPrefetchClass?.(group.students[0].classId);
                        }
                      }}
                      onTouchStart={() => {
                        if (group.students.length > 0 && group.students[0].classId) {
                          onPrefetchClass?.(group.students[0].classId);
                        }
                      }}
                      onClick={() => {
                        toggleClassAccordion(group.className);
                        if (!isExpanded && group.students.length > 0 && group.students[0].classId) {
                          onPrefetchClass?.(group.students[0].classId);
                        }
                      }}
                      className={`w-full p-3 flex items-center justify-between text-left transition-colors cursor-pointer ${
                        isCurrentClass
                          ? "bg-blue-50/60 hover:bg-blue-100/50"
                          : "bg-slate-50/70 hover:bg-slate-100/70"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isCurrentClass
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {isCurrentClass ? <Sparkles size={13} /> : <Users size={13} />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-slate-800 truncate">
                              Classe {group.className}
                            </span>
                            {isCurrentClass && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-600 text-white uppercase tracking-wider shrink-0">
                                Sa classe
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                          isCurrentClass
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-200/70 text-slate-600"
                        }`}>
                          {group.students.length}
                        </span>
                        <ChevronDown
                          size={15}
                          className={`text-slate-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {/* Class Students List (Collapsible Body) */}
                    {isExpanded && (
                      <div className="p-1.5 flex flex-col gap-1 divide-y divide-slate-100/60">
                        {group.students.map((s) => (
                          <StudentRowItem
                            key={s.id}
                            student={s}
                            isCurrent={s.id === currentStudentId}
                            isLoading={loadingStudentId === s.id}
                            activeTab={activeTab}
                            isPinned={isPinned}
                            onClose={onClose}
                            onSelectStudent={onSelectStudent}
                            onPrefetchStudent={onPrefetchStudent}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Drawer Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/80 shrink-0 flex items-center justify-between text-xs">
          <Link
            href="/list/students"
            className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 transition-colors"
          >
            <span>Tableau complet des élèves</span>
            <ExternalLink size={12} />
          </Link>

          <span className="text-[11px] text-slate-400 font-medium">
            {isSearching ? searchResults.length : students.length} élève{students.length > 1 ? "s" : ""}
          </span>
        </div>
      </aside>
    </>
  );
}

function StudentRowItem({
  student: s,
  isCurrent,
  isLoading,
  activeTab,
  isPinned,
  onClose,
  onSelectStudent,
  onPrefetchStudent,
}: {
  student: QuickStudentItem;
  isCurrent: boolean;
  isLoading?: boolean;
  activeTab?: string;
  isPinned: boolean;
  onClose?: () => void;
  onSelectStudent?: (id: string) => void;
  onPrefetchStudent?: (id: string) => void;
}) {
  const tabSuffix = activeTab && activeTab !== "tuition" ? `?tab=${activeTab}` : "";

  return (
    <a
      href={`/list/students/${s.id}${tabSuffix}`}
      data-no-loader="true"
      onMouseEnter={() => onPrefetchStudent?.(s.id)}
      onTouchStart={() => onPrefetchStudent?.(s.id)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (isLoading) return;
        if (!isPinned && onClose) onClose();
        if (onSelectStudent) {
          onSelectStudent(s.id);
        }
      }}
      className={`w-full text-left group flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
        isLoading
          ? "bg-blue-50/90 border border-blue-300 ring-2 ring-blue-400/40 animate-pulse shadow-sm"
          : isCurrent
          ? "bg-blue-50/90 border border-blue-200/90 shadow-2xs"
          : "hover:bg-slate-50/90 border border-transparent"
      }`}
    >
      {/* Avatar */}
      <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-slate-200/80 bg-slate-100 shadow-2xs">
        <Image
          src={getUserAvatar(s.img, "student", s.sex)}
          alt={`${s.name} ${s.surname}`}
          fill
          className="object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-xs font-bold truncate ${
            isLoading
              ? "text-blue-700 font-extrabold"
              : isCurrent
              ? "text-blue-950"
              : "text-slate-800 group-hover:text-blue-600"
          }`}>
            {s.name} {s.surname}
          </span>
          {isCurrent && !isLoading && (
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-600 text-white shrink-0">
              Actuel
            </span>
          )}
          {isLoading && (
            <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1 shrink-0">
              Chargement...
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
            <GraduationCap size={10} className="text-slate-400 shrink-0" />
            <span>Classe {s.className || "Non assignée"}</span>
          </span>
        </div>
      </div>

      {/* Right indicator */}
      {isLoading ? (
        <Loader2 size={15} className="animate-spin text-blue-600 shrink-0" />
      ) : !isCurrent ? (
        <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
      ) : null}
    </a>
  );
}

export function FloatingStudentNavTrigger({
  onOpen,
  totalStudents,
  isPinned,
}: {
  onOpen: () => void;
  totalStudents: number;
  isPinned: boolean;
}) {
  if (isPinned) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-l-2xl py-3 px-2 flex flex-col items-center gap-1.5 transition-transform hover:-translate-x-1 duration-200 group border-l border-t border-b border-blue-400/30 cursor-pointer"
      title="Ouvrir l'annuaire des élèves"
      aria-label="Ouvrir l'annuaire des élèves"
    >
      <GraduationCap size={16} className="group-hover:scale-110 transition-transform" />
      <span className="text-[10px] font-black leading-none bg-white text-blue-700 px-1.5 py-0.5 rounded-full shadow-2xs">
        {totalStudents}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180 opacity-90 mt-1">
        Élèves
      </span>
    </button>
  );
}
