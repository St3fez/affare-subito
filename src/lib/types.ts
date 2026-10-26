export type Condition = "pronto" | "abitabile" | "da_rinfrescare" | "da_ristrutturare";

export type Issue = "not_a_sale" | "price_missing" | "sqm_missing" | "city_missing" | "sqm_implausible";

export type ListingData = {
  source: "nextData" | "text" | "manual";
  url?: string;
  /** Chiave per non contare due volte lo stesso annuncio: "immobiliare:<id>", URL senza query, "text:<hash>", "manual:<hash>". */
  listingKey: string;
  contract: "sale" | "rent" | "unknown";
  title: string;
  /** Minuscolo: "appartamento", "bilocale". */
  propertyType: string;
  price: number | null;
  sqm: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string;
  condition: Condition | null;
  hasElevator: boolean | null;
  hasGarage: boolean | null;
  condoMonthly: number | null;
  energyClass: string;
  city: string;
  /** Sigla, per esempio "BS". */
  province: string;
  zone: string;
  lat: number | null;
  lng: number | null;
};
