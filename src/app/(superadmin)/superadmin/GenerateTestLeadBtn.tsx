"use client";

import { createTestLead } from "./actions";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlusCircle, Loader2 } from "lucide-react";

export default function GenerateTestLeadBtn() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleCreate = async () => {
        setLoading(true);
        try {
            const res = await createTestLead();
            if (res.success) {
                toast.success("Test Lead generated! Refreshing...");
                router.refresh();
            } else {
                toast.error("Generation failed: " + res.error);
            }
        } catch (err) {
            toast.error("Internal Error during generation.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button 
            onClick={handleCreate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 disabled:opacity-50"
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            Generate Test Application
        </button>
    );
}
