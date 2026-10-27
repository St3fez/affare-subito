export type Condition = "pronto" | "abitabile" | "da_rinfrescare" | "da_ristrutturare";

export type Issue =
  | "not_a_sale"
  | "not_a_rent"
  | "not_residential"
  | "price_missing"
  | "sqm_missing"
  | "city_missing"
  | "sqm_implausible"
  | "looks_like_sale"
  | "looks_like_rent";

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

export type Range = { min: number; max: number };

export type OmiState = "ottimo" | "normale" | "scadente";

/** Vendita in €/mq, affitto in €/mq al mese. */
export type OmiZone = {
  code: string;
  description: string;
  sale: Partial<Record<OmiState, Range>>;
  rent: Partial<Record<OmiState, Range>>;
};

export type OmiComune = { istat: string; name: string; province: string; zones: OmiZone[] };

/** Chiave: nome del comune come nel CSV + "|" + sigla della provincia, per esempio "MILANO|MI". */
export type OmiData = { semester: string; comuni: Record<string, OmiComune> };

/**
 * Storico OMI per i grafici: per ogni zona ("<istat>|<codice zona>") il valore centrale della forchetta "normale",
 * vendita in €/mq e affitto in €/mq al mese, un valore per semestre (null se quel semestre manca).
 */
export type OmiHistory = {
  semesters: string[];
  zones: Record<string, { sale: (number | null)[]; rent: (number | null)[] }>;
};

/**
 * Confini delle zone OMI delle città con più zone, per trovare la zona dalla posizione dell'annuncio.
 * Per ogni comune (codice ISTAT) e zona: i poligoni, ciascuno fatto di anelli (il primo è il perimetro, gli altri sono buchi).
 * Ogni anello è una lista piatta di interi in 1e-5 gradi: [lon, lat] del primo punto, poi le differenze dal punto precedente.
 */
export type OmiZoneShapes = {
  version: 1;
  comuni: Record<string, Record<string, number[][][]>>;
};

export type Usage = "live" | "longTerm" | "students" | "airbnb";
