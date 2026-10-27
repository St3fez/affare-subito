import type { Billing } from "./billing";
import { createFakeBilling } from "./fakeBilling";
import { createPlayBilling } from "./playBilling";

export { BillingUnavailable, PurchaseCancelled, SKU_YEAR, type Billing } from "./billing";

let instance: Billing | null = null;

/**
 * Le build di prova da cavo USB non possono pagare davvero con Google Play: con `EXPO_PUBLIC_FAKE_BILLING=1`
 * al momento di creare il bundle si usa un acquisto finto. Le build di rilascio non devono impostarla.
 */
export function getBilling(): Billing {
  if (!instance) instance = process.env.EXPO_PUBLIC_FAKE_BILLING === "1" ? createFakeBilling() : createPlayBilling();
  return instance;
}
