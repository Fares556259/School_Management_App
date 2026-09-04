"use client";

import { useState } from "react";
import { Eye, X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import PaymentTimeline from "@/components/PaymentTimeline";

interface TeacherDetailsModalProps {
  teacher: {
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
    salary: number;
    activated: boolean;
    subjects?: { id: number; name: string }[];
    classes?: { id: number; name: string }[];
    payments?: any[];
    timetable?: any[];
  };
}

export default function TeacherDetailsModal({
  teacher,
}: TeacherDetailsModalProps) {
  const [open, setOpen] = useState(false);

  // Date Formatting Helper
  const formatDate = (dateVal: Date | string) => {
    try {
      const d = new Date(dateVal);
      return new Intl.DateTimeFormat("en-GB").format(d);
    } catch {
      return "-";
    }
  };

  const allSubjectsMap = new Map();
  teacher.subjects?.forEach(s => allSubjectsMap.set(s.id, s));
  teacher.timetable?.forEach(t => { if (t.subject) allSubjectsMap.set(t.subject.id, t.subject); });
  const allSubjects = Array.from(allSubjectsMap.values());

  const allClassesMap = new Map();
  teacher.classes?.forEach(c => allClassesMap.set(c.id, c));
  teacher.timetable?.forEach(t => { if (t.class) allClassesMap.set(t.class.id, t.class); });
  const allClasses = Array.from(allClassesMap.values());

  return (
    <>
      {/* TRIGGER EYE ICON BUTTON */}
      <button
        onClick={() => setOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-colors text-[#41454d]"
        title="View Teacher Details"
      >
        <Eye size={16} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* BACKDROP */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-[#181d26]/40 backdrop-blur-sm"
            />

            {/* MODAL WINDOW */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[12px] w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden z-10 text-left"
            >
              {/* HEADER */}
              <div className="px-6 py-4 border-b border-[#dddddd] flex items-center justify-between">
                <div>
                  <h3 className="text-[20px] font-medium text-[#181d26] tracking-tight leading-none mb-1.5">
                    Teacher Details
                  </h3>
                  <div className="flex items-center gap-2 text-[13px] font-normal text-[#41454d]">
                    <span>Teachers</span>
                    <span className="text-[#9297a0]">/</span>
                    <Link
                      href={`/list/teachers/${teacher.id}`}
                      className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>{teacher.name} {teacher.surname}</span>
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#f8fafc] text-[#181d26] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* CARD SPLIT CONTENT AREA */}
              <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                <div className="p-5 flex flex-col md:flex-row gap-5 min-h-full items-stretch">
                
                  {/* LEFT CARD: ABOUT ME */}
                  <div className="flex-1 bg-[#f8fafc] p-5 rounded-[12px] flex flex-col gap-5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden relative border border-[#dddddd] bg-white shrink-0">
                      <Image
                        src={teacher.img || "/noAvatar.png"}
                        alt={`${teacher.name} ${teacher.surname}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[20px] font-medium text-[#181d26] leading-tight">
                        {teacher.name} {teacher.surname}
                      </span>
                      <span className="text-[13px] font-normal text-[#41454d] mt-1">
                        Teacher / Faculty
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-[#dddddd] pt-5">
                    <h4 className="text-[18px] font-medium text-[#181d26] mb-5">
                      About
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-y-5 gap-x-5">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">First Name</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{teacher.name}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">Last Name</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{teacher.surname}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">Date of Birth</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{formatDate(teacher.birthday)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">Gender</span>
                        <span className="text-[14px] font-medium text-[#181d26] capitalize">{teacher.sex.toLowerCase()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">Base Salary</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{teacher.salary.toLocaleString("en-US").replace(/,/g, " ")} DT</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">Blood Type</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{teacher.bloodType}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">Hire Date</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{formatDate(teacher.createdAt)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">Teacher ID</span>
                        <span className="text-[14px] font-medium text-[#181d26] truncate" title={teacher.id}>
                          {teacher.id.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT CARD: CONTACT INFORMATION */}
                <div className="flex-1 bg-[#f8fafc] p-5 rounded-[12px] flex flex-col gap-5">
                  <div>
                    <h4 className="text-[18px] font-medium text-[#181d26] mb-1">
                      Contact Information
                    </h4>
                    <span className="text-[13px] font-normal text-[#41454d]">
                      Primary communication channels
                    </span>
                  </div>

                  <div className="border-t border-[#dddddd] pt-5 flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-5">
                      <div className="flex flex-col col-span-2">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">Phone Number</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{teacher.phone || "-"}</span>
                      </div>
                      <div className="flex flex-col col-span-2">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">Address</span>
                        <span className="text-[14px] font-medium text-[#181d26] leading-snug">{teacher.address || "-"}</span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-2">Status</span>
                        {teacher.activated ? (
                          <span className="font-medium text-[#006400] bg-[#f8fafc] border border-[#dddddd] px-2.5 py-1 rounded-[6px] text-[13px] w-fit flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#006400]"></span>
                            Active
                          </span>
                        ) : (
                          <span className="font-medium text-slate-500 bg-[#f8fafc] border border-[#dddddd] px-2.5 py-1 rounded-[6px] text-[13px] w-fit flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                </div>

                {/* ROW 2: SUBJECTS AND CLASSES */}
                <div className="px-5 pb-5">
                  <div className="bg-[#f8fafc] p-5 rounded-[12px] flex flex-col gap-5">
                    <div>
                      <h4 className="text-[18px] font-medium text-[#181d26] mb-1">Teaching Assignments</h4>
                      <span className="text-[13px] font-normal text-[#41454d]">Assigned subjects and classes for the academic year</span>
                    </div>
                    <div className="border-t border-[#dddddd] pt-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-5">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-[#41454d] mb-2">Subjects</span>
                          <div className="flex flex-wrap gap-2">
                            {allSubjects.length > 0 ? (
                              allSubjects.map(s => (
                                <span key={s.id} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-[6px] border border-blue-100 text-[13px] font-medium">
                                  {s.name.split('|')[0].trim()}
                                </span>
                              ))
                            ) : (
                              <span className="text-[13px] text-[#a1a1aa] italic">No subjects assigned</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-[#41454d] mb-2">Classes</span>
                          <div className="flex flex-wrap gap-2">
                            {allClasses.length > 0 ? (
                              allClasses.map(c => (
                                <span key={c.id} className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-[6px] border border-purple-100 text-[13px] font-medium">
                                  {c.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-[13px] text-[#a1a1aa] italic">No classes assigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROW 3: PAYMENT TIMELINE */}
                <div className="px-5 pb-5">
                  <div className="bg-[#f8fafc] p-5 rounded-[12px] flex flex-col gap-5">
                    <div>
                      <h4 className="text-[18px] font-medium text-[#181d26] mb-1">Financial History</h4>
                      <span className="text-[13px] font-normal text-[#41454d]">Salary payment timeline for the current academic year</span>
                    </div>
                    <div className="border-t border-[#dddddd] pt-5">
                      {teacher.payments && teacher.payments.length > 0 ? (
                        <PaymentTimeline payments={teacher.payments} />
                      ) : (
                        <span className="text-[14px] text-[#41454d]">No payment records found.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="px-6 py-4 border-t border-[#dddddd] flex items-center justify-between gap-3 bg-white">
                <Link
                  href={`/list/teachers/${teacher.id}`}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[10px] text-[13px] font-medium transition-colors shadow-sm flex items-center gap-2"
                >
                  <span>Profil complet & Emploi du temps</span>
                  <ExternalLink size={15} />
                </Link>
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-2.5 bg-[#181d26] text-white hover:bg-[#0d1218] rounded-[10px] text-[14px] font-medium transition-colors shadow-sm"
                >
                  Close View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
