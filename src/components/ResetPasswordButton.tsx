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
      className={`w-7 h-7 flex items-center justify-center rounded-full ${
        loading ? "bg-gray-200" : "bg-lamaYellow hover:bg-yellow-400"
      }`}
      title="Reset Password"
    >
      <Image src="/update.png" alt="" width={16} height={16} />
    </button>
  );
};

export default ResetPasswordButton;
