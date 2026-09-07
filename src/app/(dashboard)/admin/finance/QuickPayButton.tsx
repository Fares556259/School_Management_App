"use client";
import { useState } from "react";
import { receiveStudentPayment } from "@/app/(dashboard)/list/students/actions";
import { payTeacherSalary } from "@/app/(dashboard)/list/teachers/actions";
import { payStaffSalary } from "@/app/(dashboard)/list/staff/actions";
import { toast } from "react-toastify";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface QuickPayButtonProps {
  id: string;
  name: string;
  amount: number;
  monthYear: string;
  type: "student" | "teacher" | "staff";
  onOptimisticPay?: (id: string, amount: number) => void;
  onRollback?: (id: string, amount: number) => void;
  onSuccess?: (id: string, amount: number) => void;
}

export default function QuickPayButton({
  id,
  name,
  amount,
  monthYear,
  type,
  onOptimisticPay,
  onRollback,
  onSuccess,
}: QuickPayButtonProps) {
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handlePay = async () => {
    // 1. INSTANT OPTIMISTIC TRIGGER (0ms)
    // Synchronously remove the item from the view and decrement pending totals immediately!
    if (onOptimisticPay) {
      onOptimisticPay(id, amount);
    } else if (onSuccess) {
      onSuccess(id, amount);
    }

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
            ? `✓ ${t.actionCenter?.collect || "Encaissé"}: ${name}`
            : `✓ ${t.actionCenter?.pay || "Payé"}: ${name}`
        );
      } else {
        // Rollback optimistic state if server rejects
        if (onRollback) {
          onRollback(id, amount);
        }
        toast.error(result?.error || t.toasts.operationFailed);
      }
    } catch (e: any) {
      console.error(e);
      // Rollback optimistic state if network fails
      if (onRollback) {
        onRollback(id, amount);
      }
      toast.error(t.toasts.connectionError);
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
      className={`px-3 py-1.5 text-[12px] font-medium rounded-[6px] shadow-sm transition-all disabled:opacity-50 min-w-[70px] flex items-center justify-center cursor-pointer ${
        isStudent
          ? "bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white"
          : "bg-[#181d26] hover:bg-[#333840] active:scale-95 text-white"
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
