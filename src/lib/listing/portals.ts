import { parseFlexibleNumber } from "../format";
import type { ListingData } from "../types";
import { conditionFromPortalLabel } from "./nextData";

/**
 * Lettori dei portali che non danno dati strutturati ma hanno una pagina regolare: riassunto in cima e scheda "etichetta: valore".
 * Si legge il testo come lo vede l'utente (`document.body.innerText`) senza contare sugli a-capo, perché il browser li mette
 * dove vuole: il testo si appiattisce e le voci si cercano per etichetta.
 */
export type PortalRead = {
  /** Solo i campi letti con certezza: quelli che mancano li riempie il lettore generico. */
  fields: Partial<ListingData>;
  /** Il testo che parla della casa (descrizione ed etichette), senza menu, zone e annunci simili: serve a ricavare lo stato. */
  narrative: string;
};

const compact = (text: string) => text.replace(/\s+/g, " ").trim();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

function positive(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = parseFlexibleNumber(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Toglie le voci non lette, così il lettore generico riempie i buchi. */
function known(fields: Partial<ListingData>): Partial<ListingData> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null)) as Partial<ListingData>;
}

const BEDROOMS_FROM_ROOMS = (rooms: number | null) => (rooms === null ? undefined : Math.max(0, rooms - 1));

// Le parole con cui i portali dicono che cos'è: case, ma anche uffici, negozi e simili, perché l'app deve saperlo e dire "non è una casa".
const TYPE_HEADS = [
  "appartamento", "attico", "loft", "villa", "villetta", "rustico", "casale", "mansarda", "monolocale", "bilocale", "trilocale",
  "quadrilocale", "pentalocale", "plurilocale", "casa", "terratetto", "palazzo", "stabile", "bifamiliare", "trifamiliare",
  "ufficio", "negozio", "box", "garage", "autorimessa", "magazzino", "capannone", "laboratorio", "terreno", "locale", "posto", "albergo",
];
const TYPE_CONNECTORS = ["di", "a", "in", "da", "e", "con", "auto", "schiera", "commerciale", "agricolo", "edificabile", "porzione", "di"];
const TYPE_WORDS = new Set([...TYPE_HEADS, ...TYPE_CONNECTORS]);
const SLUG_TYPES = new Set(TYPE_HEADS.filter((word) => word !== "casa"));

/** Il valore dopo un'etichetta, fino alla prossima etichetta nota o alla fine. */
function valueAfter(region: string, label: string, labels: string[], suffix = ""): string | null {
  const others = labels.filter((other) => other !== label).map(escapeRegex).join("|");
  const pattern = new RegExp(`(?:^|\\s)${escapeRegex(label)}${suffix}\\s+(.+?)(?=\\s+(?:${others})${suffix}(?:\\s|$)|$)`, "i");
  const match = pattern.exec(region);
  return match ? match[1].trim() : null;
}

