import type { ListingData } from "../../types";
import { checkListing } from "../check";

const base = { price: 200000, sqm: 80, city: "Milano", contract: "sale" } as ListingData;

test("blocking", () => {
  expect(checkListing({ ...base, price: null }).blocking).toContain("price_missing");
  expect(checkListing({ ...base, sqm: null }).blocking).toContain("sqm_missing");
  expect(checkListing({ ...base, city: "" }).blocking).toContain("city_missing");
  expect(checkListing(base).blocking).toEqual([]);
});

test("gli affitti si analizzano: nessun blocco", () => {
  expect(checkListing({ ...base, contract: "rent", price: 900 })).toEqual({ blocking: [], warnings: [] });
});

test("un prezzo che sembra dell'altro contratto → avviso", () => {
  expect(checkListing({ ...base, contract: "rent", price: 250000 }).warnings).toContain("looks_like_sale");
  expect(checkListing({ ...base, contract: "sale", price: 900 }).warnings).toContain("looks_like_rent");
  expect(checkListing({ ...base, contract: "unknown", price: 900 }).warnings).toContain("looks_like_rent");
  expect(checkListing({ ...base, contract: "rent", price: 20000 }).warnings).toEqual([]);
  expect(checkListing({ ...base, contract: "sale", price: 10000 }).warnings).toEqual([]);
});

test("metri quadri assurdi → avviso, non blocco", () => {
  for (const sqm of [5, 4200]) {
    const result = checkListing({ ...base, sqm });
    expect(result.warnings).toContain("sqm_implausible");
    expect(result.blocking).toEqual([]);
  }
  expect(checkListing({ ...base, sqm: 80 }).warnings).toEqual([]);
});

test.each(["negozio", "ufficio", "box", "garage", "autorimessa", "posto auto", "capannone", "magazzino", "terreno", "locale commerciale", "laboratorio"])(
  "%s non è una casa",
  (propertyType) => {
    expect(checkListing({ ...base, propertyType }).blocking).toContain("not_residential");
  }
);

test.each(["appartamento", "trilocale", "quadrilocale", "villa", "attico", "bilocale", "loft", "casale", ""])(
  "'%s' è residenziale o sconosciuto: nessun blocco",
  (propertyType) => {
    expect(checkListing({ ...base, propertyType }).blocking).toEqual([]);
  }
);
