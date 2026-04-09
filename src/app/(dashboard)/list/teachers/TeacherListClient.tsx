"use client";

import { useState } from "react";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import BulkTeacherImport from "./BulkTeacherImport";
import PaySalaryModal from "./PaySalaryModal";
import PaymentTimeline from "@/components/PaymentTimeline";
import CrudFormModal from "@/components/CrudFormModal";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MONTHS } from "@/lib/dateUtils";
import { Teacher, Subject, Class, Payment } from "@prisma/client";

interface Props {
  initialData: any[];
  columns: any[];
  count: number;
  page: number;
  role: string | undefined;
  selectedMonthKey: string;
}

export default function TeacherListClient({
  initialData,
  columns,
  count,
  page,
  role,
  selectedMonthKey,
}: Props) {
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const renderRow = (
    item: Teacher & { subjects: Subject[]; classes: Class[]; payments: Payment[] }
  ) => {
    const [mName, yStr] = selectedMonthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);

    // Check if paid for the currently selected month in the navigator
    const isPaidThisMonth = item.payments.some(
      (p) => p.month === monthIdx && p.year === yearVal && p.status === "PAID"
    );

    return (
      <tr
        key={item.id}
        className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
      >
        <td className="flex items-center gap-4 p-4">
          <Image
            src={item.img || "/noavatar.png"}
            alt=""
            width={40}
            height={40}
            className="md:hidden xl:block w-10 h-10 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <h3 className="font-semibold">{item.name}</h3>
            <p className="text-xs text-gray-500">{item?.email}</p>
          </div>
        </td>
        <td className="hidden md:table-cell">{item.username}</td>
        <td className="hidden md:table-cell">
          {item.subjects.map((s) => s.name).join(",")}
        </td>
        <td className="hidden md:table-cell">
          {item.classes.map((c) => c.name).join(",")}
        </td>
        <td className="hidden md:table-cell">{item.phone}</td>
        <td className="hidden md:table-cell">{item.address}</td>
        <td>
          <PaySalaryModal 
            teacherId={item.id} 
            teacherName={item.name + " " + item.surname}
            salary={item.salary}
            isPaid={isPaidThisMonth} 
            isAdmin={role === "admin"} 
            monthName={selectedMonthKey}
            paidMonths={item.payments
              .filter(p => p.status === "PAID" && p.month > 0 && p.month <= 12)
              .map(p => `${MONTHS[p.month - 1] || "Unknown"} ${p.year}`)}
          />
        </td>
        <td className="hidden xl:table-cell">
          <PaymentTimeline payments={item.payments} />
        </td>
        <td>
          <div className="flex items-center gap-2">
            <Link href={`/list/teachers/${item.id}`}>
              <button className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaSky">
                <Image src="/view.png" alt="" width={16} height={16} />
              </button>
            </Link>
            {role === "admin" && (
              <>
                <CrudFormModal entity="teacher" mode="update" data={item} id={item.id} />
                <CrudFormModal entity="teacher" mode="delete" id={item.id} />
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="flex flex-col gap-4 relative">
        {role === "admin" && (
          <div className="absolute right-0 top-[-60px] flex items-center gap-3">
             <button 
               onClick={() => setIsBulkOpen(true)}
               className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 group"
             >
               <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
               AI Bulk Enroll
             </button>
          </div>
        )}
        
        <Table columns={columns} renderRow={renderRow} data={initialData} />
        <Pagination page={page} count={count} />
      </div>

      {isBulkOpen && (
        <BulkTeacherImport onClose={() => setIsBulkOpen(false)} />
      )}
    </>
  );
}
