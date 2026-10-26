import { BillingUnavailable, type Billing } from "../../billing/billing";
import { syncEntitlement } from "../entitlementSync";

const stub = (overrides: Partial<Billing>): Billing => ({
  getActiveUntil: async () => null,
  purchaseYear: async () => new Date(),
  restore: async () => null,
  localizedPrice: async () => null,
  ...overrides,
});

test("Play riporta una scadenza → stato aggiornato, annunci conservati", async () => {
  const until = new Date("2027-11-01T00:00:00Z");
  const state = await syncEntitlement(stub({ getActiveUntil: async () => until }), { analyzedKeys: ["a"], activeUntil: null });
  expect(state).toEqual({ analyzedKeys: ["a"], activeUntil: "2027-11-01T00:00:00.000Z" });
});

test("nessun acquisto attivo → scadenza azzerata (scaduto o rimborsato)", async () => {
  const state = await syncEntitlement(stub({ getActiveUntil: async () => null }), {
    analyzedKeys: ["a", "b"],
    activeUntil: "2027-11-01T00:00:00.000Z",
  });
  expect(state).toEqual({ analyzedKeys: ["a", "b"], activeUntil: null });
});

test("Play non risponde → vale l'ultima scadenza nota", async () => {
  const before = { analyzedKeys: ["a"], activeUntil: "2027-01-01T00:00:00.000Z" };
  const unavailable = stub({
    getActiveUntil: async () => {
      throw new BillingUnavailable("offline");
    },
  });
  expect(await syncEntitlement(unavailable, before)).toEqual(before);
});

test("gli altri errori non si nascondono", async () => {
  const broken = stub({
    getActiveUntil: async () => {
      throw new Error("boom");
    },
  });
  await expect(syncEntitlement(broken, { analyzedKeys: [], activeUntil: null })).rejects.toThrow("boom");
});

test("BillingUnavailable si riconosce con instanceof", () => {
  const error = new BillingUnavailable("x");
  expect(error).toBeInstanceOf(BillingUnavailable);
  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe("BillingUnavailable");
});
