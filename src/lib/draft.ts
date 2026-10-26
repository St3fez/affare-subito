import { formatCurrency, parseFlexibleNumber } from "./format";
import type { Condition, Issue, ListingData } from "./types";

/** I campi della schermata di revisione, come testo digitato. */
export type ListingDraft = {
  price: string;
  sqm: string;
  bedrooms: string;
  bathrooms: string;
  city: string;
  province: string;
  zone: string;
  condition: Condition | null;
};

const asText = (value: number | null) => (value === null ? "" : String(value));

export function draftFromListing(listing: ListingData): ListingDraft {
  return {
    price: asText(listing.price),
    sqm: asText(listing.sqm),
    bedrooms: asText(listing.bedrooms),
    bathrooms: asText(listing.bathrooms),
    city: listing.city,
    province: listing.province,
    zone: listing.zone,
    condition: listing.condition,
  };
}

function positive(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = parseFlexibleNumber(raw.trim());
  return value > 0 ? value : null;
}

function nonNegative(raw: string): number | null {
  const text = raw.trim();
  if (!/\d/.test(text)) return null;
  const value = parseFlexibleNumber(text);
  return value >= 0 ? value : null;
}

/** Riporta i campi digitati nell'annuncio; tutto il resto dell'annuncio resta com'era. */
export function applyDraft(base: ListingData, draft: ListingDraft): ListingData {
  return {
    ...base,
    price: positive(draft.price),
    sqm: positive(draft.sqm),
    bedrooms: nonNegative(draft.bedrooms),
    bathrooms: nonNegative(draft.bathrooms),
    city: draft.city.trim(),
    province: draft.province.trim().toUpperCase(),
    zone: draft.zone.trim(),
    condition: draft.condition,
  };
}

/** "Appartamento · 85 m² · Lambrate, Milano · 340.000 €", senza le parti che mancano. */
export function describeListing(listing: ListingData): string {
  const type = listing.propertyType ? listing.propertyType.charAt(0).toUpperCase() + listing.propertyType.slice(1) : "";
  const place = [listing.zone, listing.city].filter(Boolean).join(", ");
  const parts = [
    type,
    listing.sqm ? `${listing.sqm} m²` : "",
    place,
    listing.price ? formatCurrency(listing.price) : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Nessun dato ancora";
}

const ISSUE_MESSAGES: Record<Issue, string> = {
  not_a_sale: "Questo annuncio non è una vendita (sembra un affitto): qui si analizzano solo case in vendita.",
  price_missing: "Manca il prezzo.",
  sqm_missing: "Mancano i metri quadri.",
  city_missing: "Manca il comune.",
  sqm_implausible: "I metri quadri sembrano fuori scala: controlla di averli letti bene.",
};

export function describeIssue(issue: Issue): string {
  return ISSUE_MESSAGES[issue];
}
