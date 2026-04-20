"use client";
import { useState } from "react";
import { receiveStudentPayment } from "@/app/(dashboard)/list/students/actions";
import { payTeacherSalary } from "@/app/(dashboard)/list/teachers/actions";
import { payStaffSalary } from "@/app/(dashboard)/list/staff/actions";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function QuickPayButton({ id, name, amount, monthYear, type }: { id: string, name: string, amount: number, monthYear: string, type: "student"|"teacher"|"staff" }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePay = async () => {
    setLoading(true);
    try {
      let result;
      if (type === "student") {
        result = await receiveStudentPayment(id, name, amount, monthYear);
      } else if (type === "teacher") {
        result = await payTeacherSalary(id, name, amount, monthYear);
      } else if (type === "staff") {
        result = await payStaffSalary(id, name, amount, monthYear);
      }

      if (result?.success) {
        toast.success(`Succès: ${type === "student" ? "Frais collectés" : "Salaire payé"} pour ${name}`);
        // FORCE UI REFRESH
        router.refresh();
      } else {
        toast.error(result?.error || "Erreur lors du traitement");
      }
    } catch(e: any) { 
      console.error(e);
      toast.error("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      disabled={loading} 
      onClick={(e) => {
        e.stopPropagation();
        handlePay();
      }} 
      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black rounded-lg shadow-sm transition-all disabled:opacity-50 tracking-wider min-w-[70px] flex items-center justify-center"
    >
      {loading ? (
        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        type === "student" ? "COLLECT" : "PAY"
      )}
    </button>
  );
}
