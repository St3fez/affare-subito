import { analyzeListing, DEFAULT_SETTINGS, type Analysis } from "../analysis";
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
      zones: [
        {
          code: "C1",
          description: "Lambrate",
          sale: { normale: { min: 1800, max: 2200 } },
          rent: { normale: { min: 9, max: 11 } },
        },
      ],
    },
  },
};

const deps = { omi, fiscal, costs };

const listing: ListingData = {
  source: "manual",
  listingKey: "k1",
  contract: "sale",
  title: "Trilocale",
  propertyType: "appartamento",
  price: 200000,
  sqm: 100,
  rooms: 4,
  bedrooms: 3,
  bathrooms: 2,
  floor: "2",
  condition: "abitabile",
  hasElevator: true,
  hasGarage: null,
  condoMonthly: 100,
  energyClass: "",
  city: "Milano",
  province: "MI",
  zone: "Lambrate",
  lat: null,
  lng: null,
};

const ok = (l: ListingData, settings = DEFAULT_SETTINGS) => {
  const a = analyzeListing(l, settings, deps);
  if (a.kind !== "ok") throw new Error(`atteso ok, ottenuto ${JSON.stringify(a)}`);
  return a;
};

const unknownCity = { ...listing, city: "Atlantide", province: "XX" };

test("analisi completa", () => {
  const a = ok(listing);
  expect(a.strategies.map((s) => s.usage)).toEqual(["live", "longTerm", "students", "airbnb"]);
  expect(a.market).toMatchObject({ precision: "zona" });
  expect(a.verdict).toMatchObject({ level: "in_linea", pricePerSqm: 2000 });
  expect(a.acquisition).toMatchObject({ total: 13920, outlay: 213920 });
  expect(a.renovation).toBe(15000); // abitabile → lavori leggeri, 150 €/mq
  expect(a.mortgageMonthly).toBeCloseTo(801, 1); // 160.000 € al 3,5% per 25 anni
});

test("costo per entrare per uso: la prima casa vale solo se ci vivi", () => {
  const a = ok(listing); // prima casa: registro al 2% solo per "viverci", 9% per gli affitti
  const secondHomeExtra = 14000; // 200.000 € × (9% − 2%)
  expect(a.totalToEnter.live).toBe(a.acquisition.outlay + a.renovation);
  expect(a.totalToEnter.longTerm).toBe(a.acquisition.outlay + a.renovation + secondHomeExtra);
  expect(a.totalToEnter.students).toBe(a.acquisition.outlay + a.renovation + secondHomeExtra + 3600);
  expect(a.totalToEnter.airbnb).toBe(a.acquisition.outlay + a.renovation + secondHomeExtra + 30000);
});

test("già seconda casa: nessuna differenza tra gli usi", () => {
  const a = ok(listing, { ...DEFAULT_SETTINGS, firstHome: false });
  expect(a.totalToEnter.longTerm).toBe(a.totalToEnter.live);
});

test("la resa degli affitti tiene conto del registro da seconda casa", () => {
  const first = ok(listing).strategies.find((s) => s.usage === "longTerm")!;
  const second = ok(listing, { ...DEFAULT_SETTINGS, firstHome: false }).strategies.find((s) => s.usage === "longTerm")!;
  expect(first.netYieldPct).toBeCloseTo(second.netYieldPct, 6);
});

test("negozio o box → non supportato", () => {
  expect(analyzeListing({ ...listing, propertyType: "negozio" }, DEFAULT_SETTINGS, deps)).toEqual({ kind: "unsupported", reason: "not_residential" });
});

test("l'affitto di zona è il punto medio della forchetta OMI", () => {
  const longTerm = ok(listing).strategies.find((s) => s.usage === "longTerm")!;
  expect(longTerm.monthlyIncome).toBeCloseTo(916.67, 2); // 10 €/mq × 100 mq, meno un mese di vacanza all'anno
});

test("l'affitto al mq usato nei conti", () => {
  expect(ok(listing).rentSqm).toBe(10); // punto medio di 9-11 €/mq
  expect(ok(listing, { ...DEFAULT_SETTINGS, manualRentSqm: 20 }).rentSqm).toBe(20);
  expect(ok(unknownCity).rentSqm).toBe(0);
});

test("lavori a mano", () => expect(ok(listing, { ...DEFAULT_SETTINGS, renovationOverride: 5000 }).renovation).toBe(5000));

test("stato sconosciuto → nessun costo di lavori inventato", () =>
  expect(ok({ ...listing, condition: null }).renovation).toBe(0));

test("annuncio d'affitto → non supportato", () =>
  expect(analyzeListing({ ...listing, contract: "rent" }, DEFAULT_SETTINGS, deps)).toEqual({ kind: "unsupported", reason: "not_a_sale" }));

test("prezzo mancante → non supportato, niente NaN", () =>
  expect(analyzeListing({ ...listing, price: null }, DEFAULT_SETTINGS, deps)).toEqual({ kind: "unsupported", reason: "price_missing" }));

test("il primo blocco è quello riportato", () =>
  expect(analyzeListing({ ...listing, contract: "rent", price: null }, DEFAULT_SETTINGS, deps)).toEqual({ kind: "unsupported", reason: "not_a_sale" }));

test("comune assente dai dati: nessun riferimento, ma i costi si vedono", () => {
  const a = ok(unknownCity);
  expect(a.market).toBeNull();
  expect(a.verdict).toBeNull();
  expect(a.strategies.every((s) => s.monthlyIncome === 0)).toBe(true);
  expect(a.strategies.every((s) => s.warnings.join(" ").match(/riferimento/))).toBe(true);
  expect(a.acquisition.total).toBeGreaterThan(0);
  expect(a.renovation).toBe(15000);
});

test("affitto al mq inserito a mano", () => {
  const a = ok(unknownCity, { ...DEFAULT_SETTINGS, manualRentSqm: 10 });
  expect(a.strategies.find((s) => s.usage === "longTerm")!.monthlyIncome).toBeCloseTo(916.67, 2);
});

test("l'affitto a mano vale più del riferimento di zona", () => {
  const a = ok(listing, { ...DEFAULT_SETTINGS, manualRentSqm: 20 });
  expect(a.strategies.find((s) => s.usage === "longTerm")!.monthlyIncome).toBeCloseTo(1833.33, 2);
});

test("anticipo 100% → rata 0", () =>
  expect(ok(listing, { ...DEFAULT_SETTINGS, downPaymentPct: 100 }).mortgageMonthly).toBe(0));

test("metri quadri assurdi → avviso, l'analisi resta possibile", () => {
  const a = ok({ ...listing, sqm: 4200 });
  expect(a.warnings).toContain("sqm_implausible");
});

test("camere e spese condominiali sconosciute non rompono i conti", () => {
  const a = ok({ ...listing, bedrooms: null, condoMonthly: null });
  expect(a.strategies).toHaveLength(4);
  for (const s of a.strategies) for (const v of [s.monthlyIncome, s.monthlyCosts, s.annualNet, s.netYieldPct]) expect(Number.isFinite(v)).toBe(true);
});

test("tipo", () => {
  const a: Analysis = analyzeListing(listing, DEFAULT_SETTINGS, deps);
  expect(a.kind).toBe("ok");
});
