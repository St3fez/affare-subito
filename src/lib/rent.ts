import type { AnalysisSettings } from "./analysis";
import { acquisitionCosts, type FiscalTable } from "./fiscal";
import { roundCents } from "./format";
import { checkListing } from "./listing/check";
import { lookupMarket, pointOf, type MarketReference } from "./market";
import { monthlyPayment } from "./mortgage";
import type { Issue, ListingData, OmiData, OmiZoneShapes, Range } from "./types";
import { buildRentVerdict, omiStateFor, type Verdict } from "./verdict";

export type RentalAnalysis =
  | { kind: "unsupported"; reason: Issue }
  | {
      kind: "ok";
      listing: ListingData;
      market: MarketReference | null;
      verdict: Verdict | null;
      /** Il canone al mese che la forchetta di zona dà per questi metri quadri. */
      fairRent: Range | null;
      /** Comprare una casa così: prezzo di zona, soldi da avere subito (anticipo e costi d'acquisto da prima casa) e rata. */
      buy: { price: number; upfront: number; mortgageMonthly: number } | null;
      warnings: Issue[];
    };

const toTens = (value: number) => Math.round(value / 10) * 10;
const toThousands = (value: number) => Math.round(value / 1000) * 1000;

/** Per chi cerca casa in affitto: il canone è giusto? E comprarne una simile quanto costerebbe? */
export function analyzeRental(
  listing: ListingData,
  settings: AnalysisSettings,
  deps: { omi: OmiData; fiscal: FiscalTable; shapes?: OmiZoneShapes | null }
): RentalAnalysis {
  if (listing.contract !== "rent") return { kind: "unsupported", reason: "not_a_rent" };
  const { blocking, warnings } = checkListing(listing);
  if (blocking.length > 0) return { kind: "unsupported", reason: blocking[0] };

  const rent = listing.price as number;
  const sqm = listing.sqm as number;
  const market = lookupMarket(deps.omi, { city: listing.city, province: listing.province, zone: listing.zone, point: pointOf(listing) }, deps.shapes);
  const verdict = buildRentVerdict({ rent, sqm, condition: listing.condition }, market);
  const fairRent = verdict ? { min: toTens(verdict.reference.min * sqm), max: toTens(verdict.reference.max * sqm) } : null;

  let buy: { price: number; upfront: number; mortgageMonthly: number } | null = null;
  const wanted = omiStateFor(listing.condition);
  const saleRange = market?.sale[wanted] ?? market?.sale.normale;
  if (saleRange) {
    const price = toThousands(((saleRange.min + saleRange.max) / 2) * sqm);
    const downPayment = price * (settings.downPaymentPct / 100);
    const taxes = acquisitionCosts({ price, firstHome: true }, deps.fiscal).total;
    buy = {
      price,
      upfront: roundCents(downPayment + taxes),
      mortgageMonthly: roundCents(monthlyPayment(price - downPayment, settings.ratePct, settings.years)),
    };
  }

  return { kind: "ok", listing, market, verdict, fairRent, buy, warnings };
}
