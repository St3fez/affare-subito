import type { FiscalTable, Param } from "../fiscal";
import { DEFAULT_ASSUMPTIONS, evaluateStrategy, type StrategyInput } from "../strategies";
import type { Usage } from "../types";

const param = (value: number): Param<number> => ({ value, source: "test", verifiedAt: null });

const T: FiscalTable = {
  registroPctPrimaCasa: param(2),
  registroPctSeconda: param(9),
  registroMinimo: param(1000),
  ipotecariaCatastaleFisse: param(100),
  agencyPct: param(3.66),
  notaryEstimate: param(2500),
  cedolareLongTermPct: param(21),
  cedolareShortTermPct: param(21),
};

const input: StrategyInput = {
  price: 200000,
  sqm: 100,
  bedrooms: 3,
  firstHome: true,
  outlay: 220000,
  renovation: 0,
  furnishing: 20000,
  condoMonthly: 100,
  rentSqm: 10,
  mortgageMonthly: 900,
};

const run = (usage: Usage, overrides: Partial<StrategyInput> = {}, assumptions = DEFAULT_ASSUMPTIONS) =>
  evaluateStrategy(usage, { ...input, ...overrides }, assumptions, T);

test("lungo termine", () => {
  const r = run("longTerm");
  expect(r).toMatchObject({ usage: "longTerm", annualTax: 2310, annualNet: 5690 });
  expect(r.monthlyIncome).toBeCloseTo(916.67, 2);
  expect(r.monthlyCosts).toBeCloseTo(250, 2);
  expect(r.netYieldPct).toBeCloseTo(2.371, 3);
  expect(r.monthlyCashflow).toBeCloseTo(-425.83, 2);
});

test("stanze a studenti", () => {
  const r = run("students");
  expect(r).toMatchObject({ annualTax: 2730, annualNet: 5830 });
  expect(r.monthlyIncome).toBeCloseTo(1083.33, 2);
  expect(r.monthlyCosts).toBeCloseTo(370, 2);
  expect(r.warnings.join(" ")).toMatch(/università/);
});

test("Airbnb", () => {
  const r = run("airbnb");
  expect(r).toMatchObject({ monthlyIncome: 1650, annualTax: 4158, annualNet: 7608 });
  expect(r.monthlyCosts).toBeCloseTo(669.5, 2);
  expect(r.netYieldPct).toBeCloseTo(3.17, 2);
  expect(r.warnings.join(" ")).toMatch(/CIN/);
  expect(r.warnings.join(" ")).toMatch(/limiti del comune/);
});

test("Airbnb con tariffa a mano", () => {
  const r = run("airbnb", {}, { ...DEFAULT_ASSUMPTIONS, airbnbNightlyRate: 200 });
  expect(r.monthlyIncome).toBe(3300);
});

test("vivere: l'affitto risparmiato", () => {
  const r = run("live");
  expect(r).toMatchObject({ monthlyIncome: 1000, annualTax: 0, annualNet: 9800 });
  expect(r.monthlyCosts).toBeCloseTo(183.33, 2);
  expect(r.monthlyCashflow).toBeCloseTo(-83.33, 2);
});

test("vivere in una seconda casa paga anche l'IMU", () =>
  expect(run("live", { firstHome: false }).monthlyCosts).toBeCloseTo(250, 2));

test("monolocale = 1 camera per gli studenti", () =>
  expect(run("students", { bedrooms: 0 }).monthlyIncome).toBeGreaterThan(0));

test("senza riferimento di affitto: reddito zero, avviso, nessun NaN", () => {
  for (const usage of ["live", "longTerm", "students", "airbnb"] as const) {
    const r = run(usage, { rentSqm: 0, outlay: 0, renovation: 0, furnishing: 0 });
    expect(r.monthlyIncome).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/riferimento/);
    for (const value of [r.monthlyCosts, r.annualTax, r.annualNet, r.netYieldPct, r.monthlyCashflow]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  }
});

test("la resa netta è calcolata su tutto l'investimento (acquisto, lavori e arredo)", () => {
  const without = run("longTerm", { renovation: 0, furnishing: 0 });
  const withWorks = run("longTerm", { renovation: 20000, furnishing: 0 });
  expect(withWorks.netYieldPct).toBeLessThan(without.netYieldPct);
});
