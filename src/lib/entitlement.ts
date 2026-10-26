export const FREE_ANALYSES = 3;
export const ENTITLEMENT_DAYS = 365;

export type UsageState = {
  /** Gli annunci già analizzati (per `listingKey`): riaprirli non consuma analisi. */
  analyzedKeys: string[];
  /** ISO. Ultima scadenza nota del contributo, come la riporta Google Play. */
  activeUntil: string | null;
};

export const emptyUsage: UsageState = { analyzedKeys: [], activeUntil: null };

export function isActive(state: UsageState, now: Date): boolean {
  if (!state.activeUntil) return false;
  const until = new Date(state.activeUntil).getTime();
  return Number.isFinite(until) && until > now.getTime();
}

export type Gate =
  | { allowed: true; state: UsageState; freeLeft: number }
  | { allowed: false; state: UsageState; reason: "paywall" };

/**
 * Decide se si può analizzare questo annuncio. Gratis i primi `FREE_ANALYSES` annunci diversi; poi serve il contributo.
 * Con il contributo attivo `freeLeft` vale 0: la UI guarda `isActive`.
 */
export function registerAnalysis(state: UsageState, listingKey: string, now: Date): Gate {
  if (state.analyzedKeys.includes(listingKey)) {
    return { allowed: true, state, freeLeft: Math.max(0, FREE_ANALYSES - state.analyzedKeys.length) };
  }
  if (isActive(state, now) || state.analyzedKeys.length < FREE_ANALYSES) {
    const next: UsageState = { ...state, analyzedKeys: [...state.analyzedKeys, listingKey] };
    return { allowed: true, state: next, freeLeft: Math.max(0, FREE_ANALYSES - next.analyzedKeys.length) };
  }
  return { allowed: false, state, reason: "paywall" };
}

export function applyPurchase(state: UsageState, activeUntil: Date): UsageState {
  return { ...state, activeUntil: activeUntil.toISOString() };
}
