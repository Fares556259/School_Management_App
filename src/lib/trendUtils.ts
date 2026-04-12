/**
 * Calculates percentage trend between current and previous values.
 * Returns a signed percentage (e.g. +12.5 or -5.0)
 */
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Formats trend for display with + sign for positive values
 */
export function formatTrend(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
