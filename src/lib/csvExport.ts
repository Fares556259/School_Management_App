
export const downloadCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]).map(h => `"${h.replace(/"/g, '""')}"`).join(",");
  const rows = data.map(row => 
    Object.values(row).map(value => {
      const strValue = value === null || value === undefined ? "" : String(value);
      return `"${strValue.replace(/"/g, '""')}"`;
    }).join(",")
  );
  
  const csvContent = "\ufeff" + [headers, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
