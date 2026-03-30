"use client";

import { useState, useTransition } from "react";
import { toggleTeacherPaidStatus } from "./actions";

export default function PaidStatusToggle({
  teacherId,
  initialStatus,
  isAdmin,
}: {
  teacherId: string;
  initialStatus: boolean;
  isAdmin: boolean;
}) {
  const [isPaid, setIsPaid] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (!isAdmin) return;

    // Optimistically update the UI
    const previousStatus = isPaid;
    setIsPaid(!previousStatus);

    startTransition(async () => {
      const result = await toggleTeacherPaidStatus(teacherId, previousStatus);
      if (!result.success) {
        // Revert on failure
        setIsPaid(previousStatus);
        alert(result.error);
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={!isAdmin || isPending}
      className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
        isPaid
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "bg-rose-100 text-rose-700 border border-rose-200"
      } ${
        isAdmin && !isPending
          ? "hover:opacity-80 cursor-pointer"
          : "cursor-default opacity-90"
      }`}
    >
      {isPending ? "Updating..." : isPaid ? "Paid" : "Unpaid"}
    </button>
  );
}
