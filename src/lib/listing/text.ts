import { parseFlexibleNumber, toNumber } from "../format";
import { stableHash } from "./hash";
import type { Condition, ListingData } from "../types";

type MoneyCandidate = {
  value: number;
  index: number;
  context: string;
};

const PROPERTY_TYPES = [
  "monolocale",
  "bilocale",
  "trilocale",
  "quadrilocale",
  "villetta a schiera",
  "casa di corte",
  "rustico",
  "cascina",
  "attico",
  "loft",
  "villa",
  "villetta",
  "duplex",
  "appartamento",
  "ufficio",
  "locale commerciale",
];

const LOCATION_STOP_WORDS = [
  "vendita",
  "affitto",
  "richiesta",
  "prezzo",
  "canone",
  "mq",
  "m2",
  "metri",
  "ascensore",
  "ristrutturare",
  "locazione",
  "immobile",
  "tranquilla",
  "tranquillo",
  "servita",
  "servito",
  "strategica",
  "strategico",
  "residenziale",
  "silenziosa",
  "silenzioso",
  "comoda",
  "comodo",
  "verde",
  "affittato",
  "livello",
  "nuovo",
  "top",
  "sky",
  "comune",
  "visita",
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeSpeechPhrase(text: string): string {
  return normalizeText(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:!?]+$/g, "").trim();
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function parseCondition(text: string): Condition | null {
  const t = normalizeText(text);
  const spoken = normalizeSpeechPhrase(text);
  if (
    t.includes("da ristrutturare") ||
    spoken.includes("da ristrutturare") ||
    spoken.includes("ristrutturazione") ||
    spoken.includes("ristrutturare") ||
    spoken.includes("da rifare") ||
    t.includes("completamente da rifare") ||
    t.includes("integralmente da rifare") ||
    t.includes("grezzo")
  ) {
    return "da_ristrutturare";
  }
  if (
    t.includes("da rinfrescare") ||
    spoken.includes("da rinfrescare") ||
    spoken.includes("rinfrescare") ||
    spoken.includes("da sistemare") ||
    t.includes("da sistemare") ||
    t.includes("da ammodernare") ||
    t.includes("da rivedere") ||
    t.includes("parzialmente da ristrutturare")
  ) {
    return "da_rinfrescare";
  }
  if (
    t.includes("abitabile") ||
    spoken.includes("abitabile") ||
    spoken.includes("buono stato") ||
    spoken.includes("buone condizioni") ||
    spoken.includes("discreto")
  ) {
    return "abitabile";
  }
  if (
    t.includes("pronto da abitare") ||
    spoken.includes("pronto") ||
    spoken.includes("pronto da abitare") ||
    t.includes("chiavi in mano") ||
    t.includes("ristrutturato") ||
    t.includes("nuova costruzione") ||
    t.includes("ottime condizioni") ||
    t.includes("perfette condizioni")
  ) {
    return "pronto";
  }
  return null;
}

function buildMoneyCandidateContext(text: string, startIndex: number, rawLength: number): string {
  const lower = text.toLowerCase();
  const currentStart = lower.lastIndexOf("\n", Math.max(0, startIndex - 1)) + 1;
  const currentEndCandidate = lower.indexOf("\n", startIndex + rawLength);
  const currentEnd = currentEndCandidate >= 0 ? currentEndCandidate : lower.length;
  return lower.slice(currentStart, currentEnd).trim();
}

function extractMoneyCandidates(text: string): MoneyCandidate[] {
  const regexes = [
    /(?:\u20ac)\s*\d[\d.,\s]{0,18}(?:\s?(?:k|mila|mln|milioni))?/gi,
    /\d[\d.,\s]{0,18}\s*(?:\u20ac|euro|eur|k|mila|mln|milioni)/gi,
    /\b\d{3,6}(?:[.,]\d{1,2})?\s*(?:\u20ac|e)(?=\s*\/?\s*(?:mese|mensile|mensili)\b)/gi,
    /\b\d{3,6}(?:[.,]\d{1,2})?\b(?=\s*(?:\/\s*mese|\s+al\s+mese|\s+mese\b))/gi,
    /\b\d{2,3}(?:[.\s]\d{3})+(?:,\d{2})?\b/g,
  ];
  const output: MoneyCandidate[] = [];

  for (const regex of regexes) {
    let match: RegExpExecArray | null = regex.exec(text);
    while (match) {
      const raw = match[0];
      const index = match.index;
      const context = buildMoneyCandidateContext(text, index, raw.length);
      let value = parseFlexibleNumber(raw);

      if (/mln|milioni/i.test(raw)) value *= 1000000;
      else if (/k|mila/i.test(raw)) value *= 1000;

      if (value >= 100 && value <= 50000000) {
        output.push({ value: Math.round(value), index, context });
      }

      match = regex.exec(text);
    }
  }

  return output.filter((item, index, array) => {
    return array.findIndex((candidate) => candidate.index === item.index && candidate.value === item.value) === index;
  });
}

function pickMoneyCandidate(
  candidates: MoneyCandidate[],
  positiveWords: string[],
  negativeWords: string[],
  minValue: number,
  maxValue: number
): number | null {
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestValue: number | null = null;

  for (const candidate of candidates) {
    if (candidate.value < minValue || candidate.value > maxValue) continue;

    let score = 0;
    for (const word of positiveWords) {
      if (candidate.context.includes(word)) score += 3;
    }
    for (const word of negativeWords) {
      if (candidate.context.includes(word)) score -= 4;
    }

    if (score > bestScore) {
      bestScore = score;
      bestValue = candidate.value;
    }
  }

  if (bestScore <= 0) return null;
  return bestValue;
}

function pickFallbackMoneyCandidate(candidates: MoneyCandidate[], minValue: number, maxValue: number): number | null {
  const filtered = candidates.filter((candidate) => {
    if (candidate.value < minValue || candidate.value > maxValue) return false;
    return !["mese", "mensile", "canone", "affitto", "mutuo", "rata", "spese", "annue", "annuali", "fino", "filtri", "salva ricerca", "budget"].some(
      (word) => candidate.context.includes(word)
    );
  });

  if (filtered.length === 0) return null;
  return [...filtered].sort((a, b) => b.value - a.value)[0]?.value ?? null;
}

function extractTopStandalonePrice(text: string): number | null {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  let bestValue: number | null = null;

  for (const line of lines) {
    if (/\b(?:mq|m2|mÂ²|m²|mese|mensile|canone|rata|mutuo)\b/i.test(line)) continue;
    const matches = line.match(/\b\d{2,3}(?:[.\s]\d{3})+(?:,\d{2})?\b/g) || [];
    for (const raw of matches) {
      const value = Math.round(parseFlexibleNumber(raw));
      if (value < 10000 || value > 20000000) continue;
      if (bestValue === null || value > bestValue) bestValue = value;
    }
  }

  return bestValue;
}

function getSqmContextScore(line: string): number {
  const normalized = normalizeText(line);
  let score = 0;

  if (normalized.includes("totale superficie principale")) score += 18;
  else {
    if (normalized.includes("superficie principale")) score += 14;
    if (normalized.includes("superficie commerciale") || normalized.includes("sup commerciale") || normalized.includes("commerciale")) score += 10;
    if (normalized.includes("dettagli superficie")) score += 4;
    if (normalized.includes("superficie")) score += 6;
  }

  if (/(mq|m2|mÂ²|m²|metri quadri|metri commerciali)/i.test(line)) score += 3;
  if (normalized.includes("totale")) score += 2;

  return score;
}

function pushSqmCandidate(output: Array<{ value: number; score: number }>, rawValue: string, line: string, scoreBonus = 0) {
  const value = parseFlexibleNumber(rawValue);
  if (!Number.isFinite(value) || value < 15 || value > 1000) return;
  output.push({ value, score: getSqmContextScore(line) + scoreBonus });
}

function extractSqm(text: string): number | null {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates: Array<{ value: number; score: number }> = [];
  const linePatterns = [
    /(\d{1,4}(?:[,.]\d{1,2})?)\s*(?:mq|m2|mÂ²|m²)/gi,
    /superficie[^\d]{0,24}(\d{1,4}(?:[,.]\d{1,2})?)/gi,
    /totale[^\d]{0,24}(\d{1,4}(?:[,.]\d{1,2})?)/gi,
  ];

  for (const line of lines) {
    const packedMatch = line.match(/\b(\d)\s*(\d{2})(?:[,.]\d+)?\s*(?:mq|m2|mÂ²|m²)(?=\S*[A-Za-z]\S*\d)/i);
    if (packedMatch?.[2]) {
      pushSqmCandidate(candidates, packedMatch[2], line, 14);
    }

    for (const pattern of linePatterns) {
      let match: RegExpExecArray | null = pattern.exec(line);
      while (match) {
        if (match[1]) pushSqmCandidate(candidates, match[1], line);
        match = pattern.exec(line);
      }
    }
  }

  if (candidates.length === 0) {
    const looseMatch = text.match(/(\d{2,4})(?:[.,]\d{1,2})?\s*m(?:q|2|Â²|²)?\b/i);
    if (looseMatch?.[1]) {
      const looseValue = Math.round(parseFlexibleNumber(looseMatch[1]));
      if (looseValue >= 15 && looseValue <= 1000) return looseValue;
    }
    return null;
  }
  const bestCandidate = [...candidates].sort((left, right) => right.score - left.score || right.value - left.value)[0];
  return bestCandidate ? Math.round(bestCandidate.value) : null;
}

function parseSmallCountToken(raw: string): number | null {
  const normalized = normalizeSpeechPhrase(raw);
  if (!normalized) return null;
  if (/^\d{1,2}$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const wordMap: Record<string, number> = {
    zero: 0,
    un: 1,
    uno: 1,
    una: 1,
    due: 2,
    tre: 3,
    quattro: 4,
    cinque: 5,
    sei: 6,
    sette: 7,
    otto: 8,
    nove: 9,
    dieci: 10,
  };

  return Number.isFinite(wordMap[normalized]) ? wordMap[normalized] : null;
}

function extractCountByPatterns(text: string, patterns: RegExp[], fallbackChecks: Array<[string, number]> = []): number | null {
  const normalized = normalizeSpeechPhrase(text);

  for (const [pattern, value] of fallbackChecks) {
    if (normalized.includes(pattern)) return value;
  }

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const parsed = parseSmallCountToken(raw);
    if (parsed !== null && parsed >= 0 && parsed <= 20) return parsed;
  }

  return null;
}

function extractBedrooms(text: string): number | null {
  return extractCountByPatterns(text, [
    /(\d{1,2}|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s+(?:camere?|stanze?)\b(?:\s+da\s+letto)?/i,
    /(?:camere?|stanze?)\b(?:\s+da\s+letto)?\s*[:\-]?\s*(\d{1,2}|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/i,
  ]);
}

function extractBathrooms(text: string): number | null {
  const normalized = normalizeSpeechPhrase(text);
  if (normalized.includes("doppio bagno") || normalized.includes("doppi servizi")) return 2;

  const lines = text
    .split(/\n+/)
    .map((line) => normalizeSpeechPhrase(line))
    .filter(Boolean);
  const tokenPattern = "(\\d{1,2}|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)";
  const labelFirst = new RegExp(`\\bbagni?\\b\\s*[:\\-]?\\s*${tokenPattern}\\b`, "i");
  const valueFirst = new RegExp(`\\b${tokenPattern}\\s+bagni?\\b`, "i");

  for (const line of lines) {
    const match = line.match(labelFirst);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const parsed = parseSmallCountToken(raw);
    if (parsed !== null && parsed >= 0 && parsed <= 20) return parsed;
  }

  for (const line of lines) {
    const match = line.match(valueFirst);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const prefix = line.slice(0, match?.index ?? 0);
    if (/\b(locali?|stanze?|camere?)\b/.test(prefix)) continue;
    const parsed = parseSmallCountToken(raw);
    if (parsed !== null && parsed >= 0 && parsed <= 20) return parsed;
  }

  return null;
}

function extractBooleanFeature(text: string, positivePatterns: string[], negativePatterns: string[]): boolean | null {
  const normalized = normalizeSpeechPhrase(text);
  if (!normalized) return null;

  for (const pattern of negativePatterns) {
    if (normalized === pattern || normalized.startsWith(`${pattern} `) || normalized.includes(pattern)) return false;
  }

  for (const pattern of positivePatterns) {
    if (normalized === pattern || normalized.startsWith(`${pattern} `) || normalized.includes(pattern)) return true;
  }

  return null;
}

function extractGarageFeature(text: string): boolean | null {
  const normalized = normalizeSpeechPhrase(text);
  if (!normalized) return null;

  if (
    normalized.includes("senza garage") ||
    normalized.includes("senza box auto") ||
    normalized.includes("senza box") ||
    normalized.includes("garage assente")
  ) {
    return false;
  }

  if (
    normalized.includes("garage") ||
    normalized.includes("box auto") ||
    normalized.includes("autorimessa") ||
    normalized.includes("box singolo") ||
    normalized.includes("box doppio") ||
    /\bbox\b\s*[:\-]?\s*\d{1,2}\b/.test(normalized)
  ) {
    return true;
  }

  return null;
}

function parseFloorValue(raw: string, allowStandaloneNumeric = false): string {
  const compact = normalizeText(raw).replace(/\s+/g, " ").trim();
  if (!compact) return "";

  if (compact === "terra" || compact === "piano terra" || compact === "al piano terra" || compact.includes("piano terra")) return "0";
  if (
    compact === "seminterrato" ||
    compact === "interrato" ||
    compact === "piano seminterrato" ||
    compact === "piano interrato" ||
    compact.includes("seminterrato") ||
    compact.includes("interrato")
  ) {
    return "-1";
  }
  if (compact === "rialzato" || compact === "piano rialzato" || compact.includes("rialzato")) return "1";

  const wordMap: Record<string, string> = {
    primo: "1",
    secondo: "2",
    terzo: "3",
    quarto: "4",
    quinto: "5",
    sesto: "6",
    settimo: "7",
    ottavo: "8",
  };

  for (const [word, value] of Object.entries(wordMap)) {
    if (
      compact === word ||
      compact === `${word} piano` ||
      compact === `piano ${word}` ||
      compact === `al ${word} piano` ||
      compact === `al piano ${word}` ||
      compact.includes(`${word} piano`) ||
      compact.includes(`piano ${word}`)
    ) {
      return value;
    }
  }

  const explicitNumericMatch =
    compact.match(/\b(?:piano|floor)\s*[:\-]?\s*(-?\d{1,2})\b/) ||
    compact.match(/\b(-?\d{1,2})(?:°|º|o|a)?\s*piano\b/);
  if (explicitNumericMatch?.[1]) return explicitNumericMatch[1];

  if (allowStandaloneNumeric && /^-?\d{1,2}$/.test(compact)) return compact;

  return "";
}

function extractFloor(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => normalizeText(line).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const compact = normalizeText(text).replace(/\s+/g, " ").trim();

  if (lines.length <= 1 || compact.length <= 28) {
    return parseFloorValue(compact, true);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const parsedInline = parseFloorValue(line, line.split(" ").length <= 2);
    if (parsedInline) return parsedInline;

    if (/\b(?:piano|floor)\b/.test(line)) {
      const nextLine = lines[index + 1] || "";
      const parsedNext = parseFloorValue(nextLine, true);
      if (parsedNext) return parsedNext;
    }
  }

  return parseFloorValue(compact, false);
}

function extractType(text: string): string {
  const t = normalizeText(text);
  for (const propertyType of PROPERTY_TYPES) {
    if (t.includes(propertyType)) return propertyType;
  }

  const localiMatch = t.match(/(\d{1,2})\s*locali\b/);
  const locali = localiMatch?.[1] ? Number(localiMatch[1]) : 0;
  if (locali === 1) return "monolocale";
  if (locali === 2) return "bilocale";
  if (locali === 3) return "trilocale";
  if (locali === 4) return "quadrilocale";
  if (locali >= 5) return "appartamento";

  return "";
}

function cleanupLocation(value: string): string {
  let cleaned = stripTrailingPunctuation(value).replace(/[|•·]+/g, " ").replace(/\s{2,}/g, " ").trim();
  const normalizedTokens = normalizeSpeechPhrase(cleaned)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
  if (normalizedTokens.length === 0) return "";
  if (normalizedTokens.every((token) => token.length <= 2)) return "";
  if (normalizedTokens.some((token) => LOCATION_STOP_WORDS.includes(token))) return "";
  cleaned = cleaned
    .split(" ")
    .filter((token) => normalizeSpeechPhrase(token).length > 1 || /[A-Za-zÀ-ú]{2,}/.test(token))
    .join(" ")
    .trim();
  if (cleaned.length <= 2) return "";
  if (cleaned.length > 32) {
    cleaned = cleaned.split(",")[0]?.trim() || cleaned;
  }
  return titleCase(cleaned);
}

function extractProvince(text: string): string {
  const compact = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const provincePatterns = [
    /provincia(?:\s+di)?\s+([A-ZÀ-Ú][A-Za-zÀ-ú' -]{1,30})/iu,
    /prov\.\s*([A-ZÀ-Ú][A-Za-zÀ-ú' -]{1,30})/iu,
    /\(([A-Z]{2})\)/u,
  ];

  for (const pattern of provincePatterns) {
    const match = compact.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
    const cleaned = cleanupLocation(raw);
    if (cleaned) return cleaned;
  }
  return "";
}

function stripPropertyTypePrefix(value: string): string {
  let cleaned = value.trim();
  for (const propertyType of PROPERTY_TYPES) {
    const pattern = new RegExp(`^${propertyType}\\s+`, "i");
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim();
}

function extractCityZone(text: string): { city: string; zone: string } {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const usefulLines = rawLines.filter((line) => !isLikelyPortalUiLine(line));
  const compact = usefulLines.join(" ").replace(/\s+/g, " ").trim();
  let city = "";
  let zone = "";

  const zonePatterns = [
    /zona\s+([\p{L}0-9' -]{2,40})/iu,
    /quartiere\s+([\p{L}0-9' -]{2,40})/iu,
    /-(?!\s*(?:via|viale|piazza|corso|vicolo|strada|sp\b|localita\b))\s*([\p{Lu}][\p{L}' -]{2,40})(?=$|[,(])/iu,
  ];

  for (const pattern of zonePatterns) {
    const match = compact.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const cleaned = cleanupLocation(raw.split(" con ")[0]?.split(" senza ")[0] || raw);
    if (cleaned) {
      zone = cleaned;
      break;
    }
  }

  for (const line of usefulLines) {
    const cityFirstMatch = line.match(/^([\p{Lu}][\p{L}' -]{1,40})\s*,\s*(?:via|viale|piazza|corso|vicolo|strada|sp\b|localita\b)[^\n-]{0,80}(?:-\s*([\p{Lu}][\p{L}' -]{1,40}))?/iu);
    if (cityFirstMatch?.[1]) {
      if (!city) city = cleanupLocation(cityFirstMatch[1]);
      if (!zone && cityFirstMatch[2]) zone = cleanupLocation(cityFirstMatch[2]);
      if (city && zone) return { city, zone };
    }

    const streetFirstMatch = line.match(/(?:via|viale|piazza|corso|vicolo|strada|sp\b|localita\b)\s+[\p{L}0-9' .-]{2,80},\s*([\p{Lu}][\p{L}' -]{1,40})(?=$|\s*\(|\s*-|\s*,)/iu);
    if (streetFirstMatch?.[1] && !city) {
      city = cleanupLocation(streetFirstMatch[1]);
      if (city && zone) return { city, zone };
    }

    const provinceMatch = line.match(/([\p{Lu}][\p{L}' -]{1,40})\s*\(([A-Z]{2})\)/u);
    if (provinceMatch?.[1] && !city) {
      const candidate = cleanupLocation(provinceMatch[1]);
      if (candidate) city = candidate;
    }
  }

  for (const line of usefulLines) {
    if (!/[|]/.test(line) && !line.includes("\u2022") && !line.includes("\u00b7")) continue;
    const rawPieces = line
      .split(/[\u2022\u00b7|]/u)
      .map((piece) => stripPropertyTypePrefix(piece.replace(/\([A-Z]{2}\)/g, "").trim()))
      .filter(Boolean);
    const cleanedPieces = rawPieces.map((piece) => cleanupLocation(piece)).filter(Boolean);
    if (cleanedPieces.length < 2) continue;

    if (/\([A-Z]{2}\)/.test(line) && cleanedPieces.length >= 2) {
      if (!city) city = cleanedPieces[1] || cleanedPieces[0];
      if (!zone && cleanedPieces[0] && cleanedPieces[0] !== city) zone = cleanedPieces[0];
    } else {
      if (!city) city = cleanedPieces[0];
      if (!zone && cleanedPieces[1] && cleanedPieces[1] !== city) zone = cleanedPieces[1];
    }

    if (city && zone) return { city, zone };
  }

  for (const line of usefulLines) {
    const stripped = stripPropertyTypePrefix(line.replace(/\([A-Z]{2}\)/g, "").trim());
    if (!stripped) continue;
    const normalizedStripped = normalizeText(stripped);
    if (/(^| )(piano|superficie|abitazione|dettagli|bagni|locali|commerciale|principale)( |$)/.test(normalizedStripped)) continue;

    const commaIndex = stripped.indexOf(",");
    const head = commaIndex > 0 ? stripped.slice(0, commaIndex).trim() : stripped;
    const words = head.split(/\s+/).filter(Boolean);
    const locationWords: string[] = [];

    for (let index = 0; index < words.length; index += 1) {
      const token = words[index].replace(/[()]/g, "");
      if (!/^[\p{Lu}][\p{L}'’-]*$/u.test(token)) break;
      locationWords.push(token);
    }

    if (locationWords.length >= 2) {
      const firstLocation = cleanupLocation(locationWords[0]);
      const zoneCandidate = cleanupLocation(locationWords.slice(1).join(" "));
      if (!firstLocation) continue;
      if (!city) city = firstLocation;
      if (!zone && zoneCandidate && normalizeText(firstLocation) === normalizeText(city)) zone = zoneCandidate;
      if (city && zone) break;
    }
  }

  if (!city) {
    const cityPatterns = [
      /nel comune di\s+([\p{Lu}][\p{L}']{1,20}(?:\s+[\p{Lu}][\p{L}']{1,20}){0,2})/u,
      /\ba\s+([\p{Lu}][\p{L}']{1,20}(?:\s+[\p{Lu}][\p{L}']{1,20}){0,2})/u,
    ];

    for (const pattern of cityPatterns) {
      const match = compact.match(pattern);
      const raw = match?.[1]?.trim();
      if (!raw) continue;
      const cleaned = cleanupLocation(raw);
      if (cleaned) {
        city = cleaned;
        break;
      }
    }
  }

  city = cleanupLocation(city);
  zone = cleanupLocation(zone);
  return { city, zone };
}

function isLikelyPortalUiLine(value: string): boolean {
  const raw = value.toLowerCase();
  const normalized = normalizeSpeechPhrase(value);
  if (!normalized) return true;
  if (/^\d{1,2}\s?\d{2}$/.test(normalized.replace(/\s+/g, ""))) return true;
  if (raw.includes("http") || raw.includes(".it/")) return true;
  return [
    "tecnocasa",
    "casa it",
    "immobiliare it",
    "idealista",
    "medialabtc",
    "filtri",
    "salva ricerca",
    "lista",
    "mappa",
    "visita",
    "virtuale",
    "foto",
    "planimetrie",
    "chiama",
    "scrivi",
    "messaggi",
    "contattaci",
  ].some((token) => normalized.includes(token));
}

function extractTitle(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && line.length <= 90 && !isLikelyPortalUiLine(line));

  const priorityCandidate = lines.find((line) => {
    const normalized = normalizeText(line);
    return normalized.includes("in vendita") || normalized.includes("in affitto");
  });
  if (priorityCandidate) return stripTrailingPunctuation(priorityCandidate);

  const propertyCandidate = lines.find((line) => {
    const normalized = normalizeText(line);
    return PROPERTY_TYPES.some((propertyType) => normalized.includes(propertyType)) || /\b\d{1,2}\s+locali\b/i.test(normalized);
  });
  if (propertyCandidate) return stripTrailingPunctuation(propertyCandidate);

  return lines[0] ? stripTrailingPunctuation(lines[0]) : "";
}

export function parseListingText(text: string, url?: string): ListingData {
  const candidates = extractMoneyCandidates(text);
  const price =
    pickMoneyCandidate(
      candidates,
      ["prezzo", "richiesta", "richiesto", "vendita", "costo", "trattabile"],
      ["affitto", "canone", "mese", "mensile", "locato", "rendita", "rivendita", "uscita", "rata", "mutuo"],
      10000,
      20000000
    ) ??
    pickFallbackMoneyCandidate(candidates, 10000, 20000000) ??
    extractTopStandalonePrice(text);
  const { city, zone } = extractCityZone(text);
  const bedrooms = extractBedrooms(text);
  const bathrooms = extractBathrooms(text);
  const normalized = normalizeText(text);

  let hasElevator: boolean | null = null;
  if (normalized.includes("senza ascensore") || normalized.includes("no ascensore")) {
    hasElevator = false;
  } else if (
    normalized.includes("con ascensore") ||
    normalized.includes("dotato di ascensore") ||
    normalized.includes("ascensorato")
  ) {
    hasElevator = true;
  }

  return {
    source: "text",
    url,
    listingKey: `text:${stableHash(normalized)}`,
    contract: "unknown",
    title: extractTitle(text),
    propertyType: extractType(text).toLowerCase(),
    price: price || null,
    sqm: extractSqm(text) || null,
    rooms: null,
    bedrooms: bedrooms === null ? null : Math.round(bedrooms),
    bathrooms: bathrooms === null ? null : Math.round(bathrooms),
    floor: extractFloor(text),
    condition: parseCondition(text),
    hasElevator,
    hasGarage: extractGarageFeature(text),
    condoMonthly: null,
    energyClass: "",
    city,
    province: extractProvince(text),
    zone,
    lat: null,
    lng: null,
  };
}
