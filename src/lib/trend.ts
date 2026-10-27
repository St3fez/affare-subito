import type { OmiHistory } from "./types";

export type TrendPoint = { semester: string; value: number | null };

/** Vendita in €/mq, affitto in €/mq al mese, un punto per semestre. */
export type MarketTrend = { sale: TrendPoint[]; rent: TrendPoint[] };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const present = (points: TrendPoint[]) => points.filter((p): p is { semester: string; value: number } => p.value !== null);

const hasValue = (v: number | null | undefined): v is number => v !== null && v !== undefined;

/**
 * L'andamento delle zone usate per il confronto. Con più zone, semestre per semestre, la mediana delle zone che hanno la serie
 * completa: una zona che compare a metà (per esempio ridisegnata dall'OMI) cambierebbe la mediana senza che i prezzi cambino.
 * Se nessuna è completa, la mediana di quelle che hanno un valore. `null` se le zone non sono nello storico o se né la
 * vendita né l'affitto hanno almeno due valori.
 */
export function marketTrend(history: OmiHistory, istat: string, zoneCodes: string[]): MarketTrend | null {
  const series = zoneCodes.map((code) => history.zones[`${istat}|${code}`]).filter((s) => s !== undefined);
  if (series.length === 0) return null;

  const pointsFor = (kind: "sale" | "rent"): TrendPoint[] => {
    const active = history.semesters.map((_, index) => index).filter((index) => series.some((s) => hasValue(s[kind][index])));
    const complete = series.filter((s) => active.every((index) => hasValue(s[kind][index])));
    const used = complete.length > 0 ? complete : series;
    return history.semesters.map((semester, index) => {
      const values = used.map((s) => s[kind][index]).filter(hasValue);
      return { semester, value: values.length > 0 ? median(values) : null };
    });
  };

  const trend = { sale: pointsFor("sale"), rent: pointsFor("rent") };
  return present(trend.sale).length >= 2 || present(trend.rent).length >= 2 ? trend : null;
}

const semesterIndex = (semester: string) => {
  const [year, half] = semester.split("-S").map(Number);
  return year * 2 + (half - 1);
};

/** Dal primo all'ultimo valore presente: variazione percentuale e anni trascorsi. */
export function trendChange(points: TrendPoint[]): { from: TrendPoint; to: TrendPoint; pct: number; years: number } | null {
  const values = present(points);
  if (values.length < 2) return null;
  const from = values[0];
  const to = values[values.length - 1];
  if (!(from.value > 0)) return null;
  return { from, to, pct: ((to.value - from.value) / from.value) * 100, years: (semesterIndex(to.semester) - semesterIndex(from.semester)) / 2 };
}
