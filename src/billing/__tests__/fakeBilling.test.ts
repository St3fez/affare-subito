import AsyncStorage from "@react-native-async-storage/async-storage";

import { createFakeBilling } from "../fakeBilling";

beforeEach(() => AsyncStorage.clear());

test("senza acquisto non c'è nulla di attivo", async () => {
  const billing = createFakeBilling(() => new Date("2026-11-01T00:00:00Z"));
  expect(await billing.getActiveUntil()).toBeNull();
  expect(await billing.restore()).toBeNull();
});

test("l'acquisto di prova vale 365 giorni e si ritrova", async () => {
  const billing = createFakeBilling(() => new Date("2026-11-01T00:00:00Z"));
  const until = await billing.purchaseYear();
  expect(until.toISOString()).toBe("2027-11-01T00:00:00.000Z");
  expect(await billing.getActiveUntil()).toEqual(until);
  expect(await billing.restore()).toEqual(until);
});

test("alla scadenza non è più attivo", async () => {
  let current = new Date("2026-11-01T00:00:00Z");
  const billing = createFakeBilling(() => current);
  await billing.purchaseYear();
  current = new Date("2027-11-02T00:00:00Z");
  expect(await billing.getActiveUntil()).toBeNull();
});

test("il prezzo è quello del contributo", async () => {
  expect(await createFakeBilling().localizedPrice()).toBe("0,99 €");
});
