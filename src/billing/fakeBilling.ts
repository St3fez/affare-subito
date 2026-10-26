import AsyncStorage from "@react-native-async-storage/async-storage";

import { ENTITLEMENT_DAYS } from "../lib/entitlement";
import type { Billing } from "./billing";

const KEY = "affare_subito_v2_fake_billing_until";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Solo per le build di prova: nessun pagamento vero, la scadenza sta in AsyncStorage. */
export function createFakeBilling(now: () => Date = () => new Date()): Billing {
  const activeUntil = async (): Promise<Date | null> => {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const until = new Date(raw);
    return Number.isFinite(until.getTime()) && until.getTime() > now().getTime() ? until : null;
  };

  return {
    getActiveUntil: activeUntil,
    restore: activeUntil,
    async purchaseYear() {
      const until = new Date(now().getTime() + ENTITLEMENT_DAYS * DAY_MS);
      await AsyncStorage.setItem(KEY, until.toISOString());
      return until;
    },
    async localizedPrice() {
      return "0,99 €";
    },
  };
}

/** Toglie l'acquisto di prova. Serve ai test sul telefono. */
export async function resetFakeBilling(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
