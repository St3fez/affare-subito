import type { Verdict } from "./verdict";

export type VerdictView = { headline: string; tone: "good" | "neutral" | "bad"; detail: string };

const HEADLINE = { sotto: "Sotto il mercato", in_linea: "In linea con il mercato", sopra: "Sopra il mercato" } as const;
const TONE = { sotto: "good", in_linea: "neutral", sopra: "bad" } as const;

/**
 * Titolo, tono e dettaglio del verdetto. Se i valori di mercato sono vecchi (`staleWarning`) non si dà un giudizio
 * rosso o verde: il confronto resta visibile ma dichiarato datato, perché il titolo è ciò che l'utente ricorda.
 */
export function presentVerdict(verdict: Verdict, staleWarning: string | null, semester?: string): VerdictView {
  const gap = `${verdict.gapPct >= 0 ? "+" : "−"}${Math.abs(Math.round(verdict.gapPct))}%`;
  if (staleWarning) {
    const year = semester?.match(/^(\d{4})/)?.[1];
    return {
      headline: year ? `Confronto con i valori del ${year}` : "Confronto con valori datati",
      tone: "neutral",
      detail: `${gap} rispetto a quei valori: oggi i prezzi possono essere molto diversi`,
    };
  }
  return { headline: HEADLINE[verdict.level], tone: TONE[verdict.level], detail: `${gap} rispetto al valore medio della fascia di zona` };
}
