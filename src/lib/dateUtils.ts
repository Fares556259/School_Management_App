export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 
 * Given a month param string (e.g. "2-2026"), return the "Month Year" key used in payment titles.
 * Defaults to the current month if no param is provided.
 */
export function getMonthKey(monthParam: string | undefined): string {
  const now = new Date();
  if (!monthParam) {
    return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  }
  const [m, y] = monthParam.split("-").map(Number);
  // Basic validation to avoid NaN errors
  if (isNaN(m) || isNaN(y)) {
    return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  }
  return `${MONTHS[m]} ${y}`;
}

/** Returns the month before the given monthKey (e.g. "April 2026" -> "March 2026") */
export function getPreviousMonth(monthKey: string): string {
  const [mName, yStr] = monthKey.split(" ");
  let mIndex = MONTHS.indexOf(mName);
  let y = parseInt(yStr);

  if (mIndex === 0) {
    mIndex = 11;
    y--;
  } else {
    mIndex--;
  }
  return `${MONTHS[mIndex]} ${y}`;
}

/** Check if monthA is chronologically before monthB */
export function isMonthBefore(monthA: string, monthB: string): boolean {
  if (monthA === monthB) return false;
  
  const [mA_Name, yA_Str] = monthA.split(" ");
  const [mB_Name, yB_Str] = monthB.split(" ");
  
  const yA = parseInt(yA_Str);
  const yB = parseInt(yB_Str);
  const mA = MONTHS.indexOf(mA_Name);
  const mB = MONTHS.indexOf(mB_Name);

  if (yA !== yB) return yA < yB;
  return mA < mB;
}

/** Returns a list of months between startKey and endKey (exclusive of endKey) */
export function getMonthsBetween(startKey: string, endKey: string): string[] {
  const months = [];
  let current = startKey;
  while (isMonthBefore(current, endKey)) {
    months.push(current);
    current = getNextMonth(current);
  }
  return months;
}

/** Returns the month after the given monthKey */
export function getNextMonth(monthKey: string): string {
  const [mName, yStr] = monthKey.split(" ");
  let mIndex = MONTHS.indexOf(mName);
  let y = parseInt(yStr);

  if (mIndex === 11) {
    mIndex = 0;
    y++;
  } else {
    mIndex++;
  }
  return `${MONTHS[mIndex]} ${y}`;
}

/** Returns the 10 months of the academic year based on a given date */
export function getSchoolYearMonths(date: Date = new Date()): string[] {
  const currentMonthIndex = date.getMonth();
  const currentYear = date.getFullYear();

  // If Jan-Jun, year started in Sep last year. If Aug-Dec, starts Sep this year.
  const schoolYearStartYear = (currentMonthIndex >= 8) ? currentYear : currentYear - 1;

  const months = [
    { m: 8, y: schoolYearStartYear },        // Sep
    { m: 9, y: schoolYearStartYear },        // Oct
    { m: 10, y: schoolYearStartYear },       // Nov
    { m: 11, y: schoolYearStartYear },       // Dec
    { m: 0, y: schoolYearStartYear + 1 },    // Jan
    { m: 1, y: schoolYearStartYear + 1 },    // Feb
    { m: 2, y: schoolYearStartYear + 1 },    // Mar
    { m: 3, y: schoolYearStartYear + 1 },    // Apr
    { m: 4, y: schoolYearStartYear + 1 },    // May
    { m: 5, y: schoolYearStartYear + 1 },    // Jun
  ];

  return months.map(({ m, y }) => `${MONTHS[m]} ${y}`);
}


