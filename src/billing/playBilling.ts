import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from "expo-iap";

import { ENTITLEMENT_DAYS } from "../lib/entitlement";
import { BillingUnavailable, PurchaseCancelled, SKU_YEAR, type Billing } from "./billing";

const DAY_MS = 24 * 60 * 60 * 1000;
// Quanto tempo vale offline una scadenza che Play ha appena confermato attiva.
const OFFLINE_GRACE_DAYS = 3;

let connection: Promise<void> | null = null;

function connect(): Promise<void> {
  if (!connection) {
    connection = initConnection()
      .then((connected) => {
        if (!connected) throw new BillingUnavailable("Google Play non è disponibile");
      })
      .catch((error: unknown) => {
        connection = null;
        throw error instanceof BillingUnavailable
          ? error
          : new BillingUnavailable(error instanceof Error ? error.message : "Google Play non risponde");
      });
  }
  return connection;
}

/**
 * Play non espone la scadenza lato app: si stima come acquisto + 365 giorni, ma mai prima di qualche giorno da adesso.
 * Un abbonamento che si rinnova ha un acquisto più vecchio di un anno e Play lo riporta comunque attivo.
 */
function activeUntilFor(purchase: Purchase, now: Date): Date {
  const estimated = purchase.transactionDate + ENTITLEMENT_DAYS * DAY_MS;
  return new Date(Math.max(estimated, now.getTime() + OFFLINE_GRACE_DAYS * DAY_MS));
}

function isValidYearPurchase(purchase: Purchase): boolean {
  if (purchase.productId !== SKU_YEAR || purchase.purchaseState !== "purchased") return false;
  return !("isSuspendedAndroid" in purchase && purchase.isSuspendedAndroid);
}

async function activeUntil(): Promise<Date | null> {
  await connect();
  let purchases: Purchase[];
  try {
    purchases = await getAvailablePurchases();
  } catch (error) {
    throw new BillingUnavailable(error instanceof Error ? error.message : "Google Play non risponde");
  }

  const valid = purchases.filter(isValidYearPurchase);
  if (valid.length === 0) return null;

  const latest = valid.reduce((a, b) => (b.transactionDate > a.transactionDate ? b : a));
  if (!("isAcknowledgedAndroid" in latest) || latest.isAcknowledgedAndroid === false) {
    await finishTransaction({ purchase: latest, isConsumable: false }); // Play rimborsa gli acquisti non riconosciuti entro 3 giorni
  }
  return activeUntilFor(latest, new Date());
}

export function createPlayBilling(): Billing {
  return {
    getActiveUntil: activeUntil,
    restore: activeUntil,

    async localizedPrice() {
      await connect();
      const products = await fetchProducts({ skus: [SKU_YEAR], type: "subs" });
      const product = products?.[0];
      return product && "displayPrice" in product ? product.displayPrice : null;
    },

    async purchaseYear() {
      await connect();
      const products = await fetchProducts({ skus: [SKU_YEAR], type: "subs" });
      const product = products?.[0];
      if (!product || !("subscriptionOffers" in product)) {
        throw new BillingUnavailable("Il contributo non è disponibile su Google Play");
      }
      const offerToken = (product.subscriptionOffers ?? []).find((offer) => offer.offerTokenAndroid)?.offerTokenAndroid;

      return new Promise<Date>((resolve, reject) => {
        const subscriptions: Array<{ remove: () => void }> = [];
        const done = (settle: () => void) => {
          subscriptions.forEach((subscription) => subscription.remove());
          settle();
        };

        subscriptions.push(
          purchaseUpdatedListener((purchase) => {
            if (purchase.productId !== SKU_YEAR) return;
            if (purchase.purchaseState === "pending") {
              done(() => reject(new Error("Il pagamento è in sospeso: riprova più tardi.")));
              return;
            }
            finishTransaction({ purchase, isConsumable: false })
              .then(() => done(() => resolve(activeUntilFor(purchase, new Date()))))
              .catch((error: unknown) => done(() => reject(error)));
          }),
          purchaseErrorListener((error) => {
            done(() => reject(error.code === "user-cancelled" ? new PurchaseCancelled() : new Error(error.message)));
          })
        );

        requestPurchase({
          type: "subs",
          request: {
            google: {
              skus: [SKU_YEAR],
              subscriptionOffers: offerToken ? [{ sku: SKU_YEAR, offerToken }] : undefined,
            },
          },
        }).catch((error: unknown) => done(() => reject(error)));
      });
    },
  };
}
