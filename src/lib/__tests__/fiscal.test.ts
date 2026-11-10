import { acquisitionCosts, FISCAL_DEFAULTS, type FiscalTable, type Param } from "../fiscal";

const param = (value: number): Param<number> => ({ value, source: "test", verifiedAt: null });

const T: FiscalTable = {
  registroPctPrimaCasa: param(2),
  registroPctSeconda: param(9),
  registroMinimo: param(1000),
  ipotecariaCatastaleFisse: param(100),
  agencyPct: param(3.66),
  notaryDeedBase: param(1800),
  notaryDeedPct: param(0.35),
  mortgageNotaryPct: param(1),
  substituteTaxPctPrimaCasa: param(0.25),
  substituteTaxPctOther: param(2),
  bankFees: param(750),
  cedolareLongTermPct: param(21),
  cedolareShortTermPct: param(21),
};

const NO_MORTGAGE = { mortgageNotary: 0, mortgageTax: 0, bankFees: 0 };

test("prima casa, senza mutuo", () =>
  expect(acquisitionCosts({ price: 200000, firstHome: true }, T)).toEqual({
    registro: 4000,
    ipotecariaCatastale: 100,
    agency: 7320,
    notary: 2500, // 1.800 € + 0,35% di 200.000 €
    ...NO_MORTGAGE,
    total: 13920,
    outlay: 213920,
  }));

test("seconda casa, senza mutuo", () => {
  const a = acquisitionCosts({ price: 200000, firstHome: false }, T);
  expect(a.registro).toBe(18000);
  expect(a.total).toBe(27920);
});

test("minimo di registro", () => expect(acquisitionCosts({ price: 30000, firstHome: true }, T).registro).toBe(1000));

describe("il notaio per il rogito cresce con il prezzo", () => {
  test.each([
    [100000, 2150],
    [200000, 2500],
    [500000, 3550],
  ])("prezzo %d → %d €", (price, notary) => expect(acquisitionCosts({ price, firstHome: true }, T).notary).toBe(notary));
});

describe("con il mutuo: atto di mutuo, imposta sostitutiva e banca", () => {
  test("prima casa: imposta sostitutiva allo 0,25% del mutuo", () => {
    const a = acquisitionCosts({ price: 200000, firstHome: true, loan: 160000 }, T);
    expect(a).toMatchObject({
      mortgageTax: 400, // 0,25% di 160.000 €
      mortgageNotary: 1600, // 1% di 160.000 €, IVA compresa
      bankFees: 750,
      total: 13920 + 400 + 1600 + 750,
      outlay: 200000 + 13920 + 400 + 1600 + 750,
    });
  });

  test("non prima casa: imposta sostitutiva al 2%", () => {
    const a = acquisitionCosts({ price: 200000, firstHome: false, loan: 160000 }, T);
    expect(a.mortgageTax).toBe(3200);
    expect(a.total).toBe(27920 + 3200 + 1600 + 750);
  });

  test("mutuo zero o assente: nessuna voce del mutuo", () => {
    expect(acquisitionCosts({ price: 200000, firstHome: true, loan: 0 }, T)).toMatchObject(NO_MORTGAGE);
    expect(acquisitionCosts({ price: 200000, firstHome: true, loan: -5 }, T)).toMatchObject(NO_MORTGAGE);
  });
});

test("prezzo zero → tutto zero, nessun NaN", () =>
  expect(acquisitionCosts({ price: 0, firstHome: true, loan: 100000 }, T)).toEqual({
    registro: 0,
    ipotecariaCatastale: 0,
    agency: 0,
    notary: 0,
    ...NO_MORTGAGE,
    total: 0,
    outlay: 0,
  }));

test("le cifre sono arrotondate ai centesimi", () => {
  const a = acquisitionCosts({ price: 123457, firstHome: true, loan: 98765 }, T);
  for (const value of Object.values(a)) expect(Math.round(value * 100)).toBeCloseTo(value * 100, 6);
});

test("ogni parametro ha una fonte", () => {
  for (const [name, p] of Object.entries(FISCAL_DEFAULTS)) {
    expect({ name, hasSource: p.source.length > 0 }).toEqual({ name, hasSource: true });
    expect(p.verifiedAt === null || /^\d{4}-\d{2}-\d{2}$/.test(p.verifiedAt)).toBe(true);
    expect(Number.isFinite(p.value)).toBe(true);
  }
});

test("le aliquote di legge dei valori predefiniti", () => {
  expect(FISCAL_DEFAULTS.registroPctPrimaCasa.value).toBe(2);
  expect(FISCAL_DEFAULTS.registroPctSeconda.value).toBe(9);
  expect(FISCAL_DEFAULTS.substituteTaxPctPrimaCasa.value).toBe(0.25);
  expect(FISCAL_DEFAULTS.substituteTaxPctOther.value).toBe(2);
  // Quelle di legge sono controllate su una fonte; le stime (notaio, banca, agenzia) restano "da verificare".
  expect(FISCAL_DEFAULTS.substituteTaxPctPrimaCasa.verifiedAt).not.toBeNull();
  expect(FISCAL_DEFAULTS.substituteTaxPctOther.verifiedAt).not.toBeNull();
});
