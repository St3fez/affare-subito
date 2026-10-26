import type { Condition, ListingData } from "../types";
import { stableHash } from "./hash";
import { parseNextData } from "./nextData";
import { parseListingText } from "./text";

export { checkListing } from "./check";

export type ListingSource =
  | { kind: "nextData"; json: string; url?: string }
  | { kind: "text"; text: string; url?: string };

/** `null` se dalla fonte non si ricava nulla di usabile (pagina bloccata, testo senza dati). */
export function readListing(source: ListingSource): ListingData | null {
  if (source.kind === "nextData") return parseNextData(source.json, source.url);

  const listing = parseListingText(source.text, source.url);
  return listing.price == null && listing.sqm == null && !listing.city ? null : listing;
}

export function manualListing(input: {
  price: number;
  sqm: number;
  city: string;
  province: string;
  condition: Condition | null;
}): ListingData {
  const city = input.city.trim();
  const province = input.province.trim().toUpperCase();
  return {
    source: "manual",
    listingKey: `manual:${stableHash(JSON.stringify([input.price, input.sqm, city.toLowerCase(), province, input.condition]))}`,
    contract: "sale",
    title: city ? `Immobile a ${city}` : "Immobile",
    propertyType: "",
    price: input.price,
    sqm: input.sqm,
    rooms: null,
    bedrooms: null,
    bathrooms: null,
    floor: "",
    condition: input.condition,
    hasElevator: null,
    hasGarage: null,
    condoMonthly: null,
    energyClass: "",
    city,
    province,
    zone: "",
    lat: null,
    lng: null,
  };
}
