import type { Param } from "./fiscal";
import type { Condition, Usage } from "./types";

export type RenovationLevel = "nessuno" | "leggero" | "medio" | "pesante";

export type CostTable = {
  /** €/mq */
  renovationPerSqm: { leggero: Param<number>; medio: Param<number>; pesante: Param<number> };
  furnishing: {
    /** € per camera. */
    studentRoomKit: Param<number>;
    /** €/mq, arredo completo di una casa vacanze. */
    airbnbPerSqm: Param<number>;
  };
};

// Nessuna fonte ufficiale: sono stime prudenti dentro gli intervalli delle fonti divulgative, quindi `verifiedAt` è null
// e l'app le mostra come "da verificare".
export const COST_DEFAULTS: CostTable = {
  renovationPerSqm: {
    leggero: {
      value: 150,
      source:
        "Stima: rinfrescata (tinteggiatura, piccoli ripristini, pavimenti dove servono), più leggera della 'ristrutturazione leggera' da 300-600 €/mq delle fonti divulgative (studiomadera.it, money.it)",
      verifiedAt: null,
    },
    medio: {
      value: 500,
      source: "Stima: bagno, cucina, pavimenti e impianti in parte; media nazionale citata 500-700 €/mq (studiomadera.it, money.it), preso il limite inferiore",
      verifiedAt: null,
    },
    pesante: {
      value: 1000,
      source: "Stima: ristrutturazione completa; fonti divulgative 800-1.500 €/mq, con 80-120 mila € per 100 mq (studiomadera.it, cronoshare.it)",
      verifiedAt: null,
    },
  },
  furnishing: {
    studentRoomKit: {
      value: 1000,
      source: "Stima propria: letto con materasso, scrivania con sedia, armadio, illuminazione e biancheria; nessuna fonte trovata",
      verifiedAt: null,
    },
    airbnbPerSqm: {
      value: 120,
      source: "Stima: arredo al 60-70% di un budget di 4.400-13.200 € per case vacanze da 1-2 camere (guesty.com), circa 60-140 €/mq per 60-70 mq",
      verifiedAt: null,
    },
  },
};

/** Stesso criterio della v1: pronto → nessuno, abitabile → leggero, da rinfrescare → medio, da ristrutturare → pesante. */
export function renovationLevelFor(condition: Condition | null): RenovationLevel {
  switch (condition) {
    case "abitabile":
      return "leggero";
    case "da_rinfrescare":
      return "medio";
    case "da_ristrutturare":
      return "pesante";
    default:
      return "nessuno";
  }
}

export function renovationCost(sqm: number, level: RenovationLevel, table: CostTable): number {
  if (!(sqm > 0) || level === "nessuno") return 0;
  return sqm * table.renovationPerSqm[level].value;
}

/** Vivere e lungo termine: 0 (l'utente può aggiungere il suo a mano). Monolocale = 1 camera per gli studenti. */
export function furnishingCost(usage: Usage, input: { sqm: number; bedrooms: number }, table: CostTable): number {
  switch (usage) {
    case "students":
      return Math.max(1, input.bedrooms) * table.furnishing.studentRoomKit.value;
    case "airbnb":
      return input.sqm > 0 ? input.sqm * table.furnishing.airbnbPerSqm.value : 0;
    default:
      return 0;
  }
}
