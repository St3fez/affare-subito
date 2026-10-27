/** Google Play non risponde (nessuna rete, servizio non disponibile): si tiene l'ultima scadenza nota. */
export class BillingUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingUnavailable";
    Object.setPrototypeOf(this, BillingUnavailable.prototype);
  }
}

/** L'utente ha chiuso la finestra di pagamento: non è un errore da mostrare. */
export class PurchaseCancelled extends Error {
  constructor() {
    super("Acquisto annullato");
    this.name = "PurchaseCancelled";
    Object.setPrototypeOf(this, PurchaseCancelled.prototype);
  }
}

/** Id del prodotto da creare sulla Play Console (abbonamento da 0,99 € valido 12 mesi). */
export const SKU_YEAR = "contributo_annuale";

export interface Billing {
  /** Fino a quando vale il contributo; `null` se non c'è un acquisto attivo. Lancia `BillingUnavailable` se Play non risponde. */
  getActiveUntil(): Promise<Date | null>;
  /** Apre il pagamento e restituisce la nuova scadenza. Lancia `PurchaseCancelled` se l'utente annulla. */
  purchaseYear(): Promise<Date>;
  restore(): Promise<Date | null>;
  /** Prezzo come lo scrive Play, per esempio "0,99 €". */
  localizedPrice(): Promise<string | null>;
}
