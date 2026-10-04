// Group records by "Month Year" and sum amounts
export function groupByMonth(records: { date: Date | string; amount: number }[]) {
  const map: Record<string, number> = {};
  for (const r of records) {
    const key = new Date(r.date).toLocaleString("en-US", { month: "short", year: "numeric" });
    map[key] = (map[key] || 0) + r.amount;
  }
  return map;
}

// Get last 6 month labels
export function getLast6Months(now = new Date()): string[] {
  const months: string[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  d.setMonth(d.getMonth() - 5);
  for (let i = 0; i < 6; i++) {
    months.push(d.toLocaleString("en-US", { month: "short", year: "numeric" }));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}
