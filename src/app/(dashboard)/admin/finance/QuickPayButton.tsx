"use client";
import { useState } from "react";
import { receiveStudentPayment } from "@/app/(dashboard)/list/students/actions";
import { payTeacherSalary } from "@/app/(dashboard)/list/teachers/actions";
import { payStaffSalary } from "@/app/(dashboard)/list/staff/actions";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface QuickPayButtonProps {
  id: string;
  name: string;
  amount: number;
  monthYear: string;
  type: "student" | "teacher" | "staff";
  onSuccess?: (id: string, amount: number) => void;
}

export default function QuickPayButton({
  id,
  name,
  amount,
  monthYear,
  type,
  onSuccess,
}: QuickPayButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();

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
        toast.success(
          type === "student"
            ? `✓ ${t.actionCenter.collect}: ${name}`
            : `✓ ${t.actionCenter.pay}: ${name}`
        );
        if (onSuccess) {
          onSuccess(id, amount);
        }
        router.refresh();
      } else {
        toast.error(result?.error || "Erreur lors du traitement");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const isStudent = type === "student";

  return (
    <button
      disabled={loading}
      onClick={(e) => {
        e.stopPropagation();
        handlePay();
      }}
      className={`px-3 py-1.5 text-[12px] font-medium rounded-[6px] shadow-sm transition-all disabled:opacity-50 min-w-[70px] flex items-center justify-center ${
        isStudent
          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
          : "bg-[#181d26] hover:bg-[#333840] text-white"
      }`}
    >
      {loading ? (
        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : isStudent ? (
        t.actionCenter?.collect || "Collecter"
      ) : (
        t.actionCenter?.pay || "Payer"
      )}
    </button>
  );
}
