const now = new Date(2026, 3, 20); // April 20 (month is 0-indexed)
console.log("Local time now:", now.toString());
console.log("ISO string now:", now.toISOString());
console.log("Split ISO date:", now.toISOString().split('T')[0]);

const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const manualIso = `${year}-${month}-${day}`;
console.log("Manual ISO date:", manualIso);
