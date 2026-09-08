"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { getUserAvatar } from "@/lib/avatar";
import { 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  X, 
  Pin, 
  PinOff, 
  BookOpen, 
  ExternalLink
} from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";

export interface QuickTeacherItem {
  id: string;
  name: string;
  surname: string;
  img?: string | null;
  sex?: string | null;
  activated?: boolean;
  subjects?: { id: number; name: string }[];
}

interface TeacherSideDrawerProps {
  currentTeacherId: string;
  teachers: QuickTeacherItem[];
  isOpen: boolean;
  isPinned?: boolean;
  onToggleOpen?: () => void;
  onClose: () => void;
  onTogglePin?: () => void;
  onSelectTeacher?: (id: string) => void;
  onPrefetchTeacher?: (id: string) => void;
  activeTab?: string;
}

export function TeacherBreadcrumbNav({
  currentTeacherId,
  teachers,
  onOpenList,
  onSelectTeacher,
  onPrefetchTeacher,
  activeTab,
}: {
  currentTeacherId: string;
  teachers: QuickTeacherItem[];
  onOpenList: () => void;
  onSelectTeacher?: (id: string) => void;
  onPrefetchTeacher?: (id: string) => void;
  activeTab?: string;
}) {
  const { t, locale } = useLanguage();
  const currentIndex = teachers.findIndex((t) => t.id === currentTeacherId);
  const total = teachers.length;

  const prevTeacher = currentIndex > 0 ? teachers[currentIndex - 1] : null;
  const nextTeacher = currentIndex >= 0 && currentIndex < total - 1 ? teachers[currentIndex + 1] : null;
  const tabSuffix = activeTab && activeTab !== "finance" ? `?tab=${activeTab}` : "";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Index and Prev/Next buttons */}
      <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-0.5 shadow-2xs text-xs font-semibold text-slate-700">
        <a
          href={prevTeacher ? `/list/teachers/${prevTeacher.id}${tabSuffix}` : "#"}
          data-no-loader="true"
          onMouseEnter={() => { if (prevTeacher && onPrefetchTeacher) onPrefetchTeacher(prevTeacher.id); }}
          onClick={(e) => {
            if (!prevTeacher) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            if (onSelectTeacher) {
              onSelectTeacher(prevTeacher.id);
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            prevTeacher 
              ? "hover:bg-slate-100 text-slate-700 hover:text-slate-900 cursor-pointer" 
              : "opacity-30 cursor-not-allowed text-slate-400 pointer-events-none"
          }`}
          title={prevTeacher ? t.teacherProfile.directory.prevTeacher.replace("{name}", `${prevTeacher.name} ${prevTeacher.surname}`) : t.teacherProfile.directory.firstTeacher}
        >
          <ChevronLeft size={16} className={locale === "ar" ? "rotate-180" : ""} />
        </a>

        <button
          type="button"
          onClick={onOpenList}
          className="px-2 py-1 hover:bg-slate-100 rounded-md transition-colors text-[11px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
          title={t.teacherProfile.directory.allTeachersTooltip}
        >
          <span>{currentIndex >= 0 ? currentIndex + 1 : "?"}</span>
          <span className="text-slate-300">/</span>
          <span>{total}</span>
        </button>

        <a
          href={nextTeacher ? `/list/teachers/${nextTeacher.id}${tabSuffix}` : "#"}
          data-no-loader="true"
          onMouseEnter={() => { if (nextTeacher && onPrefetchTeacher) onPrefetchTeacher(nextTeacher.id); }}
          onClick={(e) => {
            if (!nextTeacher) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            if (onSelectTeacher) {
              onSelectTeacher(nextTeacher.id);
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            nextTeacher 
              ? "hover:bg-slate-100 text-slate-700 hover:text-slate-900 cursor-pointer" 
              : "opacity-30 cursor-not-allowed text-slate-400 pointer-events-none"
          }`}
          title={nextTeacher ? t.teacherProfile.directory.nextTeacher.replace("{name}", `${nextTeacher.name} ${nextTeacher.surname}`) : t.teacherProfile.directory.lastTeacher}
        >
          <ChevronRight size={16} className={locale === "ar" ? "rotate-180" : ""} />
        </a>
      </div>

      {/* Quick Switcher Trigger */}
      <button
        type="button"
        onClick={onOpenList}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
        title={t.teacherProfile.directory.allTeachersTooltip}
      >
        <Users size={14} className="text-indigo-600" />
        <span>{t.teacherProfile.directory.switchTeacher}</span>
      </button>
    </div>
  );
}

