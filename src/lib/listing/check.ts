import type { Issue, ListingData } from "../types";

const MIN_PLAUSIBLE_SQM = 10;
const MAX_PLAUSIBLE_SQM = 1000;

/** `blocking`: senza questi dati non si calcola nulla. `warnings`: si può proseguire dopo conferma. */
export function checkListing(listing: ListingData): { blocking: Issue[]; warnings: Issue[] } {
  const blocking: Issue[] = [];
  const warnings: Issue[] = [];

  if (listing.contract === "rent") blocking.push("not_a_sale");
  if (listing.price == null || listing.price <= 0) blocking.push("price_missing");
  if (listing.sqm == null || listing.sqm <= 0) {
    blocking.push("sqm_missing");
  } else if (listing.sqm < MIN_PLAUSIBLE_SQM || listing.sqm > MAX_PLAUSIBLE_SQM) {
    warnings.push("sqm_implausible");
  }
  if (!listing.city.trim()) blocking.push("city_missing");

  return { blocking, warnings };
}
