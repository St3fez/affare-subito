import { furnishingCost, renovationCost, renovationLevelFor, type CostTable } from "./costs";
import { acquisitionCosts, type Acquisition, type FiscalTable } from "./fiscal";
import { roundCents } from "./format";
import { checkListing } from "./listing/check";
import { lookupMarket, type MarketReference } from "./market";
import { monthlyPayment } from "./mortgage";
import { DEFAULT_ASSUMPTIONS, evaluateStrategy, type Assumptions, type StrategyResult } from "./strategies";
import type { Issue, ListingData, OmiData, OmiState, Usage } from "./types";
import { buildVerdict, type Verdict } from "./verdict";

export type AnalysisSettings = {
  firstHome: boolean;
  downPaymentPct: number;
  ratePct: number;
  years: number;
  /** €/mq al mese inseriti dall'utente; ha la precedenza sul riferimento di zona. */
  manualRentSqm: number | null;
  /** € di lavori inseriti dall'utente; ha la precedenza sulla stima. */
  renovationOverride: number | null;
  assumptions: Assumptions;
};

// Il tasso del mutuo è un'ipotesi iniziale, modificabile.
export const DEFAULT_SETTINGS: AnalysisSettings = {
  firstHome: true,
  downPaymentPct: 20,
  ratePct: 3.5,
  years: 25,
  manualRentSqm: null,
  renovationOverride: null,
  assumptions: DEFAULT_ASSUMPTIONS,
};

export type Analysis =
  | { kind: "unsupported"; reason: Issue }
  | {
      kind: "ok";
      listing: ListingData;
      market: MarketReference | null;
      verdict: Verdict | null;
      acquisition: Acquisition;
      renovation: number;
      mortgageMonthly: number;
      /** Affitto al mq (€ al mese) usato nei conti: quello inserito a mano, altrimenti quello di zona, altrimenti 0. */
      rentSqm: number;
      strategies: StrategyResult[];
      totalToEnter: Record<Usage, number>;
      warnings: Issue[];
    };

const USAGES: Usage[] = ["live", "longTerm", "students", "airbnb"];
const RENT_STATES: OmiState[] = ["normale", "ottimo", "scadente"];

function marketRentSqm(market: MarketReference | null): number {
  if (!market) return 0;
  for (const state of RENT_STATES) {
    const range = market.rent[state];
    if (range) return (range.min + range.max) / 2;
  }
  return 0;
}

export function analyzeListing(
  listing: ListingData,
  settings: AnalysisSettings,
  deps: { omi: OmiData; fiscal: FiscalTable; costs: CostTable }
): Analysis {
  const { blocking, warnings } = checkListing(listing);
  if (blocking.length > 0) return { kind: "unsupported", reason: blocking[0] };

  const price = listing.price as number;
  const sqm = listing.sqm as number;
  const bedrooms = listing.bedrooms ?? 0;

  const market = lookupMarket(deps.omi, { city: listing.city, province: listing.province, zone: listing.zone });
  const verdict = buildVerdict({ price, sqm, condition: listing.condition }, market);
  const acquisition = acquisitionCosts({ price, firstHome: settings.firstHome }, deps.fiscal);
  const renovation = settings.renovationOverride ?? renovationCost(sqm, renovationLevelFor(listing.condition), deps.costs);

  const principal = price * (1 - settings.downPaymentPct / 100);
  const mortgageMonthly = roundCents(monthlyPayment(principal, settings.ratePct, settings.years));

  const rentSqm = settings.manualRentSqm != null && settings.manualRentSqm > 0 ? settings.manualRentSqm : marketRentSqm(market);

  const furnishing = Object.fromEntries(
    USAGES.map((usage) => [usage, furnishingCost(usage, { sqm, bedrooms }, deps.costs)])
  ) as Record<Usage, number>;

  const strategies = USAGES.map((usage) =>
    evaluateStrategy(
      usage,
      {
        price,
        sqm,
        bedrooms,
        firstHome: settings.firstHome,
        outlay: acquisition.outlay,
        renovation,
        furnishing: furnishing[usage],
        condoMonthly: listing.condoMonthly ?? 0,
        rentSqm,
        mortgageMonthly,
      },
      settings.assumptions,
      deps.fiscal
    )
  );

  const totalToEnter = Object.fromEntries(
    USAGES.map((usage) => [usage, roundCents(acquisition.outlay + renovation + furnishing[usage])])
  ) as Record<Usage, number>;

  return { kind: "ok", listing, market, verdict, acquisition, renovation, mortgageMonthly, rentSqm, strategies, totalToEnter, warnings };
}