export function TeacherSideDrawer({
  currentTeacherId,
  teachers,
  isOpen,
  isPinned,
  onClose,
  onTogglePin,
  onSelectTeacher,
  onPrefetchTeacher,
  activeTab,
}: TeacherSideDrawerProps) {
  const { t, locale } = useLanguage();
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

  const filteredTeachers = useMemo(() => {
    if (!search.trim()) return teachers;
    const q = search.toLowerCase().trim();
    return teachers.filter((t) => {
      const fullName = `${t.name} ${t.surname}`.toLowerCase();
      const subjectMatch = (t.subjects || []).some((s) => s.name.toLowerCase().includes(q));
      return fullName.includes(q) || subjectMatch;
    });
  }, [teachers, search]);

  if (!isOpen) return null;

  const renderDrawerBody = (isMobile = false) => (
    <div className="flex flex-col h-full bg-white">
      {/* Drawer Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Users size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800 truncate">{t.teacherProfile.directory.teachersTitle}</h2>
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-100/80 text-indigo-700 shrink-0">
                {teachers.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">{t.teacherProfile.directory.quickNav}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
            title={t.teacherProfile.directory.hideDirectory}
            aria-label={t.teacherProfile.directory.hideDirectory}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2.5 border-b border-slate-100 bg-white shrink-0">
        <div className="relative">
          <Search size={15} className={`absolute ${locale === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`} />
          <input
            ref={isMobile ? undefined : searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.teacherProfile.directory.searchPlaceholder}
            className={`w-full bg-slate-50 border border-slate-200/80 rounded-xl ${locale === "ar" ? "pr-9 pl-8" : "pl-9 pr-8"} py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className={`absolute ${locale === "ar" ? "left-2.5" : "right-2.5"} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer`}
              title="Effacer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Teachers List */}
      <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-50 custom-scrollbar">
        {filteredTeachers.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Users size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">{t.teacherProfile.directory.noTeachersFound}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{t.teacherProfile.directory.tryAnotherSearch}</p>
          </div>
        ) : (
          filteredTeachers.map((tItem) => {
            const isCurrent = tItem.id === currentTeacherId;
            const primarySubject = (tItem.subjects && tItem.subjects.length > 0)
              ? tItem.subjects[0].name.split("|")[0].trim()
              : null;
            const remainingSubjectsCount = (tItem.subjects?.length || 0) - 1;
            const tabSuffix = activeTab && activeTab !== "finance" ? `?tab=${activeTab}` : "";

            return (
              <a
                key={tItem.id}
                href={`/list/teachers/${tItem.id}${tabSuffix}`}
                data-no-loader="true"
                onMouseEnter={() => { if (onPrefetchTeacher) onPrefetchTeacher(tItem.id); }}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  if (isMobile && onClose) onClose();
                  if (onSelectTeacher) {
                    onSelectTeacher(tItem.id);
                  }
                }}
                className={`w-full text-left group flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-indigo-50/80 border border-indigo-200/80 shadow-2xs"
                    : "hover:bg-slate-50 border border-transparent"
                }`}
              >
                {/* Avatar */}
                <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-200/80 bg-slate-100 shadow-2xs">
                  <Image
                    src={getUserAvatar(tItem.img, "teacher", tItem.sex)}
                    alt={`${tItem.name} ${tItem.surname}`}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-bold truncate ${
                      isCurrent ? "text-indigo-950" : "text-slate-800 group-hover:text-indigo-600"
                    }`}>
                      {tItem.name} {tItem.surname}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-indigo-600 text-white shrink-0">
                        {t.teacherProfile.directory.current}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 flex-wrap">
                    {primarySubject ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-md truncate max-w-[140px]">
                        <BookOpen size={10} className="text-slate-400 shrink-0" />
                        <span className="truncate">{primarySubject}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">{t.teacherProfile.directory.withoutSubject}</span>
                    )}
                    {remainingSubjectsCount > 0 && (
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 py-0.2 rounded-md shrink-0">
                        +{remainingSubjectsCount}
                      </span>
                    )}
                  </div>
                </div>

                {!isCurrent && (
                  <ChevronRight size={14} className={`text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0 ${locale === "ar" ? "rotate-180" : ""}`} />
                )}
              </a>
            );
          })
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/80 shrink-0 flex items-center justify-between text-xs">
        <Link
          href="/list/teachers"
          className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1.5 transition-colors"
        >
          <span>{t.teacherProfile.directory.fullTable}</span>
          <ExternalLink size={12} className={locale === "ar" ? "rotate-180" : ""} />
        </Link>
        <span className="text-[11px] text-slate-400">
          {t.teacherProfile.directory.displayedCount
            .replace("{count}", String(filteredTeachers.length))
            .replace("{plural}", filteredTeachers.length > 1 ? (locale === "fr" ? "s" : "s") : "")}
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Docked Sidebar (lg and above): Integrated directly in the page flow */}
      <aside
        className="hidden lg:flex flex-col w-[320px] xl:w-[350px] shrink-0 sticky top-4 h-[calc(100vh-100px)] bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden z-20"
        aria-label={t.teacherProfile.directory.title}
      >
        {renderDrawerBody(false)}
      </aside>

      {/* 2. Mobile Overlay Drawer (< lg) */}
      <div className="lg:hidden">
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />
        <aside
          className={`fixed top-0 ${locale === "ar" ? "left-0 border-r" : "right-0 border-l"} h-full w-[320px] sm:w-[360px] bg-white z-50 shadow-2xl border-slate-200 flex flex-col`}
          aria-label={t.teacherProfile.directory.title}
        >
          {renderDrawerBody(true)}
        </aside>
      </div>
    </>
  );
}

export function FloatingTeacherNavTrigger({
  onOpen,
  totalTeachers,
}: {
  onOpen: () => void;
  totalTeachers: number;
  isPinned?: boolean;
}) {
  const { t, locale } = useLanguage();
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`fixed ${locale === "ar" ? "left-0 rounded-r-2xl border-r border-t border-b hover:translate-x-1" : "right-0 rounded-l-2xl border-l border-t border-b hover:-translate-x-1"} top-1/2 -translate-y-1/2 z-30 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg py-3 px-2 flex flex-col items-center gap-1.5 transition-transform duration-200 group border-indigo-400/30 cursor-pointer`}
      title={t.teacherProfile.directory.showDirectoryTooltip}
      aria-label={t.teacherProfile.directory.showDirectoryTooltip}
    >
      <Users size={16} className="group-hover:scale-110 transition-transform" />
      <span className="text-[10px] font-black leading-none bg-white text-indigo-700 px-1.5 py-0.5 rounded-full shadow-2xs">
        {totalTeachers}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180 opacity-90 mt-1">
        {t.teacherProfile.directory.floatingLabel}
      </span>
    </button>
  );
}
