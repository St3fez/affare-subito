import type { ListingData } from "../types";
import { conditionFromPortalLabel, finiteNumber, positiveNumber, text, type StructuredRead } from "./nextData";

type FeatureItem = { label?: unknown; values?: unknown };

/** Le voci della scheda "Caratteristiche / Stato / Costi" della pagina, tutte in fila. */
function featureItems(pdp: any): FeatureItem[] {
  const lists = pdp?.features?.featureLists;
  return Array.isArray(lists) ? lists.flatMap((list: any) => (Array.isArray(list?.items) ? list.items : [])) : [];
}

function featureValue(items: FeatureItem[], label: string): unknown {
  const item = items.find((candidate) => candidate.label === label);
  return Array.isArray(item?.values) ? item.values[0] : undefined;
}

/** "Spese condominiali: € 200 /mese" (o "/anno": si porta al mese). */
function condoMonthly(items: FeatureItem[]): number | null {
  const main = (featureValue(items, "Spese condominiali") as any)?.main;
  const amount = positiveNumber(main?.value);
  if (amount === null) return null;
  return /anno/i.test(text(main?.munitAfter)) ? Math.round(amount / 12) : amount;
}

/** La scheda dice "A1", "G"…; "In fase di richiesta" non è una classe. */
function energyClass(value: unknown): string {
  const label = text(value).trim().toUpperCase();
  return /^[A-G][1-4]?$/.test(label) ? label : "";
}

/**
 * Legge i dati di una pagina di casa.it (`__NEXT_DATA__` → `props.pageProps.pdp`). Ha tutto in forma strutturata tranne le camere da letto.
 * `null` se non è l'annuncio di casa.it o manca l'identificativo.
 */
export function readCasaData(data: any, url?: string): StructuredRead | null {
  const pdp = data?.props?.pageProps?.pdp;
  if (!pdp || typeof pdp !== "object" || pdp.id == null) return null;

  const items = featureItems(pdp);
  const address = pdp.address ?? {};
  const elevator = text(featureValue(items, "Ascensore"));
  const floor = text(pdp.floor?.value);
  const hasBox = items.some((item) => item.label === "Box") || (positiveNumber(pdp.mainFeatures?.parkings) ?? 0) > 0;

  const listing: ListingData = {
    source: "nextData",
    url,
    listingKey: `casa:${pdp.id}`,
    contract: pdp.channel === "vendita" ? "sale" : pdp.channel === "affitto" ? "rent" : "unknown",
    title: text(pdp.helmetData?.seoData?.h1) || text(pdp.mainCardAggregator?.title),
    propertyType: text(pdp.propertyType?.label).toLowerCase(),
    price: positiveNumber(pdp.price?.value),
    sqm: positiveNumber(pdp.size?.value),
    rooms: positiveNumber(pdp.rooms?.value),
    bedrooms: null,
    bathrooms: positiveNumber(pdp.mainFeatures?.baths) ?? positiveNumber(featureValue(items, "Bagni")),
    floor: /non indicat/i.test(floor) ? "" : floor,
    condition: conditionFromPortalLabel(text(featureValue(items, "Condizioni immobile"))),
    hasElevator: elevator ? /^s[iì]/i.test(elevator) : null,
    hasGarage: hasBox ? true : null,
    condoMonthly: condoMonthly(items),
    energyClass: energyClass(pdp.energyClass?.class),
    city: text(address.town),
    province: text(address.province),
    // Il quartiere è più preciso della zona ("San Polo Parco" dentro "San Polo, San Polo Parco, Sanpolino").
    zone: text(address.block) || text(address.zone),
    lat: finiteNumber(address.lat),
    lng: finiteNumber(address.lon),
  };
  return { listing, description: text(pdp.description?.it?.text), bedroomsFromRooms: true };
}
