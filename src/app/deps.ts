import { COST_DEFAULTS } from "../lib/costs";
import { FISCAL_DEFAULTS } from "../lib/fiscal";
import type { OmiData } from "../lib/types";

/** I dati di cui ha bisogno `analyzeListing`. Il JSON OMI lo genera `scripts/build-omi.js`. */
export const analysisDeps = {
  omi: require("../data/omi.json") as OmiData,
  fiscal: FISCAL_DEFAULTS,
  costs: COST_DEFAULTS,
};
