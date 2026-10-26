export function toNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function parseFlexibleNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;

  const separators = cleaned.match(/[.,]/g) ?? [];
  const decimalCandidate =
    separators.length === 1 &&
    cleaned.split(/[.,]/)[1] !== undefined &&
    cleaned.split(/[.,]/)[1].length !== 3;

  if (decimalCandidate) {
    const num = parseFloat(cleaned.replace(",", "."));
    return Number.isFinite(num) ? num : 0;
  }

  return toNumber(cleaned);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Arrotonda ai centesimi. */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
