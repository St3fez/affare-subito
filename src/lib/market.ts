import type { OmiComune, OmiData, OmiState, OmiZone, OmiZoneShapes, Range } from "./types";
import { locateZone } from "./zoneLocator";

export type MarketReference = {
  /** "zona Lambrate, Milano" oppure "comune di Milano": dice quanta precisione ha il riferimento. */
  label: string;
  precision: "zona" | "comune";
  /** "position" se la zona è stata trovata dalla posizione dell'annuncio sui confini OMI; assente se viene dal nome. */
  locatedBy?: "position";
  /** €/mq */
  sale: Partial<Record<OmiState, Range>>;
  /** €/mq al mese */
  rent: Partial<Record<OmiState, Range>>;
  semester: string;
  /** Il comune e le zone da cui vengono i valori: servono a ritrovarne l'andamento nello storico. */
  istat: string;
  zoneCodes: string[];
};

const STATES: OmiState[] = ["ottimo", "normale", "scadente"];

// Parole che compaiono in quasi ogni zona e non bastano a riconoscerla.
const GENERIC_WORDS = new Set(["zona", "via", "viale", "piazza", "corso", "del", "della", "dei", "delle", "dello", "degli", "nel", "alla", "allo", "con", "per"]);

/** Minuscolo, senza accenti, apostrofi e punteggiatura, spazi compressi. */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function significantWords(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !GENERIC_WORDS.has(word));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function combine(zones: OmiZone[], kind: "sale" | "rent"): Partial<Record<OmiState, Range>> {
  const result: Partial<Record<OmiState, Range>> = {};
  for (const state of STATES) {
    const ranges = zones.map((zone) => zone[kind][state]).filter((range): range is Range => range !== undefined);
    if (ranges.length > 0) {
      result[state] = { min: median(ranges.map((r) => r.min)), max: median(ranges.map((r) => r.max)) };
    }
  }
  return result;
}

/** Tutte le parole significative del nome più corto devono comparire nel più lungo. */
function zoneScore(listingZone: string, description: string): number {
  const a = significantWords(listingZone);
  const b = significantWords(description);
  if (a.length === 0 || b.length === 0) return 0;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.every((word) => longer.includes(word)) ? shorter.length : 0;
}

const SARDEGNA_CATASTALE = ["CA", "SS", "NU", "OR"];

/** L'OMI usa le province catastali: le sigle nate dopo (e quelle sarde, cambiate più volte) cercano in quelle da cui vengono. */
const CATASTAL_PROVINCES: Record<string, string[]> = {
  MB: ["MI"],
  FC: ["FO"],
  PU: ["PS"],
  FM: ["AP"],
  BT: ["BA", "FG"],
  SU: SARDEGNA_CATASTALE,
  CI: SARDEGNA_CATASTALE,
  VS: SARDEGNA_CATASTALE,
  OG: SARDEGNA_CATASTALE,
  OT: SARDEGNA_CATASTALE,
};

const indexes = new WeakMap<OmiData, Map<string, OmiComune[]>>();

function indexFor(omi: OmiData): Map<string, OmiComune[]> {
  let index = indexes.get(omi);
  if (!index) {
    index = new Map();
    for (const comune of Object.values(omi.comuni)) {
      const key = normalizeName(comune.name);
      index.set(key, [...(index.get(key) ?? []), comune]);
    }
    indexes.set(omi, index);
  }
  return index;
}

/** La posizione dell'annuncio, se le coordinate ci sono. */
export function pointOf(listing: { lat: number | null; lng: number | null }): { lat: number; lng: number } | null {
  return listing.lat != null && listing.lng != null ? { lat: listing.lat, lng: listing.lng } : null;
}

/** "PORTA VIGENTINA, PORTA ROMANA" → "Porta Vigentina, Porta Romana". */
function readableZone(description: string): string {
  return description
    .toLowerCase()
    .replace(/(^|[\s,.'-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
    .replace(/\s(Di|Del|Della|Dei|Delle|Degli|Dello|E|In|Al|Alla|Da|Con|Per|Sul|Sulla)(?=\s)/g, (m) => m.toLowerCase());
}

/**
 * I valori di mercato per un annuncio. Se si conosce la posizione e il comune ha i confini delle zone (`shapes`), la zona è quella
 * in cui cade il punto; altrimenti, o se quel punto non cade in una zona con valori di case, si cerca per nome.
 */
export function lookupMarket(
  omi: OmiData,
  query: { city: string; province: string; zone: string; point?: { lat: number; lng: number } | null },
  shapes?: OmiZoneShapes | null
): MarketReference | null {
  const cityKey = normalizeName(query.city);
  if (!cityKey) return null;

  const candidates = indexFor(omi).get(cityKey) ?? [];
  const province = query.province.trim().toUpperCase();
  const accepted = [province, ...(CATASTAL_PROVINCES[province] ?? [])];
  const matches = province ? candidates.filter((c) => accepted.includes(c.province.toUpperCase())) : candidates;
  if (matches.length !== 1) return null; // assente, oppure ambiguo senza sigla della provincia
  const comune = matches[0];

  const located = query.point && shapes ? locateZone(shapes, comune.istat, query.point.lat, query.point.lng) : null;
  const locatedZone = located ? comune.zones.find((zone) => zone.code === located.code) : undefined;
  if (locatedZone) {
    return {
      label: `zona ${readableZone(locatedZone.description)}, ${comune.name}`,
      precision: "zona",
      locatedBy: "position",
      sale: combine([locatedZone], "sale"),
      rent: combine([locatedZone], "rent"),
      semester: omi.semester,
      istat: comune.istat,
      zoneCodes: [locatedZone.code],
    };
  }

  const scored = comune.zones.map((zone) => ({ zone, score: zoneScore(query.zone, zone.description) }));
  const best = Math.max(0, ...scored.map((s) => s.score));
  const matched = best > 0 ? scored.filter((s) => s.score === best).map((s) => s.zone) : [];

  const zones = matched.length > 0 ? matched : comune.zones;
  return {
    label: matched.length > 0 ? `zona ${query.zone.trim()}, ${comune.name}` : `comune di ${comune.name}`,
    precision: matched.length > 0 ? "zona" : "comune",
    sale: combine(zones, "sale"),
    rent: combine(zones, "rent"),
    semester: omi.semester,
    istat: comune.istat,
    zoneCodes: zones.map((zone) => zone.code),
  };
}
