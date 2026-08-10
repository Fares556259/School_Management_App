"use client";

import { useState } from "react";
import { Eye, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import PaymentTimeline from "@/components/PaymentTimeline";

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
      username?: string | null;
      address?: string | null;
    } | null;
    payments?: any[];
  };
  className: string;
  schoolName?: string;
  adminName?: string;
}

export default function StudentDetailsModal({
  student,
  className,
  schoolName,
  adminName,
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
        className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-colors text-[#41454d]"
        title="View Student Details"
      >
        <Eye size={16} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
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
              className="bg-white rounded-[12px] w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden z-10 text-right"
            >
              {/* HEADER */}
              <div className="px-6 py-4 border-b border-[#dddddd] flex items-center justify-between">
                <div>
                  <h3 className="text-[20px] font-medium text-[#181d26] tracking-tight leading-none mb-1.5">
                    تفاصيل الطالب
                  </h3>
                  <div className="flex items-center gap-2 text-[13px] font-normal text-[#41454d]">
                    <span>الطلاب</span>
                    <span className="text-[#9297a0]">/</span>
                    <span>{student.name} {student.surname}</span>
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
                
                  {/* RIGHT CARD: ABOUT ME (In RTL this appears on the right) */}
                  <div className="flex-1 bg-[#f8fafc] p-5 rounded-[12px] flex flex-col gap-5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden relative border border-[#dddddd] bg-white shrink-0">
                      <Image
                        src={student.img || "/noavatar.png"}
                        alt={`${student.name} ${student.surname}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[20px] font-medium text-[#181d26] leading-tight">
                        {student.name} {student.surname}
                      </span>
                      <span className="text-[13px] font-normal text-[#41454d] mt-1">
                        طالب / {className}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-[#dddddd] pt-5">
                    <h4 className="text-[18px] font-medium text-[#181d26] mb-5">
                      معلومات عامة
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-y-5 gap-x-5">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">الاسم</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{student.name}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">اللقب</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{student.surname}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">تاريخ الولادة</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{formatDate(student.birthday)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">الجنس</span>
                        <span className="text-[14px] font-medium text-[#181d26] capitalize">{student.sex === "MALE" ? "ذكر" : "أنثى"}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">القسم</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{className}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">فصيلة الدم</span>
                        <span className="text-[14px] font-medium text-[#181d26]" dir="ltr" style={{textAlign: "right"}}>{student.bloodType}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">تاريخ التسجيل</span>
                        <span className="text-[14px] font-medium text-[#181d26]">{formatDate(student.createdAt)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">معرف الطالب</span>
                        <span className="text-[14px] font-medium text-[#181d26] truncate" title={student.id}>
                          {student.id.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* LEFT CARD: CONTACT INFORMATION */}
                <div className="flex-1 bg-[#f8fafc] p-5 rounded-[12px] flex flex-col gap-5">
                  <div>
                    <h4 className="text-[18px] font-medium text-[#181d26] mb-1">
                      معلومات الاتصال
                    </h4>
                    <span className="text-[13px] font-normal text-[#41454d]">
                      قنوات الاتصال الأساسية
                    </span>
                  </div>

                  <div className="border-t border-[#dddddd] pt-5 flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-5">
                      <div className="flex flex-col col-span-2">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">هاتف الطالب</span>
                        <span className="text-[14px] font-medium text-[#181d26]" dir="ltr" style={{textAlign: "right"}}>{student.phone || "-"}</span>
                      </div>
                      <div className="flex flex-col col-span-2">
                        <span className="text-[12px] font-medium text-[#41454d] mb-1">عنوان السكن</span>
                        <span className="text-[14px] font-medium text-[#181d26] leading-snug">{student.address || "-"}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-2">اسم المستخدم</span>
                        <span className="font-medium text-[#1b61c9] bg-[#f8fafc] border border-[#dddddd] px-2.5 py-1 rounded-[6px] text-[13px] w-fit" dir="ltr">
                          @{student.username}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#41454d] mb-2">الحالة</span>
                        <span className="font-medium text-[#006400] bg-[#f8fafc] border border-[#dddddd] px-2.5 py-1 rounded-[6px] text-[13px] w-fit flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#006400]"></span>
                          نشط
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                </div>

                {/* ROW 2: PARENT INFORMATION */}
                <div className="px-5 pb-5">
                  <div className="bg-[#f8fafc] p-5 rounded-[12px] flex flex-col gap-5">
                    <div>
                      <h4 className="text-[18px] font-medium text-[#181d26] mb-1">الولي</h4>
                      <span className="text-[13px] font-normal text-[#41454d]">تفاصيل الاتصال بالولي</span>
                    </div>
                    <div className="border-t border-[#dddddd] pt-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-5 gap-x-5">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-[#41454d] mb-1">الاسم الكامل</span>
                          <span className="text-[14px] font-medium text-[#181d26]">{student.parent ? `${student.parent.name} ${student.parent.surname}` : "غير مدرج"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-[#41454d] mb-1">رقم الهاتف</span>
                          <span className="text-[14px] font-medium text-[#181d26]" dir="ltr" style={{textAlign: "right"}}>{student.parent?.phone || "-"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-[#41454d] mb-1">اسم المستخدم</span>
                          <span className="text-[14px] font-medium text-[#181d26]" dir="ltr" style={{textAlign: "right"}}>{student.parent?.username ? `@${student.parent.username}` : "-"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-[#41454d] mb-1">العنوان</span>
                          <span className="text-[14px] font-medium text-[#181d26]">{student.parent?.address || "-"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROW 3: PAYMENT TIMELINE */}
                <div className="px-5 pb-5">
                  <div className="bg-[#f8fafc] p-5 rounded-[12px] flex flex-col gap-5">
                    <div>
                      <h4 className="text-[18px] font-medium text-[#181d26] mb-1">السجل المالي</h4>
                      <span className="text-[13px] font-normal text-[#41454d]">الجدول الزمني للأقساط للسنة الدراسية الحالية</span>
                    </div>
                    <div className="border-t border-[#dddddd] pt-5">
                      {student.payments && student.payments.length > 0 ? (
                        <PaymentTimeline 
                          payments={student.payments} 
                          student={student} 
                          schoolName={schoolName}
                          adminName={adminName}
                        />
                      ) : (
                        <span className="text-[14px] text-[#41454d]">لم يتم العثور على سجلات دفع.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="px-6 py-4 border-t border-[#dddddd] flex items-center justify-end gap-3 bg-white">
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-2.5 bg-[#181d26] text-white hover:bg-[#0d1218] rounded-[10px] text-[14px] font-medium transition-colors shadow-sm"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
