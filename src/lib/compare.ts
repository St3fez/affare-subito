import type { Analysis } from "./analysis";
import type { Usage } from "./types";

export type ComparisonRow = {
  id: string;
  label: string;
  kind: "currency" | "percent" | "signedPercent";
  prefer: "lower" | "higher";
  a: number | null;
  b: number | null;
  /** La casa che sta meglio su questa riga; null se manca un valore o sono uguali. */
  better: "a" | "b" | null;
};

type Ok = Extract<Analysis, { kind: "ok" }>;

/** La resa di un uso, solo se ha un'entrata: senza affitto di riferimento il numero non significa nulla. */
const yieldOf = (analysis: Ok, usage: Usage): number | null => {
  const strategy = analysis.strategies.find((s) => s.usage === usage);
  return strategy && strategy.monthlyIncome > 0 ? strategy.netYieldPct : null;
};

const ROWS: Array<Omit<ComparisonRow, "a" | "b" | "better"> & { pick: (analysis: Ok) => number | null }> = [
  { id: "price", label: "Prezzo richiesto", kind: "currency", prefer: "lower", pick: (x) => x.listing.price },
  {
    id: "pricePerSqm",
    label: "Prezzo al mq",
    kind: "currency",
    prefer: "lower",
    pick: (x) => (x.listing.price && x.listing.sqm ? x.listing.price / x.listing.sqm : null),
  },
  { id: "marketGap", label: "Rispetto al mercato", kind: "signedPercent", prefer: "lower", pick: (x) => x.verdict?.gapPct ?? null },
  { id: "totalToEnter", label: "Costo per entrare", kind: "currency", prefer: "lower", pick: (x) => x.totalToEnter.live },
  { id: "yieldLive", label: "Resa netta: viverci", kind: "percent", prefer: "higher", pick: (x) => yieldOf(x, "live") },
  { id: "yieldLongTerm", label: "Resa netta: lungo termine", kind: "percent", prefer: "higher", pick: (x) => yieldOf(x, "longTerm") },
  { id: "yieldStudents", label: "Resa netta: studenti", kind: "percent", prefer: "higher", pick: (x) => yieldOf(x, "students") },
  { id: "yieldAirbnb", label: "Resa netta: Airbnb", kind: "percent", prefer: "higher", pick: (x) => yieldOf(x, "airbnb") },
  { id: "mortgage", label: "Rata del mutuo, al mese", kind: "currency", prefer: "lower", pick: (x) => x.mortgageMonthly },
];

export function buildComparison(a: Analysis, b: Analysis): ComparisonRow[] {
  return ROWS.map(({ pick, ...row }) => {
    const valueA = a.kind === "ok" ? pick(a) : null;
    const valueB = b.kind === "ok" ? pick(b) : null;
    let better: ComparisonRow["better"] = null;
    if (valueA !== null && valueB !== null && valueA !== valueB) {
      const aIsLower = valueA < valueB;
      better = row.prefer === "lower" ? (aIsLower ? "a" : "b") : aIsLower ? "b" : "a";
    }
    return { ...row, a: valueA, b: valueB, better };
  });
}
