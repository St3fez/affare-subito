/** Un parametro con la sua fonte; `verifiedAt` (AAAA-MM-GG) è null finché non è stato controllato sulla fonte. */
export type Param<T> = { value: T; source: string; verifiedAt: string | null };

export type FiscalTable = {
  registroPctPrimaCasa: Param<number>;
  registroPctSeconda: Param<number>;
  registroMinimo: Param<number>;
  /** € totali (ipotecaria + catastale). */
  ipotecariaCatastaleFisse: Param<number>;
  /** % del prezzo, IVA inclusa. */
  agencyPct: Param<number>;
  /** € forfettari. */
  notaryEstimate: Param<number>;
  cedolareLongTermPct: Param<number>;
  cedolareShortTermPct: Param<number>;
};

const AE = "https://www.agenziaentrate.gov.it/portale";

export const FISCAL_DEFAULTS: FiscalTable = {
  registroPctPrimaCasa: {
    value: 2,
    source: `${AE}/schede/agevolazioni/scheda-acquisto-prima-casa/infogen-agevolazioni-acquisto-prima-casa — 2% sul valore catastale; l'app lo applica al prezzo, quindi sovrastima`,
    verifiedAt: "2026-10-26",
  },
  registroPctSeconda: {
    value: 9,
    source: `${AE}/acquisto-di-una-casa-le-imposte — 9% sul prezzo, o sul valore catastale con il prezzo-valore`,
    verifiedAt: "2026-10-26",
  },
  registroMinimo: {
    value: 1000,
    source: `${AE}/acquisto-di-una-casa-le-imposte — "non può comunque essere di importo inferiore a 1.000 euro"`,
    verifiedAt: "2026-10-26",
  },
  ipotecariaCatastaleFisse: {
    value: 100,
    source: `${AE}/acquisto-di-una-casa-le-imposte — imposta ipotecaria fissa 50 euro più imposta catastale fissa 50 euro`,
    verifiedAt: "2026-10-26",
  },
  agencyPct: {
    value: 3.66,
    source: "Stima: provvigione tipica 2-4% più IVA al 22% (3% + IVA = 3,66%); nessuna tariffa di legge (fonti divulgative: money.it, realadvisor.it, studiomadera.it)",
    verifiedAt: null,
  },
  notaryEstimate: {
    value: 2500,
    source: "Stima: onorario libero dal 2012, varia con prezzo e mutuo (fonti divulgative: notaionline.it, studiomadera.it); chiedere un preventivo",
    verifiedAt: null,
  },
  cedolareLongTermPct: {
    value: 21,
    source: `${AE}/aree-tematiche/casa/affitto/cedolare-secca — 21% (10% per i contratti a canone concordato)`,
    verifiedAt: "2026-10-26",
  },
  cedolareShortTermPct: {
    value: 21,
    source: `${AE}/le-locazioni-brevi-e-la-cedolare-secca — 21% per una sola unità, 26% per le altre dal 2024; dal 2026 il regime vale per al massimo due appartamenti`,
    verifiedAt: "2026-10-26",
  },
};

export type Acquisition = {
  registro: number;
  ipotecariaCatastale: number;
  agency: number;
  notary: number;
  /** Solo i costi extra, senza il prezzo. */
  total: number;
  /** Prezzo più costi extra. */
  outlay: number;
};

const cents = (value: number) => Math.round(value * 100) / 100;

/**
 * Acquisto da privato: l'imposta di registro si calcola sul prezzo (senza il "prezzo-valore"),
 * quindi sovrastima: la UI lo dice.
 */
export function acquisitionCosts(input: { price: number; firstHome: boolean }, table: FiscalTable): Acquisition {
  const { price, firstHome } = input;
  if (!(price > 0)) return { registro: 0, ipotecariaCatastale: 0, agency: 0, notary: 0, total: 0, outlay: 0 };

  const registroPct = firstHome ? table.registroPctPrimaCasa.value : table.registroPctSeconda.value;
  const registro = cents(Math.max(table.registroMinimo.value, price * (registroPct / 100)));
  const ipotecariaCatastale = cents(table.ipotecariaCatastaleFisse.value);
  const agency = cents(price * (table.agencyPct.value / 100));
  const notary = cents(table.notaryEstimate.value);
  const total = cents(registro + ipotecariaCatastale + agency + notary);
  return { registro, ipotecariaCatastale, agency, notary, total, outlay: cents(price + total) };
}
