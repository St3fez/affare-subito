import { COST_DEFAULTS, furnishingCost, renovationCost, renovationLevelFor, type CostTable } from "../costs";
import type { Param } from "../fiscal";

const param = (value: number): Param<number> => ({ value, source: "test", verifiedAt: null });

const T: CostTable = {
  renovationPerSqm: { leggero: param(150), medio: param(400), pesante: param(900) },
  furnishing: { studentRoomKit: param(1200), airbnbPerSqm: param(300) },
};

test("costo di ristrutturazione", () => {
  expect(renovationCost(80, "pesante", T)).toBe(72000);
  expect(renovationCost(80, "medio", T)).toBe(32000);
  expect(renovationCost(80, "leggero", T)).toBe(12000);
  expect(renovationCost(80, "nessuno", T)).toBe(0);
  expect(renovationCost(0, "pesante", T)).toBe(0);
  expect(renovationCost(-5, "pesante", T)).toBe(0);
});

test("livello di lavori dallo stato dell'immobile", () => {
  expect(renovationLevelFor("pronto")).toBe("nessuno");
  expect(renovationLevelFor("abitabile")).toBe("leggero");
  expect(renovationLevelFor("da_rinfrescare")).toBe("medio");
  expect(renovationLevelFor("da_ristrutturare")).toBe("pesante");
  expect(renovationLevelFor(null)).toBe("nessuno");
});

test("arredo per uso", () => {
  expect(furnishingCost("students", { sqm: 100, bedrooms: 3 }, T)).toBe(3600);
  expect(furnishingCost("students", { sqm: 30, bedrooms: 0 }, T)).toBe(1200); // monolocale = 1 camera
  expect(furnishingCost("airbnb", { sqm: 100, bedrooms: 3 }, T)).toBe(30000);
  expect(furnishingCost("airbnb", { sqm: 0, bedrooms: 0 }, T)).toBe(0);
  expect(furnishingCost("live", { sqm: 100, bedrooms: 3 }, T)).toBe(0);
  expect(furnishingCost("longTerm", { sqm: 100, bedrooms: 3 }, T)).toBe(0);
});

test("ogni parametro ha una fonte", () => {
  const params: Array<[string, Param<number>]> = [
    ...Object.entries(COST_DEFAULTS.renovationPerSqm),
    ...Object.entries(COST_DEFAULTS.furnishing),
  ];
  expect(params).toHaveLength(5);
  for (const [name, p] of params) {
    expect({ name, hasSource: p.source.length > 0 }).toEqual({ name, hasSource: true });
    expect(p.verifiedAt === null || /^\d{4}-\d{2}-\d{2}$/.test(p.verifiedAt)).toBe(true);
    expect(p.value).toBeGreaterThan(0);
  }
});

test("i costi dei lavori crescono con il livello", () => {
  const { leggero, medio, pesante } = COST_DEFAULTS.renovationPerSqm;
  expect(leggero.value).toBeLessThan(medio.value);
  expect(medio.value).toBeLessThan(pesante.value);
});
