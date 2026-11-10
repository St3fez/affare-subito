import type { Condition, ListingData } from "../types";
import { readCasaData } from "./casa";
import { stableHash } from "./hash";
import { readJsonLdData } from "./jsonld";
import { readImmobiliareData, type StructuredRead } from "./nextData";
import { parseListingText, readDescriptionDetails } from "./text";

export { checkListing } from "./check";

export type ListingSource =
  | { kind: "nextData"; json: string; url?: string }
  /** I blocchi `<script type="application/ld+json">` della pagina. */
  | { kind: "jsonLd"; blocks: string[]; url?: string }
  | { kind: "text"; text: string; url?: string };

/** `null` se dalla fonte non si ricava nulla di usabile (pagina bloccata, testo senza dati). */
export function readListing(source: ListingSource): ListingData | null {
  if (source.kind === "nextData") return readStructured(source.json, source.url);
  if (source.kind === "jsonLd") {
    const read = readJsonLdData(source.blocks, source.url);
    return read ? completeFromDescription(read) : null;
  }

  const listing = parseListingText(source.text, source.url);
  return listing.price == null && listing.sqm == null && !listing.city ? null : listing;
}

/** I dati strutturati della pagina (immobiliare.it, casa.it), con i buchi riempiti dalla descrizione dell'annuncio. */
function readStructured(json: string, url?: string): ListingData | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const read = readImmobiliareData(data, url) ?? readCasaData(data, url);
  return read ? completeFromDescription(read) : null;
}

/**
 * Ciò che il portale dice con certezza non si tocca: la descrizione (scritta dall'agenzia) riempie solo le voci vuote.
 */
function completeFromDescription({ listing, description, bedroomsFromRooms, bedroomsFallback }: StructuredRead): ListingData {
  const found = description.trim() ? readDescriptionDetails(description) : null;
  const filled: ListingData = found
    ? {
        ...listing,
        bedrooms: listing.bedrooms ?? found.bedrooms,
        bathrooms: listing.bathrooms ?? found.bathrooms,
        floor: listing.floor || found.floor,
        condition: listing.condition ?? found.condition,
        hasElevator: listing.hasElevator ?? found.hasElevator,
        hasGarage: listing.hasGarage ?? found.hasGarage,
        condoMonthly: listing.condoMonthly ?? found.condoMonthly,
      }
    : listing;
  if (filled.bedrooms === null && bedroomsFallback) return { ...filled, bedrooms: bedroomsFallback };
  if (bedroomsFromRooms && filled.bedrooms === null && filled.rooms !== null) return { ...filled, bedrooms: Math.max(0, filled.rooms - 1) };
  return filled;
}

/** Annuncio vuoto per l'inserimento a mano; `id` identifica questa sessione, così ritoccare i dati non conta come un'altra analisi. */
export function emptyManualListing(id: string): ListingData {
  return {
    ...manualListing({ price: 0, sqm: 0, city: "", province: "", condition: null }),
    listingKey: `manual:${id}`,
    title: "Immobile",
    price: null,
    sqm: null,
  };
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
