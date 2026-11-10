import { roundCents as cents } from "./format";

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
  /** € fissi del notaio per il rogito, IVA compresa (parte fissa dell'onorario, più `notaryDeedPct` del prezzo). */
  notaryDeedBase: Param<number>;
  /** % del prezzo, IVA compresa. */
  notaryDeedPct: Param<number>;
  /** % del mutuo, IVA compresa: onorario del notaio per l'atto di mutuo e spese collegate. */
  mortgageNotaryPct: Param<number>;
  /** % del mutuo: imposta sostitutiva, se si hanno i requisiti prima casa. */
  substituteTaxPctPrimaCasa: Param<number>;
  /** % del mutuo: imposta sostitutiva negli altri casi (seconda casa e simili). */
  substituteTaxPctOther: Param<number>;
  /** € per perizia e istruttoria della banca. */
  bankFees: Param<number>;
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
  notaryDeedBase: {
    value: 1800,
    source:
      "Stima, IVA compresa: onorario libero dal 2012. Per un rogito da 200.000 € le fonti divulgative danno da circa 1.370 € (NotaiOnline.it, 2026) a 2.480-3.650 € (studiomadera.it); con 1.800 € più lo 0,35% del prezzo si resta a metà. Chiedere un preventivo",
    verifiedAt: null,
  },
  notaryDeedPct: {
    value: 0.35,
    source: "Stima, IVA compresa: la pendenza è quella delle fasce di prezzo di studiomadera.it (circa 0,37% in più ogni 100.000 € di prezzo); vedi anche notaionline.it",
    verifiedAt: null,
  },
  mortgageNotaryPct: {
    value: 1,
    source:
      "Stima, IVA compresa: l'atto di mutuo costa dallo 0,6% del mutuo più IVA (NotaiOnline.it, 2026, circa 0,73%) a circa l'1,3% (studiomadera.it, 1.950-2.560 € su 200.000 €); preso l'1% a metà. Chiedere un preventivo",
    verifiedAt: null,
  },
  substituteTaxPctPrimaCasa: {
    value: 0.25,
    source: "Imposta sostitutiva sul mutuo per la prima casa: 0,25% dell'importo erogato (art. 17 DPR 601/1973; esempio con i conti su notaionline.it/guida/costo-notaio-prima-casa-con-mutuo, 2026)",
    verifiedAt: "2026-11-10",
  },
  substituteTaxPctOther: {
    value: 2,
    source: "Imposta sostitutiva sul mutuo negli altri casi (seconda casa, ristrutturazioni senza agevolazione): 2% dell'importo erogato (art. 17 DPR 601/1973; notaionline.it/calcolo-notaio/mutuo)",
    verifiedAt: "2026-11-10",
  },
  bankFees: {
    value: 750,
    source: "Stima: perizia circa 350 € e istruttoria da 0 a 1% del mutuo (spesso una quota fissa di 180-300 €, in certe offerte gratis); per un mutuo da 150.000 € le spese accessorie sono 1.000-2.000 € (facile.it, guide 2026). Chiedere il foglio informativo alla banca",
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
  /** Il notaio per il rogito. */
  notary: number;
  /** Il notaio per l'atto di mutuo (0 senza mutuo). */
  mortgageNotary: number;
  /** Imposta sostitutiva sul mutuo (0 senza mutuo). */
  mortgageTax: number;
  /** Perizia e istruttoria della banca (0 senza mutuo). */
  bankFees: number;
  /** Solo i costi extra, senza il prezzo. */
  total: number;
  /** Prezzo più costi extra. */
  outlay: number;
};


/**
 * Acquisto da privato: l'imposta di registro si calcola sul prezzo (senza il "prezzo-valore"),
 * quindi sovrastima: la UI lo dice. Con `loan` (importo del mutuo) si aggiungono i costi del mutuo.
 */
export function acquisitionCosts(input: { price: number; firstHome: boolean; loan?: number }, table: FiscalTable): Acquisition {
  const { price, firstHome } = input;
  const loan = input.loan ?? 0;
  if (!(price > 0)) return { registro: 0, ipotecariaCatastale: 0, agency: 0, notary: 0, mortgageNotary: 0, mortgageTax: 0, bankFees: 0, total: 0, outlay: 0 };

  const registroPct = firstHome ? table.registroPctPrimaCasa.value : table.registroPctSeconda.value;
  const registro = cents(Math.max(table.registroMinimo.value, price * (registroPct / 100)));
  const ipotecariaCatastale = cents(table.ipotecariaCatastaleFisse.value);
  const agency = cents(price * (table.agencyPct.value / 100));
  const notary = cents(table.notaryDeedBase.value + price * (table.notaryDeedPct.value / 100));

  const hasLoan = loan > 0;
  const substitutePct = firstHome ? table.substituteTaxPctPrimaCasa.value : table.substituteTaxPctOther.value;
  const mortgageTax = hasLoan ? cents(loan * (substitutePct / 100)) : 0;
  const mortgageNotary = hasLoan ? cents(loan * (table.mortgageNotaryPct.value / 100)) : 0;
  const bankFees = hasLoan ? cents(table.bankFees.value) : 0;

  const total = cents(registro + ipotecariaCatastale + agency + notary + mortgageNotary + mortgageTax + bankFees);
  return { registro, ipotecariaCatastale, agency, notary, mortgageNotary, mortgageTax, bankFees, total, outlay: cents(price + total) };
}
