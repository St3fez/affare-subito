import { analyzeListing, DEFAULT_SETTINGS, type Analysis } from "../analysis";
import { buildComparison } from "../compare";
import type { CostTable } from "../costs";
import type { FiscalTable, Param } from "../fiscal";
import type { ListingData, OmiData } from "../types";

const param = (value: number): Param<number> => ({ value, source: "test", verifiedAt: null });

const fiscal: FiscalTable = {
  registroPctPrimaCasa: param(2),
  registroPctSeconda: param(9),
  registroMinimo: param(1000),
  ipotecariaCatastaleFisse: param(100),
  agencyPct: param(3.66),
  notaryEstimate: param(2500),
  cedolareLongTermPct: param(21),
  cedolareShortTermPct: param(21),
};
const costs: CostTable = {
  renovationPerSqm: { leggero: param(150), medio: param(400), pesante: param(900) },
  furnishing: { studentRoomKit: param(1200), airbnbPerSqm: param(300) },
};
const omi: OmiData = {
  semester: "2025-S2",
  comuni: {
    "Milano|MI": {
      istat: "15146",
      name: "Milano",
      province: "MI",
      zones: [{ code: "C1", description: "Lambrate", sale: { normale: { min: 1800, max: 2200 } }, rent: { normale: { min: 9, max: 11 } } }],
    },
  },
};
const deps = { omi, fiscal, costs };

const listing = (price: number | null, overrides: Partial<ListingData> = {}): ListingData => ({
  source: "manual",
  listingKey: `k${price}`,
  contract: "sale",
  title: "Trilocale",
  propertyType: "appartamento",
  price,
  sqm: 100,
  rooms: 4,
  bedrooms: 3,
  bathrooms: 2,
  floor: "2",
  condition: "abitabile",
  hasElevator: null,
  hasGarage: null,
  condoMonthly: 100,
  energyClass: "",
  city: "Milano",
  province: "MI",
  zone: "Lambrate",
  lat: null,
  lng: null,
  ...overrides,
});

const analysis = (l: ListingData): Analysis => analyzeListing(l, DEFAULT_SETTINGS, deps);
const row = (rows: ReturnType<typeof buildComparison>, id: string) => rows.find((r) => r.id === id)!;

test("righe del confronto, nell'ordine", () => {
  const rows = buildComparison(analysis(listing(200000)), analysis(listing(300000)));
  expect(rows.map((r) => r.id)).toEqual([
    "price",
    "pricePerSqm",
    "marketGap",
    "totalToEnter",
    "yieldLive",
    "yieldLongTerm",
    "yieldStudents",
    "yieldAirbnb",
    "mortgage",
  ]);
});

test("valori e quale è migliore", () => {
  const rows = buildComparison(analysis(listing(200000)), analysis(listing(300000)));
  expect(row(rows, "price")).toMatchObject({ a: 200000, b: 300000, better: "a" });
  expect(row(rows, "pricePerSqm")).toMatchObject({ a: 2000, b: 3000, better: "a" });
  expect(row(rows, "marketGap")).toMatchObject({ a: 0, better: "a" });
  expect(row(rows, "totalToEnter").better).toBe("a");
  expect(row(rows, "mortgage").better).toBe("a");
  // La stessa rendita su un prezzo più basso rende di più: vince la casa che costa meno.
  expect(row(rows, "yieldLongTerm").better).toBe("a");
});

test("la resa più alta è la migliore, anche quando è la seconda casa", () => {
  const rows = buildComparison(analysis(listing(300000)), analysis(listing(200000)));
  expect(row(rows, "yieldLive").better).toBe("b");
  expect(row(rows, "price").better).toBe("b");
});

test("valori uguali → nessuna è migliore", () => {
  const rows = buildComparison(analysis(listing(200000)), analysis(listing(200000, { listingKey: "altra" })));
  expect(row(rows, "price").better).toBeNull();
  expect(row(rows, "yieldLive").better).toBeNull();
});

test("senza fascia di mercato lo scarto manca, il resto si confronta", () => {
  const unknown = listing(250000, { city: "Atlantide", province: "XX" });
  const rows = buildComparison(analysis(listing(200000)), analysis(unknown));
  expect(row(rows, "marketGap")).toMatchObject({ b: null, better: null });
  expect(row(rows, "price").better).toBe("a");
});

test("un'analisi non supportata dà valori vuoti e nessun vincitore", () => {
  const rent = analysis(listing(200000, { contract: "rent" }));
  expect(rent.kind).toBe("unsupported");
  const rows = buildComparison(analysis(listing(200000)), rent);
  for (const r of rows) expect(r).toMatchObject({ b: null, better: null });
  expect(row(rows, "price").a).toBe(200000);
});
