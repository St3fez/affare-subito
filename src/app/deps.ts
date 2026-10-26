import { COST_DEFAULTS } from "../lib/costs";
import { FISCAL_DEFAULTS } from "../lib/fiscal";
import { emptyOmi, normalizeOmi } from "../lib/omiData";
import type { OmiData } from "../lib/types";

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

/** I dati di cui ha bisogno `analyzeListing`. */
export const analysisDeps = {
  omi: loadOmi(),
  fiscal: FISCAL_DEFAULTS,
  costs: COST_DEFAULTS,
};
