import { parseFlexibleNumber } from "../format";
import type { Condition, ListingData } from "../types";

/** Etichette dello stato come le scrive il portale ("Buono / Abitabile", "Da ristrutturare", ...). */
export function conditionFromPortalLabel(label: string): Condition | null {
  const text = label.toLowerCase();
  if (/da ristrutturare/.test(text)) return "da_ristrutturare";
  if (/nuov|ottimo|ristrutturat/.test(text)) return "pronto";
  if (/buono|abitabile/.test(text)) return "abitabile";
  return null;
}

function positiveNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value === "string") {
    const parsed = parseFlexibleNumber(value);
    return parsed > 0 ? parsed : null;
  }
  return null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Legge il JSON di `__NEXT_DATA__` di una pagina di annuncio di immobiliare.it. `null` se non contiene un annuncio. */
export function parseNextData(json: string, url?: string): ListingData | null {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }

  const realEstate = data?.props?.pageProps?.detailData?.realEstate;
  const property = realEstate?.properties?.[0];
  if (!realEstate || !property || realEstate.id == null) return null;

  const location = property.location ?? {};
  const contract = realEstate.contract === "sale" ? "sale" : realEstate.contract === "rent" ? "rent" : "unknown";
  const garage = text(property.garage);

  return {
    source: "nextData",
    url,
    listingKey: `immobiliare:${realEstate.id}`,
    contract,
    title: text(realEstate.title),
    propertyType: text(realEstate.typology?.name ?? property.typology?.name).toLowerCase(),
    price: positiveNumber(realEstate.price?.value),
    sqm: positiveNumber(property.surface),
    rooms: positiveNumber(property.rooms),
    bedrooms: positiveNumber(property.bedRoomsNumber),
    bathrooms: positiveNumber(property.bathrooms),
    floor: text(property.floor?.floorOnlyValue),
    condition: conditionFromPortalLabel(text(property.condition)),
    hasElevator: typeof property.elevator === "boolean" ? property.elevator : null,
    hasGarage: garage ? true : null,
    condoMonthly: positiveNumber(property.costs?.condominiumExpenses),
    energyClass: text(property.energy?.class?.name),
    city: text(location.city),
    province: text(location.provinceId),
    zone: text(location.microzone) || text(location.macrozone),
    lat: finiteNumber(location.latitude),
    lng: finiteNumber(location.longitude),
  };
}
