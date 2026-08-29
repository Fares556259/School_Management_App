"use client";

import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, Users, ArrowLeft, GraduationCap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface Teacher {
  id: string;
  username: string;
  name: string;
  surname: string;
  phone: string | null;
  address: string;
  img: string | null;
  bloodType: string;
  sex: "MALE" | "FEMALE";
  subjects: string[];
  roleInClass: string;
}

interface ClassTeachersTableProps {
  activeClass: {
    id: number;
    name: string;
    capacity: number;
    level: { level: number } | null;
    supervisor: { name: string; surname: string } | null;
    teachers: Teacher[];
  };
  role: string;
  isModal?: boolean;
}

export default function ClassTeachersTable({
  activeClass,
  role,
  isModal = false,
}: ClassTeachersTableProps) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [search, setSearch] = useState("");
  const [expandedTeachers, setExpandedTeachers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter teachers based on search input
  const filteredTeachers = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return activeClass.teachers;

    return activeClass.teachers.filter((teacher) => {
      const fullName = `${teacher.name} ${teacher.surname}`.toLowerCase();
      const username = teacher.username.toLowerCase();
      const address = teacher.address.toLowerCase();

      return (
        fullName.includes(s) ||
        username.includes(s) ||
        address.includes(s)
      );
    });
  }, [activeClass.teachers, search]);

  // Pagination calculation
  const totalItems = filteredTeachers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTeachers = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredTeachers.slice(startIndex, startIndex + pageSize);
  }, [filteredTeachers, safeCurrentPage, pageSize]);

  return (
    <div className={`flex-1 p-6 md:p-8 bg-[#f8fafc] ${isModal ? "min-h-full h-full overflow-y-auto" : "min-h-screen overflow-y-auto"} selection:bg-[#1b61c9] selection:text-white`}>
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* HEADER AREA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {!isModal && (
            <Link 
              href="/list/classes" 
              className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-50 border border-[#dddddd] rounded-full text-[#181d26] shadow-sm transition-all"
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </Link>
          )}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-[28px] md:text-[32px] font-normal text-[#181d26] tracking-tight leading-none">
                {activeClass.name} {t.classTeachers.title}
              </h1>
              <div className="flex items-center gap-2 mt-2 text-[13px] font-medium text-[#41454d]">
                <Link href="/list/classes" className="hover:text-[#1b61c9] transition-colors">{t.classes.pageTitle}</Link>
                <span>/</span>
                <span className="text-slate-400">{t.classTeachers.title}</span>
              </div>
            </div>
          </div>
        </div>

        {/* INFO HIGHLIGHT BARS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-[12px] border border-[#dddddd] shadow-sm flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-full bg-[#f5e9d4] flex items-center justify-center text-[#181d26] font-medium shrink-0 group-hover:scale-105 transition-transform">
              Lv
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[12px] font-medium text-[#41454d] uppercase tracking-wide mb-1.5">Grade Level</span>
              <span className="text-[18px] font-normal text-[#181d26]">Class Level {activeClass.level?.level || "-"}</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[12px] border border-[#dddddd] shadow-sm flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-full bg-[#e0e7ff] flex items-center justify-center text-[#181d26] font-medium shrink-0 group-hover:scale-105 transition-transform">
              <GraduationCap size={18} strokeWidth={2} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[12px] font-medium text-[#41454d] uppercase tracking-wide mb-1.5">{t.classTeachers.totalTeachers}</span>
              <span className="text-[18px] font-normal text-[#181d26]">
                {activeClass.teachers.length}
              </span>
            </div>
          </div>
          
        </div>

        {/* TABLE CONTAINER CARD */}
        <div className="bg-white rounded-[24px] border border-[#dddddd] shadow-sm overflow-hidden">
          
          {/* CARD HEADER */}
          <div className="px-6 py-5 md:px-8 md:py-6 border-b border-[#dddddd] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h2 className="text-[24px] font-normal text-[#181d26] tracking-tight leading-none mb-2">
                {t.classTeachers.teachersInfo}
              </h2>
              <p className="text-[#41454d] text-[14px] font-normal">
                {t.classTeachers.teachersInfoDesc}
              </p>
            </div>

            {/* SEARCH */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#41454d]" size={16} />
                <input
                  type="text"
                  placeholder={t.classTeachers.searchPlaceholder}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-white border border-[#dddddd] rounded-[8px] pl-10 pr-4 py-2.5 text-[13px] font-medium text-[#181d26] placeholder-[#41454d]/60 focus:outline-none focus:border-[#1b61c9] focus:ring-1 focus:ring-[#1b61c9] transition-all shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* TABLE SCROLL AREA */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-[#dddddd] text-[13px] font-medium text-[#41454d] bg-slate-50">
                  <th className="py-4 px-6 font-medium">{t.classTeachers.teacherName}</th>
                  
                  <th className="py-4 px-6 font-medium">{t.classTeachers.subjects}</th>
                  <th className="py-4 px-6 font-medium">{t.classTeachers.address}</th>
                  <th className="py-4 px-6 font-medium">{t.classTeachers.phone}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dddddd]">
                {paginatedTeachers.map((teacher) => (
                  <tr 
                    key={teacher.id} 
                    className="group transition-colors duration-200 select-none hover:bg-[#f8fafc]"
                  >
                    {/* Photo & Name */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden relative bg-slate-100 shrink-0 border border-[#dddddd]">
                          <Image 
                            src={teacher.img || "/noAvatar.png"} 
                            alt={`${teacher.name} ${teacher.surname}`} 
                            fill 
                            className="object-cover" 
                          />
                        </div>
                        <div className="flex flex-col">
                          <Link 
                            href={`/list/teachers/${teacher.id}`}
                            className="text-[14px] font-medium text-[#181d26] hover:text-[#1b61c9] transition-colors"
                          >
                            {teacher.name} {teacher.surname}
                          </Link>
                          <span className="text-[12px] font-medium text-[#41454d] mt-0.5">
                            {teacher.phone || teacher.address || ""}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium ${
                        teacher.roleInClass === "Supervisor" 
                          ? "bg-[#ffc3a0]/20 text-[#c2410c]" 
                          : "bg-slate-100 text-[#41454d]"
                      }`}>
                        {teacher.roleInClass === "Supervisor" ? t.classTeachers.roleSupervisor : t.classTeachers.roleSubjectTeacher}
                      </span>
                    </td>

                    {/* Subjects */}
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1">
                        {teacher.subjects.length > 0 ? (
                          (() => {
                            const getTranslatedSubject = (subjectStr: string, locale: string) => {
                              if (!subjectStr.includes('|')) return subjectStr;
                              const parts = subjectStr.split('|').map(s => s.trim());
                              if (locale === 'ar') return parts[0] || subjectStr;
                              if (locale === 'fr') return parts[1] || parts[0] || subjectStr;
                              if (locale === 'en') return parts[2] || parts[0] || subjectStr;
                              return subjectStr;
                            };
                            
                            const displaySubjects = teacher.subjects.map(sub => getTranslatedSubject(sub, locale));
                            const isExpanded = expandedTeachers.includes(teacher.id);
                            const visibleSubjects = isExpanded ? displaySubjects : displaySubjects.slice(0, 2);
                            const hiddenCount = displaySubjects.length - 2;

                            return (
                              <>
                                {visibleSubjects.map((displaySubject, idx) => (
                                  <span key={idx} className="text-[12px] font-medium bg-white border border-[#dddddd] px-2 py-0.5 rounded-md text-[#41454d]">
                                    {displaySubject}
                                  </span>
                                ))}
                                {!isExpanded && hiddenCount > 0 && (
                                  <button 
                                    onClick={() => setExpandedTeachers(prev => [...prev, teacher.id])}
                                    className="text-[12px] font-medium bg-slate-100 border border-[#dddddd] px-2 py-0.5 rounded-md text-[#41454d] cursor-pointer hover:bg-slate-200 transition-colors"
                                    title="Show more"
                                  >
                                    +{hiddenCount}
                                  </button>
                                )}
                                {isExpanded && hiddenCount > 0 && (
                                  <button 
                                    onClick={() => setExpandedTeachers(prev => prev.filter(id => id !== teacher.id))}
                                    className="text-[12px] font-medium bg-slate-100 border border-[#dddddd] px-2 py-0.5 rounded-md text-[#41454d] cursor-pointer hover:bg-slate-200 transition-colors"
                                    title="Show less"
                                  >
                                    -
                                  </button>
                                )}
                              </>
                            );
                          })()
                        ) : (
                          <span className="text-[#9297a0]">-</span>
                        )}
                      </div>
                    </td>

                    {/* Address */}
                    <td className="py-4 px-6 text-[14px] font-medium text-[#41454d]">
                      {teacher.address}
                    </td>

                    {/* Phone */}
                    <td className="py-4 px-6 text-[14px] font-medium text-[#41454d]">
                      {teacher.phone || "-"}
                    </td>
                  </tr>
                ))}

                {/* Empty State */}
                {filteredTeachers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="max-w-md mx-auto flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
                          <GraduationCap size={32} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-1">
                            {t.classTeachers.noTeachers}
                          </h3>
                          <p className="text-xs font-semibold text-slate-400 max-w-xs mx-auto">
                            {t.classTeachers.noTeachersDesc}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER / PAGINATION */}
          {filteredTeachers.length > 0 && (
            <div className="p-6 border-t border-[#dddddd] flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
              <div className="flex items-center gap-1.5 select-none">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="w-8 h-8 rounded-[8px] border border-[#dddddd] bg-white flex items-center justify-center text-[#181d26] hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => {
                  const pNum = i + 1;
                  const isActive = pNum === safeCurrentPage;
                  if (totalPages > 6) {
                    if (pNum !== 1 && pNum !== totalPages && Math.abs(pNum - safeCurrentPage) > 1) {
                      if (pNum === 2 && safeCurrentPage > 3) return <span key="dots-left" className="px-1 text-[#41454d]">...</span>;
                      if (pNum === totalPages - 1 && safeCurrentPage < totalPages - 2) return <span key="dots-right" className="px-1 text-[#41454d]">...</span>;
                      return null;
                    }
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-8 h-8 rounded-[8px] flex items-center justify-center text-[13px] font-medium transition-all cursor-pointer border ${
                        isActive ? "bg-[#181d26] text-white border-[#181d26]" : "border-[#dddddd] bg-white hover:bg-slate-50 text-[#181d26]"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={safeCurrentPage === totalPages}
                  className="w-8 h-8 rounded-[8px] border border-[#dddddd] bg-white flex items-center justify-center text-[#181d26] hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[13px] font-medium text-[#41454d]">
                  Showing {(safeCurrentPage - 1) * pageSize + 1} to {Math.min(safeCurrentPage * pageSize, totalItems)} of {totalItems} items
                </span>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-[#dddddd] text-[#181d26] rounded-[8px] px-3 py-1.5 text-[13px] font-medium focus:outline-none focus:border-[#181d26] cursor-pointer"
                >
                  <option value={5}>5 / page</option>
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
