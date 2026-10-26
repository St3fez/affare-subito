import { roundCents } from "./format";
import type { FiscalTable } from "./fiscal";
import type { Usage } from "./types";

export type Assumptions = {
  vacancyMonthsLongTerm: number;
  vacancyMonthsStudents: number;
  /** % del prezzo all'anno. */
  imuPctOfPriceYear: number;
  /** % del prezzo all'anno. */
  maintenancePctOfPriceYear: number;
  /** Canone complessivo delle stanze rispetto all'affitto dell'intera casa. */
  studentRoomFactor: number;
  studentUtilitiesPerRoomMonthly: number;
  /** €/notte; null = affitto mensile a lungo termine diviso 10. */
  airbnbNightlyRate: number | null;
  airbnbOccupancyPct: number;
  airbnbPlatformFeePct: number;
  airbnbCleaningPerStay: number;
  airbnbAvgStayNights: number;
  airbnbUtilitiesMonthly: number;
};

// Ipotesi iniziali, modificabili in UI: per questi numeri non esistono dati gratuiti affidabili per zona.
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  vacancyMonthsLongTerm: 1,
  vacancyMonthsStudents: 2,
  imuPctOfPriceYear: 0.4,
  maintenancePctOfPriceYear: 0.5,
  studentRoomFactor: 1.3,
  studentUtilitiesPerRoomMonthly: 40,
  airbnbNightlyRate: null,
  airbnbOccupancyPct: 55,
  airbnbPlatformFeePct: 3,
  airbnbCleaningPerStay: 40,
  airbnbAvgStayNights: 3,
  airbnbUtilitiesMonthly: 150,
};

export type StrategyInput = {
  price: number;
  sqm: number;
  bedrooms: number;
  firstHome: boolean;
  /** Prezzo più costi di acquisto (`Acquisition.outlay`). */
  outlay: number;
  renovation: number;
  /** Arredo per questo uso. */
  furnishing: number;
  condoMonthly: number;
  /** Affitto di zona in €/mq al mese; 0 se non c'è riferimento. */
  rentSqm: number;
  mortgageMonthly: number;
};

export type StrategyResult = {
  usage: Usage;
  monthlyIncome: number;
  monthlyCosts: number;
  annualTax: number;
  annualNet: number;
  netYieldPct: number;
  monthlyCashflow: number;
  warnings: string[];
};

export function evaluateStrategy(usage: Usage, input: StrategyInput, a: Assumptions, fiscal: FiscalTable): StrategyResult {
  const rent = Math.max(0, input.rentSqm) * Math.max(0, input.sqm);
  const imu = (input.price * (a.imuPctOfPriceYear / 100)) / 12;
  const maintenance = (input.price * (a.maintenancePctOfPriceYear / 100)) / 12;
  const ownerCosts = input.condoMonthly + maintenance;

  let income = 0;
  let costs = 0;
  let taxRatePct = 0;
  const warnings: string[] = [];

  switch (usage) {
    case "live":
      income = rent; // l'affitto che non si paga
      costs = ownerCosts + (input.firstHome ? 0 : imu);
      break;
    case "longTerm":
      income = rent - (rent * a.vacancyMonthsLongTerm) / 12;
      costs = ownerCosts + imu;
      taxRatePct = fiscal.cedolareLongTermPct.value;
      break;
    case "students": {
      const rooms = Math.max(1, input.bedrooms);
      const gross = rent * a.studentRoomFactor;
      income = gross - (gross * a.vacancyMonthsStudents) / 12;
      costs = ownerCosts + imu + rooms * a.studentUtilitiesPerRoomMonthly;
      taxRatePct = fiscal.cedolareLongTermPct.value;
      warnings.push("Le stanze a studenti rendono solo vicino a un'università: verifica la domanda di posti letto in zona.");
      break;
    }
    case "airbnb": {
      const nightly = a.airbnbNightlyRate ?? rent / 10;
      income = nightly * 30 * (a.airbnbOccupancyPct / 100);
      const staysPerMonth = a.airbnbAvgStayNights > 0 ? (30 * (a.airbnbOccupancyPct / 100)) / a.airbnbAvgStayNights : 0;
      costs =
        ownerCosts +
        imu +
        a.airbnbUtilitiesMonthly +
        (income * a.airbnbPlatformFeePct) / 100 +
        staysPerMonth * a.airbnbCleaningPerStay;
      taxRatePct = fiscal.cedolareShortTermPct.value;
      warnings.push(
        "Affitti brevi: serve il CIN (codice identificativo nazionale); verifica i limiti del comune e il regolamento del condominio.",
        "L'aliquota ridotta vale per una sola unità; per le altre è più alta e dal 2026 il regime vale al massimo per due appartamenti."
      );
      break;
    }
  }

  if (!(input.rentSqm > 0)) warnings.push("Nessun riferimento di affitto per questa zona: inserisci un affitto al mq.");

  const annualTax = (taxRatePct / 100) * income * 12;
  const annualNet = (income - costs) * 12 - annualTax;
  const investment = input.outlay + input.renovation + input.furnishing;

  return {
    usage,
    monthlyIncome: roundCents(income),
    monthlyCosts: roundCents(costs),
    annualTax: roundCents(annualTax),
    annualNet: roundCents(annualNet),
    netYieldPct: investment > 0 ? (annualNet / investment) * 100 : 0,
    monthlyCashflow: roundCents(annualNet / 12 - input.mortgageMonthly),
    warnings,
  };
}
