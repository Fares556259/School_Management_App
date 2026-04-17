const holidays = [
  { name: "Legacy Holiday", date: "2026-04-17" },
  { name: "Spring Break", startDate: "2026-04-20", endDate: "2026-04-22" }
];

function checkHoliday(day) {
  const dateStrIso = `2026-04-${day.toString().padStart(2, '0')}`;
  const match = holidays.find((h) => {
    const start = h.startDate || h.date;
    const end = h.endDate || h.date;
    return dateStrIso >= start && dateStrIso <= end;
  });
  return match ? match.name : null;
}

console.log("Checking 17th:", checkHoliday(17)); // Should be Legacy Holiday
console.log("Checking 19th:", checkHoliday(19)); // Should be null
console.log("Checking 20th:", checkHoliday(20)); // Should be Spring Break
console.log("Checking 21st:", checkHoliday(21)); // Should be Spring Break
console.log("Checking 22nd:", checkHoliday(22)); // Should be Spring Break
console.log("Checking 23rd:", checkHoliday(23)); // Should be null
