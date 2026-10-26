import { acquisitionCosts, FISCAL_DEFAULTS, type FiscalTable, type Param } from "../fiscal";

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

test("prima casa", () =>
  expect(acquisitionCosts({ price: 200000, firstHome: true }, T)).toEqual({
    registro: 4000,
    ipotecariaCatastale: 100,
    agency: 7320,
    notary: 2500,
    total: 13920,
    outlay: 213920,
  }));

test("seconda casa", () => {
  const a = acquisitionCosts({ price: 200000, firstHome: false }, T);
  expect(a.registro).toBe(18000);
  expect(a.total).toBe(27920);
});

test("minimo di registro", () => expect(acquisitionCosts({ price: 30000, firstHome: true }, T).registro).toBe(1000));

test("prezzo zero → tutto zero, nessun NaN", () =>
  expect(acquisitionCosts({ price: 0, firstHome: true }, T)).toEqual({
    registro: 0,
    ipotecariaCatastale: 0,
    agency: 0,
    notary: 0,
    total: 0,
    outlay: 0,
  }));

test("le cifre sono arrotondate ai centesimi", () => {
  const a = acquisitionCosts({ price: 123457, firstHome: true }, T);
  for (const value of Object.values(a)) expect(Math.round(value * 100)).toBeCloseTo(value * 100, 6);
});

test("ogni parametro ha una fonte", () => {
  for (const [name, p] of Object.entries(FISCAL_DEFAULTS)) {
    expect({ name, hasSource: p.source.length > 0 }).toEqual({ name, hasSource: true });
    expect(p.verifiedAt === null || /^\d{4}-\d{2}-\d{2}$/.test(p.verifiedAt)).toBe(true);
    expect(Number.isFinite(p.value)).toBe(true);
  }
});
