import { stableHash } from "./hash";
import { conditionFromPortalLabel, positiveNumber, text, type StructuredRead } from "./nextData";
import { provinceCodeFromText } from "./provinces";
import { canonicalListingUrl } from "./url";
import type { ListingData } from "../types";

// I tipi schema.org con cui i portali descrivono un annuncio di casa. Non "Product": lo hanno anche pagine che non sono annunci.
const LISTING_TYPES = new Set(["RealEstateListing", "Apartment", "House", "SingleFamilyResidence", "Residence", "Accommodation"]);

// Un'Italia con un po' di margine: serve a scartare coordinate senza senso.
const ITALY = { latMin: 35, latMax: 48, lngMin: 6, lngMax: 19 };

/** "&#232;" → "è", "&apos;" → "'": le descrizioni nel JSON-LD arrivano spesso con le entità HTML. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(quot|apos|lt|gt|nbsp);/g, (_, name) => ({ quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " })[name as "quot"])
    .replace(/&amp;/g, "&");
}

function nodesOf(value: unknown): any[] {
  if (Array.isArray(value)) return value.flatMap(nodesOf);
  if (value && typeof value === "object") {
    const graph = (value as any)["@graph"];
    return [value, ...(Array.isArray(graph) ? graph.flatMap(nodesOf) : [])];
  }
  return [];
}

const typesOf = (node: any): string[] => (Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]).filter((t: unknown) => typeof t === "string");

function coordinate(value: unknown, min: number, max: number): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? parseFloat(value) : NaN;
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

/** Il valore della voce con quel nome in una lista `[{ name, value }]` (additionalProperty, amenityFeature). */
function listed(node: any, key: string, name: RegExp): unknown {
  const items = Array.isArray(node?.[key]) ? node[key] : [];
  return items.find((item: any) => typeof item?.name === "string" && name.test(item.name))?.value;
}

/**
 * Legge il JSON-LD di una pagina (`<script type="application/ld+json">`): un blocco `RealEstateListing` (o una casa/appartamento) con
 * prezzo, superficie, locali, indirizzo e coordinate. `null` se non c'è un annuncio con almeno il prezzo o i metri quadri.
 */
export function readJsonLdData(blocks: string[], url?: string): StructuredRead | null {
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue;
    }
    for (const node of nodesOf(parsed)) {
      if (!typesOf(node).some((type) => LISTING_TYPES.has(type))) continue;
      const read = readNode(node, url);
      if (read) return read;
    }
  }
  return null;
}

function readNode(node: any, url?: string): StructuredRead | null {
  const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
  const price = positiveNumber(offer?.price ?? offer?.priceSpecification?.price);
  const sqm = positiveNumber(node.floorSize?.value ?? node.floorSize);
  if (price === null && sqm === null) return null;

  const name = decodeHtmlEntities(text(node.name));
  const businessFunction = text(offer?.businessFunction);
  const contract: ListingData["contract"] = /Sell/i.test(businessFunction)
    ? "sale"
    : /LeaseOut|Rent/i.test(businessFunction)
      ? "rent"
      : /\bin vendita\b/i.test(name)
        ? "sale"
        : /\bin affitto\b/i.test(name)
          ? "rent"
          : "unknown";

  const energy = text(listed(node, "additionalProperty", /classe energetica/i)).trim().toUpperCase();
  const elevator = listed(node, "amenityFeature", /ascensor/i);
  const box = listed(node, "amenityFeature", /\bbox\b|garage|posto auto/i);
  const address = node.address ?? {};
  const canonical = url ? canonicalListingUrl(url) : null;
  const city = text(address.addressLocality);

  const listing: ListingData = {
    source: "jsonLd",
    url,
    listingKey: canonical ? `url:${canonical}` : `jsonld:${stableHash(JSON.stringify([price, sqm, city, name]))}`,
    contract,
    title: name,
    propertyType: (/^(.+?)\s+in\s+(?:vendita|affitto)\b/i.exec(name)?.[1] ?? "").toLowerCase(),
    price,
    sqm,
    rooms: positiveNumber(node.numberOfRooms),
    bedrooms: null,
    bathrooms: positiveNumber(node.numberOfBathroomsTotal ?? node.numberOfBathrooms),
    floor: "",
    condition: conditionFromPortalLabel(text(listed(node, "additionalProperty", /stato/i))),
    hasElevator: typeof elevator === "boolean" ? elevator : null,
    hasGarage: box === true ? true : null,
    condoMonthly: null,
    energyClass: /^[A-G][1-4]?$/.test(energy) ? energy : "",
    city,
    province: provinceCodeFromText(text(address.addressRegion)),
    zone: "",
    lat: coordinate(node.geo?.latitude, ITALY.latMin, ITALY.latMax),
    lng: coordinate(node.geo?.longitude, ITALY.lngMin, ITALY.lngMax),
  };

  return {
    listing,
    description: decodeHtmlEntities(text(node.description)),
    // Il campo delle camere di questi portali è di solito locali − 1: vale solo se la descrizione non le dice.
    bedroomsFallback: positiveNumber(node.numberOfBedrooms),
    bedroomsFromRooms: true,
  };
}
