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
