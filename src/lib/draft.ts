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
  /** Un contratto non riconosciuto si tratta come vendita: l'utente può cambiarlo. */
  contract: "sale" | "rent";
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
    contract: listing.contract === "rent" ? "rent" : "sale",
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
    contract: draft.contract,
  };
}

/** "Appartamento · 85 m² · Lambrate, Milano · 340.000 €" (per un affitto "900 € al mese"), senza le parti che mancano. */
export function describeListing(listing: ListingData): string {
  const type = listing.propertyType ? listing.propertyType.charAt(0).toUpperCase() + listing.propertyType.slice(1) : "";
  const place = [listing.zone, listing.city].filter(Boolean).join(", ");
  const parts = [
    type,
    listing.sqm ? `${listing.sqm} m²` : "",
    place,
    listing.price ? `${formatCurrency(listing.price)}${listing.contract === "rent" ? " al mese" : ""}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Nessun dato ancora";
}

const ISSUE_MESSAGES: Record<Issue, string> = {
  not_a_sale: "Questo annuncio è un affitto: si analizza con il confronto dei canoni.",
  not_a_rent: "Questo annuncio è una vendita: si analizza con il confronto dei prezzi.",
  looks_like_sale: "Un canone così alto sembra un prezzo di vendita: se la casa è in vendita, scegli «Vendita».",
  looks_like_rent: "Un prezzo così basso sembra un canone mensile: se la casa è in affitto, scegli «Affitto».",
  not_residential: "Questo annuncio non è una casa (sembra un negozio, un ufficio, un box o un terreno): qui si analizzano solo abitazioni.",
  price_missing: "Manca il prezzo.",
  sqm_missing: "Mancano i metri quadri.",
  city_missing: "Manca il comune.",
  sqm_implausible: "I metri quadri sembrano fuori scala: controlla di averli letti bene.",
};

export function describeIssue(issue: Issue): string {
  return ISSUE_MESSAGES[issue];
}
