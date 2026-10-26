import type { ListingData } from "../../types";
import { checkListing } from "../check";

const base = { price: 200000, sqm: 80, city: "Milano", contract: "sale" } as ListingData;

test("blocking", () => {
  expect(checkListing({ ...base, price: null }).blocking).toContain("price_missing");
  expect(checkListing({ ...base, sqm: null }).blocking).toContain("sqm_missing");
  expect(checkListing({ ...base, city: "" }).blocking).toContain("city_missing");
  expect(checkListing({ ...base, contract: "rent" }).blocking).toContain("not_a_sale");
  expect(checkListing(base).blocking).toEqual([]);
});

test("metri quadri assurdi → avviso, non blocco", () => {
  for (const sqm of [5, 4200]) {
    const result = checkListing({ ...base, sqm });
    expect(result.warnings).toContain("sqm_implausible");
    expect(result.blocking).toEqual([]);
  }
  expect(checkListing({ ...base, sqm: 80 }).warnings).toEqual([]);
});
