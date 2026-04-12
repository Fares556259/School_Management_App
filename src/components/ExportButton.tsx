"use client";

type Row = Record<string, string | number | Date>;

function toCSV(rows: Row[], headers: string[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map(h => `"${row[h] ?? ""}"`).join(","));
  }
  return lines.join("\n");
}

export default function ExportButton({
  data,
  headers,
  filename,
}: {
  data: Row[];
  headers: string[];
  filename: string;
}) {
  const handleExport = () => {
    const csv = toCSV(data, headers);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
    >
      ⬇ Export CSV
    </button>
  );
}
