"use client";

import { resetParentPassword } from "@/lib/crudActions";
import Image from "next/image";
import { useState } from "react";

const ResetPasswordButton = ({ parentId }: { parentId: string }) => {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset this parent's security? They will be forced to create a new password on their mobile app.")) {
      return;
    }

    setLoading(true);
    const result = await resetParentPassword(parentId);
    setLoading(false);

    if (result.success) {
      alert("Password has been reset successfully. The parent can now set up a new one.");
    } else {
      alert(result.error || "Failed to reset password.");
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className={`w-8 h-8 flex items-center justify-center rounded-[6px] border shadow-sm transition-colors ${
        loading 
          ? "bg-[#f8fafc] border-[#e2e8f0] text-[#94a3b8] cursor-not-allowed" 
          : "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 hover:text-indigo-700"
      }`}
      title="Reset Password"
    >
      {loading ? (
        <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"/>
          <circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>
        </svg>
      )}
    </button>
  );
};

export default ResetPasswordButton;
