import { COST_DEFAULTS } from "../lib/costs";
import { FISCAL_DEFAULTS } from "../lib/fiscal";
import { emptyOmi, normalizeHistory, normalizeOmi } from "../lib/omiData";
import type { OmiData, OmiHistory } from "../lib/types";

/**
 * Il JSON OMI lo genera `scripts/build-omi.js` e non è nel repository (vedi docs/dati-omi.md). Se manca, l'app parte
 * lo stesso e dice "nessun riferimento di mercato"; il `require` dentro `try` è una dipendenza facoltativa per Metro.
 */
function loadOmi(): OmiData {
  try {
    return normalizeOmi(require("../data/omi.json"));
  } catch {
    return emptyOmi;
  }
}

let history: OmiHistory | null | undefined;

/** Lo storico per i grafici (`scripts/build-omi-history.js`): si carica alla prima richiesta, perché serve solo nei risultati. */
export function getHistory(): OmiHistory | null {
  if (history === undefined) {
    try {
      history = normalizeHistory(require("../data/omi-history.json"));
    } catch {
      history = null;
    }
  }
  return history;
}

/** I dati di cui ha bisogno `analyzeListing`. */
export const analysisDeps = {
  omi: loadOmi(),
  fiscal: FISCAL_DEFAULTS,
  costs: COST_DEFAULTS,
};
