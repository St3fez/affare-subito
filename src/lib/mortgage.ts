export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;

  const monthlyRate = annualRatePct / 100 / 12;
  const installments = Math.max(1, Math.round(years * 12));

  if (monthlyRate <= 0) {
    return principal / installments;
  }

  const factor = Math.pow(1 + monthlyRate, installments);
  return principal * ((monthlyRate * factor) / (factor - 1));
}
