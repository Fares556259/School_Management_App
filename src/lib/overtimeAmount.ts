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
