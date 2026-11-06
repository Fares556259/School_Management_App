/** Overtime is a separate addition, independent of the absence deduction rate. */
export function overtimeValues(
  hours: number,
  defaultRate: number,
  amount?: number,
) {
  if (
    !Number.isFinite(hours) ||
    hours < 0 ||
    hours > 744 ||
    Math.abs(hours * 100 - Math.round(hours * 100)) > 0.00001
  ) {
    throw new Error(
      "Heures supplémentaires invalides (0 à 744, maximum 2 décimales).",
    );
  }
  if (
    amount !== undefined &&
    (!Number.isFinite(amount) ||
      amount < 0 ||
      amount > 1000000 ||
      Math.abs(amount * 1000 - Math.round(amount * 1000)) > 0.00001)
  ) {
    throw new Error(
      "Montant des heures supplémentaires invalide (maximum 3 décimales).",
    );
  }
  if (hours === 0) {
    if (amount)
      throw new Error("Indiquez les heures correspondant à ce montant.");
    return { rate: 0, amount: 0 };
  }
  if (amount !== undefined) return { rate: amount / hours, amount };
  if (!Number.isFinite(defaultRate) || defaultRate <= 0) {
    throw new Error(
      "Renseignez le montant des heures supplémentaires ou le taux horaire.",
    );
  }
  return {
    rate: defaultRate,
    amount: Math.round(hours * defaultRate * 1000) / 1000,
  };
}

export type OvertimeEntry =
  | { mode: "hourly"; hours: number; rate: number }
  | { mode: "fixed"; amount: number }
  | { mode: "reset" };

export function totalOvertime(
  payment:
    | {
        overtimeHours?: number | null;
        overtimeRate?: number | null;
        overtimeFixedAmount?: number | null;
      }
    | null
    | undefined,
  defaultRate = 0,
) {
  return (
    Math.round(
      ((payment?.overtimeHours || 0) * (payment?.overtimeRate ?? defaultRate) +
        (payment?.overtimeFixedAmount || 0)) *
        1000,
    ) / 1000
  );
}

/** Append to the month; fixed additions never invent worked hours. */
export function appendOvertime(
  current: {
    overtimeHours?: number | null;
    overtimeRate?: number | null;
    overtimeFixedAmount?: number | null;
  } | null,
  entry: OvertimeEntry,
  defaultRate: number,
) {
  const previousHours = current?.overtimeHours || 0;
  const previousRate = current?.overtimeRate ?? defaultRate;
  const previousFixed = current?.overtimeFixedAmount || 0;
  if (entry.mode === "reset") return { hours: 0, rate: 0, fixedAmount: 0 };
  if (entry.mode === "fixed") {
    if (
      typeof entry.amount !== "number" ||
      !Number.isFinite(entry.amount) ||
      entry.amount <= 0 ||
      entry.amount > 1000000 ||
      Math.abs(entry.amount * 1000 - Math.round(entry.amount * 1000)) > 0.00001
    )
      throw new Error("Montant invalide (positif, maximum 3 décimales).");
    const fixedAmount =
      Math.round((previousFixed + entry.amount) * 1000) / 1000;
    if (fixedAmount + previousHours * previousRate > 1000000)
      throw new Error("Montant mensuel trop élevé.");
    return { hours: previousHours, rate: previousRate, fixedAmount };
  }
  if (
    entry.mode !== "hourly" ||
    typeof entry.hours !== "number" ||
    entry.hours <= 0 ||
    typeof entry.rate !== "number" ||
    !Number.isFinite(entry.rate) ||
    entry.rate <= 0 ||
    entry.rate > 1000000 ||
    Math.abs(entry.rate * 1000 - Math.round(entry.rate * 1000)) > 0.00001
  )
    throw new Error(
      "Indiquez les heures et un taux horaire positif (maximum 3 décimales).",
    );
  overtimeValues(entry.hours, entry.rate);
  const hours = Math.round((previousHours + entry.hours) * 100) / 100;
  if (hours > 744)
    throw new Error("Le total mensuel ne peut pas dépasser 744 heures.");
  const hourlyAmount =
    Math.round(
      (previousHours * previousRate + entry.hours * entry.rate) * 1000,
    ) / 1000;
  if (hourlyAmount + previousFixed > 1000000)
    throw new Error("Montant mensuel trop élevé.");
  return { hours, rate: hourlyAmount / hours, fixedAmount: previousFixed };
}
