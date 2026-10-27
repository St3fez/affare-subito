import { DEFAULT_SETTINGS } from "../analysis";
import { FISCAL_DEFAULTS, acquisitionCosts } from "../fiscal";
import { monthlyPayment } from "../mortgage";
import { analyzeRental } from "../rent";
import type { ListingData, OmiData } from "../types";

const omi: OmiData = {
  semester: "2026-S1",
  comuni: {
    "MILANO|MI": {
      istat: "15146",
      name: "Milano",
      province: "MI",
      zones: [{ code: "C1", description: "Lambrate", sale: { normale: { min: 3500, max: 4500 } }, rent: { normale: { min: 10, max: 14 } } }],
    },
  },
};
const deps = { omi, fiscal: FISCAL_DEFAULTS };

const listing: ListingData = {
  source: "nextData",
  listingKey: "immobiliare:1",
  contract: "rent",
  title: "Bilocale in affitto",
  propertyType: "appartamento",
  price: 840,
  sqm: 70,
  rooms: 2,
  bedrooms: 1,
  bathrooms: 1,
  floor: "",
  condition: "abitabile",
  hasElevator: null,
  hasGarage: null,
  condoMonthly: null,
  energyClass: "",
  city: "Milano",
  province: "MI",
  zone: "Lambrate",
  lat: null,
  lng: null,
};

test("verdetto sul canone e forchetta di un canone giusto per questi metri quadri", () => {
  const a = analyzeRental(listing, DEFAULT_SETTINGS, deps);
  if (a.kind !== "ok") throw new Error("atteso ok");
  expect(a.verdict).toMatchObject({ kind: "rent", level: "in_linea", pricePerSqm: 12 });
  expect(a.fairRent).toEqual({ min: 700, max: 980 });
  expect(a.market?.zoneCodes).toEqual(["C1"]);
});

test("comprare una casa così: prezzo di zona, soldi da avere subito e rata", () => {
  const a = analyzeRental(listing, DEFAULT_SETTINGS, deps);
  if (a.kind !== "ok") throw new Error("atteso ok");
  const price = 280000; // 4000 €/mq × 70 m²
  const taxes = acquisitionCosts({ price, firstHome: true }, FISCAL_DEFAULTS).total;
  expect(a.buy!.price).toBe(price);
  expect(a.buy!.upfront).toBeCloseTo(price * 0.2 + taxes, 2);
  expect(a.buy!.mortgageMonthly).toBeCloseTo(monthlyPayment(price * 0.8, 3.5, 25), 2);
});

test("senza valori di zona: nessun verdetto e nessun confronto con l'acquisto", () => {
  const a = analyzeRental({ ...listing, city: "Atlantide" }, DEFAULT_SETTINGS, deps);
  expect(a).toMatchObject({ kind: "ok", market: null, verdict: null, fairRent: null, buy: null });
});

test("una vendita, o un annuncio senza canone, non si analizzano qui", () => {
  expect(analyzeRental({ ...listing, contract: "sale" }, DEFAULT_SETTINGS, deps)).toEqual({ kind: "unsupported", reason: "not_a_rent" });
  expect(analyzeRental({ ...listing, price: null }, DEFAULT_SETTINGS, deps)).toEqual({ kind: "unsupported", reason: "price_missing" });
});

test("gli avvisi dei controlli arrivano al risultato", () => {
  const a = analyzeRental({ ...listing, price: 250000 }, DEFAULT_SETTINGS, deps);
  expect(a.kind === "ok" && a.warnings).toContain("looks_like_sale");
});
