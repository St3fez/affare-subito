import { BillingUnavailable, type Billing } from "../billing/billing";
import type { UsageState } from "./entitlement";

/** Allinea lo stato locale a ciò che Google Play riporta; se Play non risponde vale l'ultima scadenza nota. */
export async function syncEntitlement(billing: Billing, state: UsageState): Promise<UsageState> {
  try {
    const until = await billing.getActiveUntil();
    return { ...state, activeUntil: until ? until.toISOString() : null };
  } catch (error) {
    if (error instanceof BillingUnavailable) return state;
    throw error;
  }
}
