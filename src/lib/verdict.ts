import type { MarketReference } from "./market";
import type { Condition, OmiState, Range } from "./types";

export type Verdict = {
  level: "sotto" | "in_linea" | "sopra";
  /** Scarto percentuale del prezzo al mq rispetto al valore medio della forchetta. */
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

/** `null` se manca il riferimento di vendita, o il prezzo o i metri quadri non sono positivi. */
export function buildVerdict(
  input: { price: number | null; sqm: number | null; condition: Condition | null },
  market: MarketReference | null
): Verdict | null {
  const { price, sqm } = input;
  if (!market || !price || !sqm || price <= 0 || sqm <= 0) return null;

  const wanted = omiStateFor(input.condition);
  const state: OmiState = market.sale[wanted] ? wanted : "normale";
  const range = market.sale[state];
  if (!range) return null;

  const mid = (range.min + range.max) / 2;
  if (!(mid > 0)) return null;

  const pricePerSqm = price / sqm;
  const gapPct = ((pricePerSqm - mid) / mid) * 100;
  const level = pricePerSqm < range.min ? "sotto" : pricePerSqm > range.max ? "sopra" : "in_linea";
  const gap = Math.abs(Math.round(gapPct));
  const label =
    level === "sotto"
      ? `Sotto il mercato: ${gap}% meno del valore medio di zona`
      : level === "sopra"
        ? `Sopra il mercato: ${gap}% più del valore medio di zona`
        : "In linea con il mercato di zona";

  return { level, gapPct, pricePerSqm, reference: { ...range, mid, state }, label };
}
