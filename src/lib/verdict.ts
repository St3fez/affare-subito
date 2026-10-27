import type { MarketReference } from "./market";
import type { Condition, OmiState, Range } from "./types";

export type Verdict = {
  /** "sale": prezzo in €/mq; "rent": canone in €/mq al mese. */
  kind: "sale" | "rent";
  level: "sotto" | "in_linea" | "sopra";
  /** Scarto percentuale del valore al mq rispetto al valore medio della forchetta. */
  gapPct: number;
  pricePerSqm: number;
  reference: Range & { mid: number; state: OmiState };
  label: string;
};

export function omiStateFor(condition: Condition | null): OmiState {
  if (condition === "pronto") return "ottimo";
  if (condition === "da_ristrutturare") return "scadente";
  return "normale";
}

const LABELS = {
  sale: { sotto: "Sotto il mercato", sopra: "Sopra il mercato", in_linea: "In linea con il mercato di zona" },
  rent: { sotto: "Canone sotto il mercato", sopra: "Canone sopra il mercato", in_linea: "Canone in linea con il mercato di zona" },
} as const;

/** Il valore al mq dentro la forchetta dello stato dell'immobile (o quella normale, se manca). */
function judge(
  kind: Verdict["kind"],
  amount: number | null,
  sqm: number | null,
  condition: Condition | null,
  ranges: Partial<Record<OmiState, Range>>
): Verdict | null {
  if (!amount || !sqm || amount <= 0 || sqm <= 0) return null;

  const wanted = omiStateFor(condition);
  const state: OmiState = ranges[wanted] ? wanted : "normale";
  const range = ranges[state];
  if (!range) return null;

  const mid = (range.min + range.max) / 2;
  if (!(mid > 0)) return null;

  const pricePerSqm = amount / sqm;
  const gapPct = ((pricePerSqm - mid) / mid) * 100;
  const level = pricePerSqm < range.min ? "sotto" : pricePerSqm > range.max ? "sopra" : "in_linea";
  const gap = Math.abs(Math.round(gapPct));
  const label =
    level === "sotto"
      ? `${LABELS[kind].sotto}: ${gap}% meno del valore medio di zona`
      : level === "sopra"
        ? `${LABELS[kind].sopra}: ${gap}% più del valore medio di zona`
        : LABELS[kind].in_linea;

  return { kind, level, gapPct, pricePerSqm, reference: { ...range, mid, state }, label };
}

/** `null` se manca il riferimento di vendita, o il prezzo o i metri quadri non sono positivi. */
export function buildVerdict(
  input: { price: number | null; sqm: number | null; condition: Condition | null },
  market: MarketReference | null
): Verdict | null {
  return market ? judge("sale", input.price, input.sqm, input.condition, market.sale) : null;
}

/** Lo stesso confronto per un canone mensile, sulla forchetta degli affitti. */
export function buildRentVerdict(
  input: { rent: number | null; sqm: number | null; condition: Condition | null },
  market: MarketReference | null
): Verdict | null {
  return market ? judge("rent", input.rent, input.sqm, input.condition, market.rent) : null;
}
