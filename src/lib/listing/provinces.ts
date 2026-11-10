/**
 * Le province italiane: sigla → nome (e varianti). L'OMI e il resto dell'app ragionano per sigla ("BS"), ma i testi degli annunci
 * dicono "provincia di Brescia": senza questa tabella un nome non combacia mai con la sigla, e un pezzo di testo qualsiasi
 * ("Alla Ricerca Subito…") diventerebbe una provincia.
 */
const PROVINCES: Record<string, string[]> = {
  AG: ["Agrigento"],
  AL: ["Alessandria"],
  AN: ["Ancona"],
  AO: ["Aosta", "Valle d'Aosta"],
  AP: ["Ascoli Piceno"],
  AQ: ["L'Aquila", "Aquila"],
  AR: ["Arezzo"],
  AT: ["Asti"],
  AV: ["Avellino"],
  BA: ["Bari"],
  BG: ["Bergamo"],
  BI: ["Biella"],
  BL: ["Belluno"],
  BN: ["Benevento"],
  BO: ["Bologna"],
  BR: ["Brindisi"],
  BS: ["Brescia"],
  BT: ["Barletta-Andria-Trani", "Barletta Andria Trani"],
  BZ: ["Bolzano", "Bozen"],
  CA: ["Cagliari"],
  CB: ["Campobasso"],
  CE: ["Caserta"],
  CH: ["Chieti"],
  CI: ["Carbonia-Iglesias", "Sulcis Iglesiente"],
  CL: ["Caltanissetta"],
  CN: ["Cuneo"],
  CO: ["Como"],
  CR: ["Cremona"],
  CS: ["Cosenza"],
  CT: ["Catania"],
  CZ: ["Catanzaro"],
  EN: ["Enna"],
  FC: ["Forlì-Cesena", "Forlì Cesena"],
  FE: ["Ferrara"],
  FG: ["Foggia"],
  FI: ["Firenze"],
  FM: ["Fermo"],
  FR: ["Frosinone"],
  GE: ["Genova"],
  GO: ["Gorizia"],
  GR: ["Grosseto"],
  IM: ["Imperia"],
  IS: ["Isernia"],
  KR: ["Crotone"],
  LC: ["Lecco"],
  LE: ["Lecce"],
  LI: ["Livorno"],
  LO: ["Lodi"],
  LT: ["Latina"],
  LU: ["Lucca"],
  MB: ["Monza e della Brianza", "Monza e Brianza", "Monza Brianza"],
  MC: ["Macerata"],
  ME: ["Messina"],
  MI: ["Milano"],
  MN: ["Mantova"],
  MO: ["Modena"],
  MS: ["Massa-Carrara", "Massa Carrara"],
  MT: ["Matera"],
  NA: ["Napoli"],
  NO: ["Novara"],
  NU: ["Nuoro"],
  OG: ["Ogliastra"],
  OR: ["Oristano"],
  OT: ["Olbia-Tempio", "Gallura Nord-Est Sardegna"],
  PA: ["Palermo"],
  PC: ["Piacenza"],
  PD: ["Padova"],
  PE: ["Pescara"],
  PG: ["Perugia"],
  PI: ["Pisa"],
  PN: ["Pordenone"],
  PO: ["Prato"],
  PR: ["Parma"],
  PT: ["Pistoia"],
  PU: ["Pesaro e Urbino", "Pesaro-Urbino"],
  PV: ["Pavia"],
  PZ: ["Potenza"],
  RA: ["Ravenna"],
  RC: ["Reggio Calabria"],
  RE: ["Reggio Emilia"],
  RG: ["Ragusa"],
  RI: ["Rieti"],
  RM: ["Roma"],
  RN: ["Rimini"],
  RO: ["Rovigo"],
  SA: ["Salerno"],
  SI: ["Siena"],
  SO: ["Sondrio"],
  SP: ["La Spezia"],
  SR: ["Siracusa"],
  SS: ["Sassari"],
  SU: ["Sud Sardegna"],
  SV: ["Savona"],
  TA: ["Taranto"],
  TE: ["Teramo"],
  TN: ["Trento"],
  TO: ["Torino"],
  TP: ["Trapani"],
  TR: ["Terni"],
  TS: ["Trieste"],
  TV: ["Treviso"],
  UD: ["Udine"],
  VA: ["Varese"],
  VB: ["Verbano-Cusio-Ossola", "Verbano Cusio Ossola"],
  VC: ["Vercelli"],
  VE: ["Venezia"],
  VI: ["Vicenza"],
  VR: ["Verona"],
  VS: ["Medio Campidano"],
  VT: ["Viterbo"],
  VV: ["Vibo Valentia"],
};

/** Minuscolo, senza accenti, solo lettere e cifre separate da spazi: "L'Aquila" → "l aquila". */
const plain = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const CODES = new Set(Object.keys(PROVINCES));

// Dal nome più lungo al più corto: "Reggio Emilia" prima di un eventuale "Reggio".
const NAMES: Array<[string, string]> = Object.entries(PROVINCES)
  .flatMap(([code, names]) => names.map((name): [string, string] => [plain(name), code]))
  .sort((a, b) => b[0].length - a[0].length);

/** `true` se è la sigla di una provincia ("BS"), non due lettere qualsiasi ("IT"). */
export function isProvinceCode(value: string): boolean {
  return CODES.has(value.toUpperCase());
}

/**
 * La sigla della provincia che un testo nomina all'inizio ("Brescia", "Reggio Emilia e dintorni", "BS"); `""` se non comincia con
 * il nome di una provincia.
 */
export function provinceCodeFromText(value: string): string {
  const text = plain(value);
  if (/^[a-z]{2}$/.test(text) && isProvinceCode(text)) return text.toUpperCase();
  for (const [name, code] of NAMES) {
    if (text === name || text.startsWith(`${name} `)) return code;
  }
  return "";
}
