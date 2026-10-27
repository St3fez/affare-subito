import type { Verdict } from "./verdict";

export type VerdictView = { headline: string; tone: "good" | "neutral" | "bad"; detail: string };

const HEADLINE = {
  sale: { sotto: "Sotto il mercato", in_linea: "In linea con il mercato", sopra: "Sopra il mercato" },
  rent: { sotto: "Canone sotto il mercato", in_linea: "Canone in linea con il mercato", sopra: "Canone sopra il mercato" },
} as const;
const REFERENCE = { sale: "valore medio", rent: "canone medio" } as const;
const TONE = { sotto: "good", in_linea: "neutral", sopra: "bad" } as const;

/** Se i valori vengono da una zona riconosciuta o dalla media di tutto il comune, e quante zone ha quel comune. */
export type VerdictScope = { precision: "zona" | "comune"; zoneCount: number };

/** La zona dell'annuncio non è stata riconosciuta e il comune ha più zone: il confronto è con la media di tutto il comune. */
export const isCityAverage = (scope?: VerdictScope) => scope?.precision === "comune" && scope.zoneCount > 1;

/** "zona Porta Romana, Milano · valori OMI 2026-S1": da dove vengono i valori, e se la zona l'ha trovata la posizione dell'annuncio. */
export function marketSource(market: { label: string; semester: string; locatedBy?: "position" }): string {
  const place = market.locatedBy === "position" ? `${market.label}, trovata dalla posizione dell'annuncio` : market.label;
  return `${place} · valori OMI ${market.semester}`;
}

/**
 * Titolo, tono e dettaglio del verdetto. Non si dà un giudizio rosso o verde quando il confronto è debole, perché il titolo è
 * ciò che l'utente ricorda: valori di mercato vecchi (`staleWarning`), oppure la media di un comune con più zone (in una città
 * le zone vanno dalla periferia al centro, e la media non dice nulla della casa).
 */
export function presentVerdict(verdict: Verdict, staleWarning: string | null, semester?: string, scope?: VerdictScope): VerdictView {
  const gap = `${verdict.gapPct >= 0 ? "+" : "−"}${Math.abs(Math.round(verdict.gapPct))}%`;
  if (isCityAverage(scope)) {
    return {
      headline: "Confronto con la media del comune",
      tone: "neutral",
      detail: `${gap} rispetto al ${REFERENCE[verdict.kind]} di tutto il comune: non ho riconosciuto la zona dell'annuncio tra quelle dell'OMI, e in una città le zone sono molto diverse.`,
    };
  }
  if (staleWarning) {
    const year = semester?.match(/^(\d{4})/)?.[1];
    return {
      headline: year ? `Confronto con i valori del ${year}` : "Confronto con valori datati",
      tone: "neutral",
      detail: `${gap} rispetto a quei valori: oggi i prezzi possono essere molto diversi`,
    };
  }
  return {
    headline: HEADLINE[verdict.kind][verdict.level],
    tone: TONE[verdict.level],
    detail: `${gap} rispetto al ${REFERENCE[verdict.kind]} della fascia di zona`,
  };
}
