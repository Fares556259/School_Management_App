"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { Users, Search, X, Check, Loader2, Plus, UserMinus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { assignStudentsToClass } from "@/lib/crudActions";
import { useRouter } from "next/navigation";

interface StudentOption {
  id: string;
  name: string;
  surname: string;
  class: { name: string } | null;
}

interface AssignStudentsModalProps {
  classId: number;
  className: string;
  students: StudentOption[];
}

export default function AssignStudentsModal({
  classId,
  className,
  students,
}: AssignStudentsModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialize selectedIds with students already in this class
  const handleOpen = () => {
    const currentClassStudentIds = students
      .filter((s) => s.class?.name === className)
      .map((s) => s.id);
    setSelectedIds(currentClassStudentIds);
    setError("");
    setSearch("");
    setShowDropdown(false);
    setOpen(true);
  };

  // 1. Search dropdown matches (students NOT already selected, matching the search text)
  const dropdownMatches = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return [];

    return students
      .filter((student) => {
        const isAlreadySelected = selectedIds.includes(student.id);
        if (isAlreadySelected) return false;

        const fullName = `${student.name} ${student.surname}`.toLowerCase();
        return fullName.includes(s);
      })
      .slice(0, 8); // Limit dropdown to first 8 matches for a clean visual
  }, [students, search, selectedIds]);

  // 2. Currently selected students list (enrolled + newly added)
  const selectedStudents = useMemo(() => {
    return students.filter((s) => selectedIds.includes(s.id));
  }, [students, selectedIds]);

  const selectStudent = (studentId: string) => {
    setSelectedIds((prev) => [...prev, studentId]);
    setSearch(""); // Clear search after selection
    setShowDropdown(false);
  };

  const removeStudent = (studentId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== studentId));
  };

  const handleSave = () => {
    setError("");
    startTransition(async () => {
      const result = await assignStudentsToClass(classId, selectedIds);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error || "Failed to update assignments.");
      }
    });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 border border-purple-600 text-purple-600 bg-white hover:bg-purple-50 px-4 py-2 rounded-[10px] text-[14px] font-medium transition-colors shadow-sm shrink-0"
        title="Assign existing students to this class"
      >
        <Plus size={16} strokeWidth={2.5} />
        <span>Add Students</span>
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
              className="bg-white rounded-[12px] w-full max-w-xl shadow-xl border border-[#dddddd] flex flex-col max-h-[85vh] relative overflow-hidden z-10"
            >
              {/* HEADER */}
              <div className="p-6 border-b border-[#dddddd] flex items-center justify-between">
                <div>
                  <h3 className="text-[20px] font-medium text-[#181d26] tracking-tight">
                    Assign Students to {className}
                  </h3>
                  <p className="text-[#41454d] text-[13px] font-normal mt-1">
                    Search and select students to enroll them in this class.
                  </p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => setOpen(false)}
                  className="p-2 text-slate-400 hover:text-[#181d26] hover:bg-slate-50 rounded-[10px] transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              {/* SEARCH DROPDOWN INPUT */}
              <div className="p-5 border-b border-[#dddddd] bg-[#f8fafc] flex flex-col gap-2 relative z-20" ref={dropdownRef}>
                <label className="text-[13px] font-medium text-[#41454d] mb-1">
                  Search student to add
                </label>
                
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-500" size={16} />
                  <input
                    type="text"
                    placeholder="Type student name..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full bg-white border border-[#dddddd] rounded-[8px] pl-10 pr-4 py-2.5 text-[14px] font-medium text-[#181d26] placeholder-[#9297a0] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors shadow-sm"
                  />
                  
                  {search && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setShowDropdown(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* DROPDOWN MENU */}
                <AnimatePresence>
                  {showDropdown && search.trim() && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute left-5 right-5 top-full mt-1 bg-white border border-[#dddddd] rounded-[10px] shadow-lg overflow-hidden max-h-60 overflow-y-auto z-50 divide-y divide-[#dddddd]"
                    >
                      {dropdownMatches.length > 0 ? (
                        dropdownMatches.map((student) => (
                          <div
                            key={student.id}
                            onClick={() => selectStudent(student.id)}
                            className="px-4 py-3 text-[14px] font-medium text-[#181d26] hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span>{student.name} {student.surname}</span>
                              <span className="text-[12px] font-normal text-[#41454d] mt-0.5">
                                {student.class ? `Current Class: ${student.class.name}` : "Unassigned"}
                              </span>
                            </div>
                            <span className="text-[11px] font-medium bg-purple-50 border border-purple-100 text-purple-600 px-2 py-1 rounded-[6px]">
                              Select
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-5 text-center text-[13px] font-medium text-[#41454d] bg-[#f8fafc] italic">
                          No matching students found
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* LIST OF SELECTED STUDENTS */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 min-h-[300px] custom-scrollbar bg-white">
                <div className="flex items-center justify-between border-b border-[#dddddd] pb-3">
                  <h4 className="text-[14px] font-medium text-[#41454d]">
                    Currently Selected Students ({selectedIds.length})
                  </h4>
                  {selectedIds.length > 0 && (
                    <button
                      onClick={() => setSelectedIds([])}
                      className="text-[13px] font-medium text-rose-500 hover:text-rose-600 transition-colors"
                    >
                      Deselect All
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {selectedStudents.length > 0 ? (
                    selectedStudents.map((student) => {
                      const isCurrentlyInThisClass = student.class?.name === className;

                      return (
                        <motion.div
                          layout
                          key={student.id}
                          className="flex items-center justify-between p-3.5 bg-white border border-[#dddddd] rounded-[10px] hover:border-[#9297a0] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {/* Visual Indicator of Enrollment */}
                            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-medium text-[14px] shrink-0 border border-purple-100">
                              {student.name.charAt(0)}{student.surname.charAt(0)}
                            </div>

                            <div className="flex flex-col leading-tight">
                              <span className="text-[14px] font-medium text-[#181d26]">
                                {student.name} {student.surname}
                              </span>
                              <span className="text-[12px] font-normal text-[#41454d] mt-1">
                                {isCurrentlyInThisClass 
                                  ? "Already Enrolled" 
                                  : student.class 
                                    ? `Moving from ${student.class.name}` 
                                    : "Unassigned"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {isCurrentlyInThisClass && (
                              <span className="text-[11px] font-medium text-purple-600 bg-purple-50 border border-purple-100 px-2 py-1 rounded-[6px] leading-none">
                                Enrolled
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeStudent(student.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-[8px] transition-colors"
                              title="Remove student from list"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#dddddd] rounded-[12px] bg-[#f8fafc] p-6">
                      <div className="w-12 h-12 rounded-full bg-white border border-[#dddddd] flex items-center justify-center text-[#9297a0] mb-4">
                        <Users size={20} />
                      </div>
                      <h5 className="text-[14px] font-medium text-[#181d26] mb-1">
                        No Students Selected
                      </h5>
                      <p className="text-[13px] font-normal text-[#41454d] max-w-xs mx-auto">
                        Type a student name in the search bar above and select them from the dropdown matches to add them here.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* FOOTER */}
              <div className="p-6 border-t border-[#dddddd] bg-white flex flex-col gap-4">
                {error && (
                  <p className="text-[13px] font-medium text-rose-500 text-center tracking-tight bg-rose-50 border border-rose-100 rounded-[8px] p-3">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[#41454d]">
                    {selectedIds.length} Student(s) Selected
                  </span>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setOpen(false)}
                      className="px-5 py-2.5 bg-white border border-[#dddddd] rounded-[10px] text-[14px] font-medium text-[#41454d] hover:bg-[#f8fafc] hover:text-[#181d26] transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleSave}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-[10px] text-[14px] font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save Assignment</span>
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
