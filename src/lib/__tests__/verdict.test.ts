import type { MarketReference } from "../market";
import type { Condition } from "../types";
import { buildRentVerdict, buildVerdict, omiStateFor } from "../verdict";

const market = (sale: MarketReference["sale"]): MarketReference => ({
  label: "zona Lambrate, Milano",
  precision: "zona",
  istat: "15146",
  zoneCodes: ["C1"],
  sale,
  rent: {},
  semester: "2025-S2",
});

const m = market({
  ottimo: { min: 4500, max: 6000 },
  normale: { min: 3500, max: 4500 },
  scadente: { min: 2500, max: 3300 },
});

const verdict = (price: number | null, condition: Condition | null = "abitabile", sqm: number | null = 85) =>
  buildVerdict({ price, sqm, condition }, m);

test("in linea: dentro la forchetta, scarto dal valore medio", () =>
  expect(verdict(340000)).toMatchObject({ level: "in_linea", gapPct: 0, pricePerSqm: 4000 }));

test("sotto il mercato", () => {
  const v = verdict(255000)!;
  expect(v).toMatchObject({ level: "sotto", gapPct: -25, pricePerSqm: 3000 });
  expect(v.label).toMatch(/sotto/i);
});

test("sopra il mercato", () => {
  const v = verdict(425000)!;
  expect(v).toMatchObject({ level: "sopra", gapPct: 25 });
  expect(v.label).toMatch(/sopra/i);
});

test("gli estremi della forchetta sono in linea", () => {
  expect(verdict(297500)!.level).toBe("in_linea"); // 3500 €/mq = minimo
  expect(verdict(382500)!.level).toBe("in_linea"); // 4500 €/mq = massimo
});

test("la forchetta dipende dallo stato dell'immobile", () => {
  expect(verdict(255000, "da_ristrutturare")).toMatchObject({ level: "in_linea", reference: { state: "scadente", min: 2500, max: 3300 } });
  expect(verdict(425000, "pronto")).toMatchObject({ level: "in_linea", reference: { state: "ottimo", min: 4500, max: 6000 } });
  expect(verdict(340000, null)!.reference).toMatchObject({ state: "normale", mid: 4000 });
});

test("se manca la forchetta dello stato si usa quella normale", () => {
  const onlyNormal = buildVerdict({ price: 340000, sqm: 85, condition: "pronto" }, market({ normale: { min: 3500, max: 4500 } }));
  expect(onlyNormal!.reference.state).toBe("normale");
});

test("senza dati non c'è verdetto, mai NaN", () => {
  expect(verdict(0)).toBeNull();
  expect(verdict(null)).toBeNull();
  expect(verdict(340000, "abitabile", 0)).toBeNull();
  expect(verdict(340000, "abitabile", null)).toBeNull();
  expect(buildVerdict({ price: 340000, sqm: 85, condition: null }, null)).toBeNull();
  expect(buildVerdict({ price: 340000, sqm: 85, condition: null }, market({}))).toBeNull();
});

const withRent = { ...m, rent: { normale: { min: 10, max: 14 }, ottimo: { min: 13, max: 17 } } };
const rentVerdict = (rent: number, condition: Condition | null = "abitabile") => buildRentVerdict({ rent, sqm: 70, condition }, withRent);

test("canone: in linea, sotto e sopra la forchetta degli affitti", () => {
  expect(rentVerdict(840)).toMatchObject({ kind: "rent", level: "in_linea", gapPct: 0, pricePerSqm: 12 });
  expect(rentVerdict(630)).toMatchObject({ level: "sotto", gapPct: -25 });
  expect(rentVerdict(1050)).toMatchObject({ level: "sopra", gapPct: 25 });
  expect(rentVerdict(1050)!.label).toMatch(/canone/i);
});

test("canone: forchetta dello stato, altrimenti quella normale", () => {
  expect(rentVerdict(1050, "pronto")!.reference).toMatchObject({ state: "ottimo", min: 13, max: 17 });
  expect(rentVerdict(840, "da_ristrutturare")!.reference.state).toBe("normale");
});

test("canone: senza forchetta degli affitti non c'è verdetto", () => {
  expect(buildRentVerdict({ rent: 840, sqm: 70, condition: null }, m)).toBeNull();
  expect(buildRentVerdict({ rent: 840, sqm: 0, condition: null }, withRent)).toBeNull();
});

test("il verdetto sul prezzo è di tipo vendita", () => expect(verdict(340000)!.kind).toBe("sale"));

test("stato OMI dallo stato dell'immobile", () => {
  expect(omiStateFor("pronto")).toBe("ottimo");
  expect(omiStateFor("abitabile")).toBe("normale");
  expect(omiStateFor("da_rinfrescare")).toBe("normale");
  expect(omiStateFor("da_ristrutturare")).toBe("scadente");
  expect(omiStateFor(null)).toBe("normale");
});
