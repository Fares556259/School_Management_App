"use client";

import { useState } from "react";
import { Eye, X, Mail, Phone, MapPin, User, Calendar, Award } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface StudentDetailsModalProps {
  student: {
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
  };
  className: string;
}

export default function StudentDetailsModal({
  student,
  className,
}: StudentDetailsModalProps) {
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

  return (
    <>
      {/* TRIGGER EYE ICON BUTTON */}
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
        title="View Student Details"
      >
        <Eye size={14} />
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
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* MODAL WINDOW */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-4xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden z-10"
            >
              {/* HEADER */}
              <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">
                    Students Details
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-slate-400">
                    <span>Students</span>
                    <span>/</span>
                    <span className="text-slate-500">Students details</span>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* CARD SPLIT CONTENT AREA */}
              <div className="flex-1 overflow-y-auto p-6 bg-[#FAF9FF] flex flex-col md:flex-row gap-6 custom-scrollbar">
                
                {/* LEFT CARD: ABOUT ME */}
                <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden relative border-2 border-slate-100 bg-slate-50 shadow-inner shrink-0">
                      <Image
                        src={student.img || "/noavatar.png"}
                        alt={`${student.name} ${student.surname}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-slate-800 leading-tight">
                        {student.name} {student.surname}
                      </span>
                      <span className="text-xs font-bold text-slate-400 mt-0.5">
                        Student / Users
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-5">
                    <h4 className="text-xs font-black text-purple-600 uppercase tracking-widest mb-4">
                      About Me
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">First Name</span>
                        <span className="font-bold text-slate-700">{student.name}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Last Name</span>
                        <span className="font-bold text-slate-700">{student.surname}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Parent / Guardian</span>
                        <span className="font-bold text-slate-700">
                          {student.parent ? `${student.parent.name} ${student.parent.surname}` : "Not Listed"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Parent Contact</span>
                        <span className="font-bold text-slate-700">
                          {student.parent?.phone || "Not Listed"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Date of Birth</span>
                        <span className="font-bold text-slate-700">{formatDate(student.birthday)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Gender</span>
                        <span className="font-bold text-slate-700 capitalize">{student.sex.toLowerCase()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Class</span>
                        <span className="font-bold text-slate-700">{className}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Blood Type</span>
                        <span className="font-bold text-slate-700">{student.bloodType}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Admission Date</span>
                        <span className="font-bold text-slate-700">{formatDate(student.createdAt)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Student ID</span>
                        <span className="font-mono text-xs font-bold text-slate-500 truncate" title={student.id}>
                          {student.id}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT CARD: CONTACT INFORMATION */}
                <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col gap-6">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 tracking-tight leading-none mb-1">
                      Contact Information
                    </h4>
                    <span className="text-xs font-bold text-slate-400">
                      Primary and secondary channels
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-5 flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Primary Phone</span>
                        <span className="font-bold text-slate-700">{student.phone || "-"}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Secondary Phone</span>
                        <span className="font-bold text-slate-700">{student.parent?.phone || "-"}</span>
                      </div>
                      <div className="flex flex-col col-span-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Home Address</span>
                        <span className="font-bold text-slate-500 leading-snug">{student.address || "-"}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Username</span>
                        <span className="font-semibold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg text-xs w-fit">
                          @{student.username}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status</span>
                        <span className="font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs w-fit">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* FOOTER */}
              <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
                <button
                  onClick={() => setOpen(false)}
                  className="px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 cursor-pointer"
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
