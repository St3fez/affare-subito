import type { Issue, ListingData } from "../types";

const MIN_PLAUSIBLE_SQM = 10;
const MAX_PLAUSIBLE_SQM = 1000;
// Oltre questo canone al mese è quasi certamente un prezzo di vendita; sotto questo prezzo di vendita, quasi certamente un canone.
const MAX_PLAUSIBLE_RENT = 20000;
const MIN_PLAUSIBLE_SALE = 10000;

// Tipologie che non sono abitazioni: i valori OMI usati per il confronto sono quelli delle case.
const NOT_RESIDENTIAL = /\b(negozio|ufficio|box|garage|autorimessa|posto auto|capannone|magazzino|terreno|laboratorio|locale commerciale)\b/i;

/**
 * `blocking`: senza questi dati non si calcola nulla. `warnings`: si può proseguire (i metri quadri strani vanno confermati).
 * Vendite e affitti passano entrambi: il contratto decide quale analisi si fa.
 */
export function checkListing(listing: ListingData): { blocking: Issue[]; warnings: Issue[] } {
  const blocking: Issue[] = [];
  const warnings: Issue[] = [];

  if (NOT_RESIDENTIAL.test(listing.propertyType)) blocking.push("not_residential");
  if (listing.price == null || listing.price <= 0) {
    blocking.push("price_missing");
  } else if (listing.contract === "rent" ? listing.price > MAX_PLAUSIBLE_RENT : listing.price < MIN_PLAUSIBLE_SALE) {
    warnings.push(listing.contract === "rent" ? "looks_like_sale" : "looks_like_rent");
  }
  if (listing.sqm == null || listing.sqm <= 0) {
    blocking.push("sqm_missing");
  } else if (listing.sqm < MIN_PLAUSIBLE_SQM || listing.sqm > MAX_PLAUSIBLE_SQM) {
    warnings.push("sqm_implausible");
  }
  if (!listing.city.trim()) blocking.push("city_missing");

  return { blocking, warnings };
}
