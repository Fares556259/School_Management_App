"use client";
import { useState } from "react";
import { receiveStudentPayment } from "@/app/(dashboard)/list/students/actions";
import { payTeacherSalary } from "@/app/(dashboard)/list/teachers/actions";
import { payStaffSalary } from "@/app/(dashboard)/list/staff/actions";

export default function QuickPayButton({ id, name, amount, monthYear, type }: { id: string, name: string, amount: number, monthYear: string, type: "student"|"teacher"|"staff" }) {
  const [loading, setLoading] = useState(false);
  const handlePay = async () => {
    setLoading(true);
    try {
      if (type === "student") await receiveStudentPayment(id, name, amount, monthYear);
      if (type === "teacher") await payTeacherSalary(id, name, amount, monthYear);
      if (type === "staff") await payStaffSalary(id, name, amount, monthYear);
    } catch(e) { console.error(e) }
    setLoading(false);
  };
  return (
    <button disabled={loading} onClick={handlePay} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black rounded-lg shadow-sm transition-all disabled:opacity-50 tracking-wider">
      {loading ? "..." : type === "student" ? "COLLECT" : "PAY"}
    </button>
  );
}
