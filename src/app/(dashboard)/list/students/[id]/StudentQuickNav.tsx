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
  ExternalLink
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
  students: QuickStudentItem[];
  className?: string | null;
  isOpen: boolean;
  isPinned: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onTogglePin: () => void;
  onSelectStudent?: (id: string) => void;
  activeTab?: string;
}

export function StudentBreadcrumbNav({
  currentStudentId,
  students,
  onOpenList,
  onSelectStudent,
  activeTab,
}: {
  currentStudentId: string;
  students: QuickStudentItem[];
  onOpenList: () => void;
  onSelectStudent?: (id: string) => void;
  activeTab?: string;
}) {
  const currentIndex = students.findIndex((s) => s.id === currentStudentId);
  const total = students.length;

  const prevStudent = currentIndex > 0 ? students[currentIndex - 1] : null;
  const nextStudent = currentIndex >= 0 && currentIndex < total - 1 ? students[currentIndex + 1] : null;
  const tabSuffix = activeTab && activeTab !== "tuition" ? `?tab=${activeTab}` : "";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Index and Prev/Next buttons */}
      <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-0.5 shadow-2xs text-xs font-semibold text-slate-700">
        <a
          href={prevStudent ? `/list/students/${prevStudent.id}${tabSuffix}` : "#"}
          data-no-loader="true"
          onClick={(e) => {
            if (!prevStudent) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
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
          <ChevronLeft size={16} />
        </a>

        <button
          type="button"
          onClick={onOpenList}
          className="px-2 py-1 hover:bg-slate-100 rounded-md transition-colors text-[11px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
          title="Ouvrir la liste des élèves"
        >
          <span>{currentIndex >= 0 ? currentIndex + 1 : "?"}</span>
          <span className="text-slate-300">/</span>
          <span>{total}</span>
        </button>

        <a
          href={nextStudent ? `/list/students/${nextStudent.id}${tabSuffix}` : "#"}
          data-no-loader="true"
          onClick={(e) => {
            if (!nextStudent) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
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
          <ChevronRight size={16} />
        </a>
      </div>

      {/* Quick Switcher Trigger */}
      <button
        type="button"
        onClick={onOpenList}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
        title="Parcourir les élèves de la classe"
      >
        <Users size={14} className="text-blue-600" />
        <span>Changer d&apos;élève</span>
      </button>
    </div>
  );
}

export function StudentSideDrawer({
  currentStudentId,
  students,
  className,
  isOpen,
  isPinned,
  onClose,
  onTogglePin,
  onSelectStudent,
  activeTab,
}: StudentSideDrawerProps) {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase().trim();
    return students.filter((s) => {
      const fullName = `${s.name} ${s.surname}`.toLowerCase();
      return fullName.includes(q) || (s.className && s.className.toLowerCase().includes(q));
    });
  }, [students, search]);

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
        className={`fixed top-0 right-0 h-full w-[320px] sm:w-[350px] bg-white z-50 shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 ease-out ${
          isOpen || isPinned ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Liste des élèves"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <GraduationCap size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">
                  {className ? `Classe : ${className}` : "Élèves"}
                </h2>
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {students.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Navigation rapide entre élèves</p>
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
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              title="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-100 bg-white shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom d'élève..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Students List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-50 custom-scrollbar">
          {filteredStudents.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Users size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Aucun élève trouvé</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Essayez un autre terme de recherche</p>
            </div>
          ) : (
            filteredStudents.map((s) => {
              const isCurrent = s.id === currentStudentId;
              const tabSuffix = activeTab && activeTab !== "tuition" ? `?tab=${activeTab}` : "";

              return (
                <a
                  key={s.id}
                  href={`/list/students/${s.id}${tabSuffix}`}
                  data-no-loader="true"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    if (!isPinned && onClose) onClose();
                    if (onSelectStudent) {
                      onSelectStudent(s.id);
                    }
                  }}
                  className={`w-full text-left group flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-blue-50/80 border border-blue-200/80 shadow-2xs"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-200/80 bg-slate-100 shadow-2xs">
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
                        isCurrent ? "text-blue-950" : "text-slate-800 group-hover:text-blue-600"
                      }`}>
                        {s.name} {s.surname}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-600 text-white shrink-0">
                          Actuel
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
                        <GraduationCap size={10} className="text-slate-400 shrink-0" />
                        <span>{s.className || "Classe non assignée"}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right indicator */}
                  {!isCurrent && (
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
                  )}
                </a>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/80 shrink-0 flex items-center justify-between text-xs">
          <Link
            href="/list/students"
            className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 transition-colors"
          >
            <span>Tableau complet des élèves</span>
            <ExternalLink size={12} />
          </Link>

          <span className="text-[11px] text-slate-400">
            {filteredStudents.length} affiché{filteredStudents.length > 1 ? "s" : ""}
          </span>
        </div>
      </aside>
    </>
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
      title="Ouvrir la liste des élèves"
      aria-label="Ouvrir la liste des élèves"
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
