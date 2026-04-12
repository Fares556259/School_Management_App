"use client";

import { downloadCSV } from "@/lib/csvExport";
import { Download } from "lucide-react";

export default function FinanceExportButton({ 
  data, 
  filename 
}: { 
  data: any[], 
  filename: string 
}) {
  const handleExport = () => {
    if (data.length === 0) return;
    
    // Format data for export
    const exportData = data.map(item => ({
      Description: item.title,
      Amount: item.amount,
      Category: item.category,
      Date: new Date(item.date).toLocaleDateString(),
      "Related/From": item.receivedFrom || item.relatedTo || "General"
    }));

    downloadCSV(exportData, `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <button 
      onClick={handleExport}
      className={`w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow transition-all hover:bg-yellow-100 hover:shadow-sm ${data.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
      title={`Export All Filtered ${filename} to CSV`}
      disabled={data.length === 0}
    >
      <Download size={14} className="text-slate-700" />
    </button>
  );
}
