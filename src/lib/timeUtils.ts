/**
 * Parses a time string like "08:30 AM", "02:15 PM", or "14:00" 
 * into numeric hours and minutes (24-hour format).
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
  if (!timeStr) return { hours: 0, minutes: 0 };

  const cleanTime = timeStr.trim().toUpperCase();
  const isPM = cleanTime.endsWith("PM");
  const isAM = cleanTime.endsWith("AM");
  
  // Remove AM/PM and split by colon
  const timeOnly = cleanTime.replace("AM", "").replace("PM", "").trim();
  const parts = timeOnly.split(":");
  
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return { hours, minutes };
}
