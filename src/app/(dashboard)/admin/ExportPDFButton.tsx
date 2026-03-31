"use client";
import { useState } from "react";

export default function ExportButton({ data, headers, filename }: { data: any[], headers: string[], filename: string }) {
  const [loading, setLoading] = useState(false);

  const downloadCSV = () => {
    setLoading(true);
    try {
      if (data.length === 0) return;
      const csvStr = [
        headers.join(","),
        ...data.map(d => Object.values(d).join(","))
      ].join("\n");
      
      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch(e) { }
    setLoading(false);
  };

  return (
    <button onClick={downloadCSV} disabled={loading} className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md hover:bg-slate-200 transition-colors flex items-center gap-1">
      {loading ? "..." : "⬇ Export CSV"}
    </button>
  );
}
