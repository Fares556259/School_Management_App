"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Search, X, Check, Loader2, Plus, Trash2, Edit, 
  ChevronLeft, ChevronRight, Calendar, Users, ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AssignStudentsModal from "./AssignStudentsModal";
import StudentDetailsModal from "./StudentDetailsModal";
import { assignStudentsToClass, removeStudentFromClass } from "@/lib/crudActions";

interface Student {
  id: string;
  username: string;
  name: string;
  surname: string;
  phone: string | null;
  address: string;
  img: string | null;
  birthday: Date | string;
  sex: "MALE" | "FEMALE";
  bloodType: string;
  createdAt: Date | string;
  parent?: {
    name: string;
    surname: string;
    phone: string;
  } | null;
}

interface ClassStudentsTableProps {
  activeClass: {
    id: number;
    name: string;
    capacity: number;
    level: { level: number } | null;
    supervisor: { name: string; surname: string } | null;
    students: Student[];
  };
  allStudents: {
    id: string;
    name: string;
    surname: string;
    class: { name: string } | null;
  }[];
  role: string;
}

export default function ClassStudentsTable({
  activeClass,
  allStudents,
  role,
}: ClassStudentsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Clean format date helper
  const formatDate = (dateVal: Date | string) => {
    try {
      const d = new Date(dateVal);
      return new Intl.DateTimeFormat("en-GB").format(d);
    } catch {
      return "-";
    }
  };

  // Filter students based on search input (name, username, roll, or address)
  const filteredStudents = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return activeClass.students;

    return activeClass.students.filter((student, index) => {
      const fullName = `${student.name} ${student.surname}`.toLowerCase();
      const username = student.username.toLowerCase();
      const address = student.address.toLowerCase();
      const rollNumber = `#${index + 1}`.toLowerCase();
      const rollNumberPadded = `#${(index + 1) < 10 ? '0' + (index + 1) : index + 1}`.toLowerCase();

      return (
        fullName.includes(s) ||
        username.includes(s) ||
        address.includes(s) ||
        rollNumber.includes(s) ||
        rollNumberPadded.includes(s)
      );
    });
  }, [activeClass.students, search]);

  // Pagination calculation
  const totalItems = filteredStudents.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  
  // Adjust current page if out of bounds after filtering
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedStudents = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredStudents.slice(startIndex, startIndex + pageSize);
  }, [filteredStudents, safeCurrentPage, pageSize]);

  // Master Checkbox toggle
  const isAllPageSelected = useMemo(() => {
    if (paginatedStudents.length === 0) return false;
    return paginatedStudents.every((student) => selectedIds.includes(student.id));
  }, [paginatedStudents, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllPageSelected) {
      // Unselect all students on the current page
      const pageStudentIds = paginatedStudents.map((s) => s.id);
      setSelectedIds((prev) => prev.filter((id) => !pageStudentIds.includes(id)));
    } else {
      // Select all students on the current page
      const pageStudentIds = paginatedStudents.map((s) => s.id);
      setSelectedIds((prev) => {
        const uniqueNewIds = pageStudentIds.filter((id) => !prev.includes(id));
        return [...prev, ...uniqueNewIds];
      });
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk remove — unenrolls selected students from this class only.
  // Each student remains fully in the system and appears in the Students list.
  const handleBulkRemove = () => {
    if (selectedIds.length === 0) return;
    setError("");

    const count = selectedIds.length;
    if (confirm(`Remove ${count} student${count > 1 ? "s" : ""} from this class?\n\nNote: They will remain in the system and can be assigned to another class later.`)) {
      startTransition(async () => {
        // Remove each student individually — only their classId is set to null
        const results = await Promise.all(
          selectedIds.map((id) => removeStudentFromClass(id))
        );
        const failed = results.filter((r) => !r.success);
        if (failed.length === 0) {
          setSelectedIds([]);
          router.refresh();
        } else {
          setError(`Failed to remove ${failed.length} student(s). Please try again.`);
          router.refresh();
        }
      });
    }
  };

  // Individual remove — unenrolls one student from this class only.
  // Student remains in the system and appears in the Students list.
  const handleSingleRemove = (studentId: string, studentName: string) => {
    setError("");
    if (confirm(`Remove "${studentName}" from this class?\n\nNote: The student will remain in the system and can be re-assigned to a class at any time.`)) {
      startTransition(async () => {
        const result = await removeStudentFromClass(studentId);
        if (result.success) {
          setSelectedIds((prev) => prev.filter((id) => id !== studentId));
          router.refresh();
        } else {
          setError(result.error || "Failed to remove student.");
        }
      });
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 bg-[#f8fafc] min-h-screen overflow-y-auto selection:bg-[#1b61c9] selection:text-white">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* HEADER AREA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/list/classes" 
              className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-50 border border-[#dddddd] rounded-full text-[#181d26] shadow-sm transition-all"
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </Link>
            <div>
              <h1 className="text-[28px] md:text-[32px] font-normal text-[#181d26] tracking-tight leading-none">
                {activeClass.name} Students
              </h1>
              <div className="flex items-center gap-2 mt-2 text-[13px] font-medium text-[#41454d]">
                <Link href="/list/classes" className="hover:text-[#1b61c9] transition-colors">Classes</Link>
                <span>/</span>
                <span className="text-slate-400">Students</span>
              </div>
            </div>
          </div>

          {/* ADD STUDENTS BUTTON */}
          {role === "admin" && (
            <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
              <AssignStudentsModal
                classId={activeClass.id}
                className={activeClass.name}
                students={allStudents}
              />
            </div>
          )}
        </div>

        {/* INFO HIGHLIGHT BARS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
            <div className="w-12 h-12 rounded-full bg-[#a8d8c4] flex items-center justify-center text-[#181d26] font-medium shrink-0 group-hover:scale-105 transition-transform">
              {activeClass.students.length}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[12px] font-medium text-[#41454d] uppercase tracking-wide mb-1.5">Enrolled / Capacity</span>
              <span className="text-[18px] font-normal text-[#181d26]">
                {activeClass.students.length} / {activeClass.capacity} Students
              </span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[12px] border border-[#dddddd] shadow-sm flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-full bg-[#ffc3a0] flex items-center justify-center text-[#181d26] shrink-0 group-hover:scale-105 transition-transform">
              <Users size={18} strokeWidth={2} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[12px] font-medium text-[#41454d] uppercase tracking-wide mb-1.5">Supervisor</span>
              <span className="text-[18px] font-normal text-[#181d26] truncate max-w-[200px]">
                {activeClass.supervisor ? `${activeClass.supervisor.name} ${activeClass.supervisor.surname}` : "No Supervisor"}
              </span>
            </div>
          </div>
        </div>

        {/* ERROR MESSAGE DISPLAY */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl p-4 text-sm font-semibold flex items-center justify-between"
            >
              <span>{error}</span>
              <button onClick={() => setError("")} className="text-rose-400 hover:text-rose-600 p-1">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BULK ACTION BAR FLOATING ALERT */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#181d26] border border-[#181d26] text-white rounded-[16px] p-4 md:px-6 md:py-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 text-[14px] font-medium">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[12px] text-[#181d26] font-bold">
                  {selectedIds.length}
                </div>
                <span>Student{selectedIds.length > 1 ? "s" : ""} selected for bulk action</span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setSelectedIds([])}
                  className="flex-1 sm:flex-none px-4 py-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-[8px] text-[13px] font-medium transition-all"
                >
                  Clear Selection
                </button>
                {role === "admin" && (
                  <button
                    onClick={handleBulkRemove}
                    disabled={isPending}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[8px] text-[13px] font-medium transition-all shadow-sm disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    <span>Unenroll from Class</span>
                  </button>
                )}
              </div>
              <p className="text-[12px] text-slate-400 w-full sm:w-auto text-center sm:text-left">
                Students will remain in the system — only removed from this class.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TABLE CONTAINER CARD */}
        <div className="bg-white rounded-[24px] border border-[#dddddd] shadow-sm overflow-hidden">
          
          {/* CARD HEADER */}
          <div className="p-6 md:p-8 border-b border-[#dddddd] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h2 className="text-[24px] font-normal text-[#181d26] tracking-tight leading-none mb-2">
                Students Information
              </h2>
              <p className="text-[#41454d] text-[14px] font-normal">
                Manage all student details and enrollments for this class.
              </p>
            </div>

            {/* SEARCH AND FILTERS */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#41454d]" size={16} />
                <input
                  type="text"
                  placeholder="Search by name or roll..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-white border border-[#dddddd] rounded-[8px] pl-10 pr-4 py-2.5 text-[13px] font-medium text-[#181d26] placeholder-[#41454d]/60 focus:outline-none focus:border-[#1b61c9] focus:ring-1 focus:ring-[#1b61c9] transition-all shadow-sm"
                />
              </div>

              {/* Fake Date Filter (mockup design match) */}
              <div className="flex items-center gap-2 bg-white border border-[#dddddd] rounded-[8px] px-4 py-2.5 text-[#181d26] text-[13px] font-medium w-full sm:w-auto justify-between cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-[#41454d]" />
                  <span>Last 30 days</span>
                </div>
                <ChevronRight size={14} className="rotate-90 text-[#41454d] ml-2" />
              </div>
            </div>
          </div>

          {/* TABLE SCROLL AREA */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-[#dddddd] text-[13px] font-medium text-[#41454d] bg-slate-50">
                  <th className="py-4 px-6 text-center w-16 select-none">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isAllPageSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-[#181d26] focus:ring-[#181d26] accent-[#181d26] cursor-pointer"
                      />
                    </div>
                  </th>
                  <th className="py-4 px-6 font-medium">Students Name</th>
                  <th className="py-4 px-4 text-center w-20 font-medium">Roll</th>
                  <th className="py-4 px-6 font-medium">Address</th>
                  <th className="py-4 px-6 text-center w-24 font-medium">Class</th>
                  <th className="py-4 px-6 font-medium">Date of Birth</th>
                  <th className="py-4 px-6 font-medium">Phone</th>
                  {role === "admin" && <th className="py-4 px-6 text-right w-28 font-medium">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dddddd]">
                {paginatedStudents.map((student) => {
                  // Find the absolute/relative index in the active class to display consistent roll numbers
                  const originalIndex = activeClass.students.findIndex(s => s.id === student.id);
                  const displayIndex = originalIndex !== -1 ? originalIndex : 0;
                  const rollNum = displayIndex + 1;
                  const rollLabel = `#${rollNum < 10 ? '0' + rollNum : rollNum}`;
                  
                  const isChecked = selectedIds.includes(student.id);

                  return (
                    <tr 
                      key={student.id} 
                      className={`group transition-colors duration-200 select-none ${
                        isChecked 
                          ? "bg-slate-50" 
                          : "hover:bg-[#f8fafc]"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-6 text-center select-none">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectRow(student.id)}
                            className="w-4 h-4 rounded border-slate-300 text-[#181d26] focus:ring-[#181d26] accent-[#181d26] cursor-pointer"
                          />
                        </div>
                      </td>

                      {/* Photo & Name */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden relative bg-slate-100 shrink-0 border border-[#dddddd]">
                            <Image 
                              src={student.img || "/noavatar.png"} 
                              alt={`${student.name} ${student.surname}`} 
                              fill 
                              className="object-cover" 
                            />
                          </div>
                          <div className="flex flex-col">
                            <Link 
                              href={`/list/students/${student.id}`}
                              className="text-[14px] font-medium text-[#181d26] hover:text-[#1b61c9] transition-colors"
                            >
                              {student.name} {student.surname}
                            </Link>
                            <span className="text-[12px] font-medium text-[#41454d] mt-0.5">
                              {student.username}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Roll */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-medium text-[#41454d] text-[14px]">
                          {rollLabel}
                        </span>
                      </td>

                      {/* Address */}
                      <td className="py-4 px-6 text-[14px] font-medium text-[#41454d]">
                        {student.address}
                      </td>

                      {/* Class */}
                      <td className="py-4 px-6 text-center">
                        <span className="px-2.5 py-1 bg-slate-100 text-[#181d26] rounded-[6px] text-[12px] font-medium border border-[#dddddd]">
                          {activeClass.name}
                        </span>
                      </td>

                      {/* DOB */}
                      <td className="py-4 px-6 text-[14px] font-medium text-[#41454d]">
                        {formatDate(student.birthday)}
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-6 text-[14px] font-medium text-[#41454d]">
                        {student.phone || "-"}
                      </td>

                      {/* Actions */}
                      {role === "admin" && (
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            {/* High-Fidelity view student details modal */}
                            <StudentDetailsModal
                              student={student}
                              className={activeClass.name}
                            />

                            {/* Remove from Class button */}
                            <button
                              onClick={() => handleSingleRemove(student.id, `${student.name} ${student.surname}`)}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#dddddd] text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                              title="Unenroll from this class (student stays in the system)"
                            >
                              <X size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* Empty State */}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={role === "admin" ? 8 : 7} className="py-20 text-center">
                      <div className="max-w-md mx-auto flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
                          <Users size={32} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-1">
                            No Students Found
                          </h3>
                          <p className="text-xs font-semibold text-slate-400 max-w-xs mx-auto">
                            {search 
                              ? "Try adjusting your search filters to find enrolled students."
                              : "Click '+ Add Students' at the top right to assign existing students to this class."}
                          </p>
                        </div>
                        {role === "admin" && !search && (
                          <div className="flex justify-center mt-2">
                            <AssignStudentsModal
                              classId={activeClass.id}
                              className={activeClass.name}
                              students={allStudents}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER / PAGINATION */}
          {filteredStudents.length > 0 && (
            <div className="p-6 border-t border-[#dddddd] flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
              
              {/* Pagination controls */}
              <div className="flex items-center gap-1.5 select-none">
                {/* Previous Page */}
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="w-8 h-8 rounded-[8px] border border-[#dddddd] bg-white flex items-center justify-center text-[#181d26] hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => {
                  const pNum = i + 1;
                  const isActive = pNum === safeCurrentPage;

                  // Render limited pages if too many
                  if (totalPages > 6) {
                    if (pNum !== 1 && pNum !== totalPages && Math.abs(pNum - safeCurrentPage) > 1) {
                      if (pNum === 2 && safeCurrentPage > 3) {
                        return <span key="dots-left" className="px-1 text-[#41454d] text-[14px]">...</span>;
                      }
                      if (pNum === totalPages - 1 && safeCurrentPage < totalPages - 2) {
                        return <span key="dots-right" className="px-1 text-[#41454d] text-[14px]">...</span>;
                      }
                      return null;
                    }
                  }

                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-8 h-8 rounded-[8px] flex items-center justify-center text-[13px] font-medium transition-all cursor-pointer border ${
                        isActive
                          ? "bg-[#181d26] text-white border-[#181d26]"
                          : "border-[#dddddd] bg-white hover:bg-slate-50 text-[#181d26]"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                {/* Next Page */}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={safeCurrentPage === totalPages}
                  className="w-8 h-8 rounded-[8px] border border-[#dddddd] bg-white flex items-center justify-center text-[#181d26] hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Page size options */}
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