function hostOf(url: string): string {
  return (/^https?:\/\/([^/?#]+)/i.exec(url)?.[1] ?? "").toLowerCase();
}

/** `null` se l'indirizzo non è di un portale che conosciamo o la pagina non ha il riassunto atteso. */
export function readPortalText(text: string, url?: string): PortalRead | null {
  if (!url) return null;
  const host = hostOf(url);
  if (/(^|\.)toscano\.it$/.test(host)) return readToscano(compact(text), url);
  if (/(^|\.)tecnocasa\.it$/.test(host)) return readTecnocasa(compact(text));
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// toscano.it: "Casa in vendita - Via Rogoredo, Milano (rif. 23/2026) 73 m² 3 Locali 1 Bagni Piano 4 Prezzo immobile € 229.000"
// e, più sotto, "Caratteristiche Superficie 73m² Locali 3 … Condizioni immobile Buono / Abitabile Spese condominio 250 €/mese".

const TOSCANO_TITLE = /\b([A-ZÀ-Ù][A-Za-zÀ-ù']+(?:\s+[a-zà-ù']+){0,2})\s+in\s+(vendita|affitto)\s+-\s+([^()]+?)\s*\(rif\.\s*[^)]*\)/;
const TOSCANO_LABELS = [
  "Caratteristiche",
  "Superficie",
  "Locali",
  "Bagni",
  "Piano",
  "Ascensore",
  "Riscaldamento",
  "Classe energetica",
  "Posto auto / Box",
  "Tipo costruzione",
  "Altro",
  "Spazi esterni",
  "Stato immobile",
  "Condizioni immobile",
  "Spese condominio",
  "Arredamento",
];

function readToscano(flat: string, url: string): PortalRead | null {
  const title = TOSCANO_TITLE.exec(flat);
  const titleEnd = title ? title.index + title[0].length : 0;
  const descriptionAt = flat.indexOf("Descrizione", titleEnd);
  const summary = flat.slice(titleEnd, descriptionAt > titleEnd ? descriptionAt : titleEnd + 250);
  const price = positive(/Prezzo immobile\s*€\s*([\d.]+(?:,\d{1,2})?)/i.exec(summary)?.[1]);
  if (!title && price === null) return null;

  const tableAt = flat.search(/Caratteristiche\s+Superficie/i);
  const table = tableAt >= 0 ? flat.slice(tableAt) : "";

  const rooms = positive(/(\d+)\s+Locali/i.exec(summary)?.[1]) ?? positive(/Locali\s+(\d+)/i.exec(table)?.[1]);
  const floor = (/Piano\s+(.+?)(?=\s+Prezzo immobile|$)/i.exec(summary)?.[1] ?? valueAfter(table, "Piano", TOSCANO_LABELS) ?? "").trim();
  const elevator = /Ascensore\s+(S[iì]|No)\b/i.exec(table)?.[1];
  const conditionLabel = valueAfter(table, "Condizioni immobile", TOSCANO_LABELS);

  // "Casa in vendita - Via Rogoredo, Milano": l'ultimo pezzo è il comune; il tipo, se il titolo dice solo "Casa", sta nell'indirizzo.
  const place = title ? title[3].split(",") : [];
  const word = title ? title[1].toLowerCase() : "";
  const slug = /\/\d+-([a-z]+)(?:-|$)/.exec(url.replace(/^https?:\/\/[^/]*/i, ""))?.[1] ?? "";
  const propertyType = word && word !== "casa" ? word : SLUG_TYPES.has(slug) ? slug : undefined;

  const descriptionEnd = Math.min(...[tableAt, flat.indexOf("Il presente annuncio", Math.max(0, descriptionAt))].filter((index) => index > descriptionAt));
  const narrative = descriptionAt >= 0 ? flat.slice(descriptionAt, Number.isFinite(descriptionEnd) ? descriptionEnd : descriptionAt + 3000) : "";

  return {
    narrative,
    fields: known({
      contract: title ? (title[2].toLowerCase() === "vendita" ? "sale" : "rent") : undefined,
      title: title?.[0],
      propertyType,
      price,
      sqm: positive(/(\d+(?:[.,]\d+)?)\s*m²/i.exec(summary)?.[1]) ?? positive(/Superficie\s+(\d+(?:[.,]\d+)?)\s*m/i.exec(table)?.[1]),
      rooms,
      bedrooms: BEDROOMS_FROM_ROOMS(rooms),
      bathrooms: positive(/(\d+)\s+Bagni/i.exec(summary)?.[1]) ?? positive(/Bagni\s+(\d+)/i.exec(table)?.[1]),
      floor: floor || undefined,
      condition: conditionLabel ? conditionFromPortalLabel(conditionLabel) : undefined,
      hasElevator: elevator ? /^s/i.test(elevator) : undefined,
      condoMonthly: positive(/Spese condominio\s+([\d.]+)\s*€\s*\/\s*mese/i.exec(table)?.[1]),
      energyClass: /Classe energetica\s+([A-G]\d?)\b/i.exec(table)?.[1]?.toUpperCase(),
      city: place.length > 0 ? place[place.length - 1].trim() : undefined,
    }),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// tecnocasa.it (siti delle agenzie, *.tecnocasa.it): "Trilocale in vendita Pontedera, Via Tosco Romagnola est - Fuori Dal Ponte
// € 95.000 3 locali 90 Mq 1 bagno" e la scheda "Piano: 1 di 3 Camere da letto: 2 Ascensore: No … Spese annue € 0".

const SUMMARY_AFTER_TYPE = /^([^€,]{2,60},[^€]{1,100}?)\s*€\s*([\d.]+)(?:,\d{1,2})?(?:\s*\/\s*mese)?/;

/**
 * "Porzione di bifamiliare in vendita Trecase, Via Casa Cirillo € 395.000": si parte da "in vendita/affitto" e si guarda indietro
 * finché le parole sono quelle di un tipo di immobile (così non si inglobano le parole del menu), poi in avanti per
 * "comune, via € prezzo". Il menu ("Immobili in vendita") non ha né un tipo né un prezzo e viene saltato.
 */
function findTecnocasaSummary(flat: string): { type: string; word: string; where: string; price: string; end: number } | null {
  const anchor = /\s+in\s+(vendita|affitto)\s+/gi;
  let match: RegExpExecArray | null = anchor.exec(flat);
  while (match) {
    const before = flat.slice(Math.max(0, match.index - 60), match.index).split(/\s+/).filter(Boolean);
    const words: string[] = [];
    for (let i = before.length - 1; i >= 0 && words.length < 4; i--) {
      if (!TYPE_WORDS.has(before[i].toLowerCase())) break;
      words.unshift(before[i]);
    }
    while (words.length > 0 && !TYPE_HEADS.includes(words[0].toLowerCase()) && words[0].toLowerCase() !== "porzione") words.shift();
    const start = match.index + match[0].length;
    const rest = words.length > 0 ? SUMMARY_AFTER_TYPE.exec(flat.slice(start, start + 220)) : null;
    if (rest) return { type: words.join(" "), word: match[1].toLowerCase(), where: rest[1].trim(), price: rest[2], end: start + rest[0].length };
    match = anchor.exec(flat);
  }
  return null;
}

/** "Piano: 1 di 3 (Piano basso)" → "1"; "Rialzato di 5" → "Rialzato". */
function tecnocasaFloor(value: string): string {
  return value.split(/\s+di\s+|\s*\(/)[0].trim();
}

function tecnocasaFeature(features: string, label: string): string | null {
  const pattern = new RegExp(`(?:^|\\s)${escapeRegex(label)}:\\s*(.+?)(?=\\s+[A-ZÀ-Ù][A-Za-zÀ-ù'’ ]{1,32}:|\\s+Mostra tutto|$)`);
  const match = pattern.exec(features);
  return match ? match[1].trim() : null;
}

function readTecnocasa(flat: string): PortalRead | null {
  const summary = findTecnocasaSummary(flat);
  if (!summary) return null;

  const after = flat.slice(summary.end, summary.end + 120);
  const rooms = positive(/(\d+)\s+local[ei]/i.exec(after)?.[1]);

  // "Pontedera, Via Tosco Romagnola est - Fuori Dal Ponte": il comune prima della virgola, il quartiere dopo l'ultimo " - ".
  const where = summary.where;
  const comma = where.indexOf(",");
  const rest = comma >= 0 ? where.slice(comma + 1) : "";
  const zone = rest.includes(" - ") ? rest.slice(rest.lastIndexOf(" - ") + 3).trim() : "";

  const featuresAt = flat.search(/Caratteristiche\s+Rif\.:/);
  const energyAt = flat.search(/Classe Energetica\s+[A-G]/i);
  const features = featuresAt >= 0 ? flat.slice(featuresAt, energyAt > featuresAt ? energyAt : featuresAt + 3500) : "";
  const floorRaw = tecnocasaFeature(features, "Piano");
  const bedrooms = positive(/^\d+/.exec(tecnocasaFeature(features, "Camere da letto") ?? "")?.[0]);
  const elevator = tecnocasaFeature(features, "Ascensore");
  const yearly = /Spese annue\s*€\s*([\d.]+)/i.exec(features)?.[1];

  const descriptionAt = flat.indexOf("Descrizione annuncio");
  const descriptionEnd = Math.min(
    ...[flat.indexOf("Mostra tutto", Math.max(0, descriptionAt)), flat.indexOf("Nelle vicinanze", Math.max(0, descriptionAt))].filter((index) => index > descriptionAt)
  );
  const description = descriptionAt >= 0 ? flat.slice(descriptionAt, Number.isFinite(descriptionEnd) ? descriptionEnd : descriptionAt + 3000) : "";

  return {
    narrative: `${description} ${features}`.trim(),
    fields: known({
      contract: summary.word === "vendita" ? "sale" : "rent",
      title: `${summary.type} in ${summary.word} - ${where}`,
      propertyType: summary.type.toLowerCase(),
      price: positive(summary.price),
      sqm: positive(/(\d+(?:[.,]\d+)?)\s*Mq/i.exec(after)?.[1]),
      rooms,
      bedrooms: bedrooms ?? BEDROOMS_FROM_ROOMS(rooms),
      bathrooms: positive(/(\d+)\s+bagn[io]/i.exec(after)?.[1]),
      floor: floorRaw ? tecnocasaFloor(floorRaw) || undefined : undefined,
      hasElevator: elevator ? /^s/i.test(elevator) : undefined,
      condoMonthly: yearly && positive(yearly) !== null ? Math.round((positive(yearly) as number) / 12) : undefined,
      energyClass: /Classe Energetica\s+([A-G]\d?)\b/i.exec(flat)?.[1]?.toUpperCase(),
      city: comma > 0 ? where.slice(0, comma).trim() : undefined,
      province: /\b\d{5}\s+[^()]{2,50}\(([A-Z]{2})\)/.exec(flat)?.[1],
      zone: zone || undefined,
    }),
  };
}
