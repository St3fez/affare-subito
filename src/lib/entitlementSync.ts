import { BillingUnavailable, type Billing } from "../billing/billing";
import { isActive, type UsageState } from "./entitlement";

/**
 * Allinea lo stato locale a ciò che Google Play riporta. Se Play non risponde vale l'ultima scadenza nota; se risponde
 * senza acquisti (capita: Play si sta avviando, o è attivo un altro account Google) una scadenza salvata ancora futura si
 * conserva, così chi ha pagato non viene bloccato. Si azzera solo quella già passata.
 */
export async function syncEntitlement(billing: Billing, state: UsageState, now: Date = new Date()): Promise<UsageState> {
  try {
    const until = await billing.getActiveUntil();
    if (until) return { ...state, activeUntil: until.toISOString() };
    return isActive(state, now) ? state : { ...state, activeUntil: null };
  } catch (error) {
    if (error instanceof BillingUnavailable) return state;
    throw error;
  }
}
