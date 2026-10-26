import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_SETTINGS } from "../analysis";
import { clearAllData, deleteAnalysis, loadArchive, loadUsage, saveAnalysis, saveUsage, type SavedAnalysis } from "../archive";
import { emptyUsage } from "../entitlement";
import type { ListingData } from "../types";

const listing = (key: string, price = 200000): ListingData => ({
  source: "manual",
  listingKey: key,
  contract: "sale",
  title: `Immobile ${key}`,
  propertyType: "appartamento",
  price,
  sqm: 80,
  rooms: null,
  bedrooms: 2,
  bathrooms: 1,
  floor: "",
  condition: "abitabile",
  hasElevator: null,
  hasGarage: null,
  condoMonthly: null,
  energyClass: "",
  city: "Milano",
  province: "MI",
  zone: "",
  lat: null,
  lng: null,
});

const saved = (id: string, key: string, savedAt: string, price?: number): SavedAnalysis => ({
  id,
  savedAt,
  listing: listing(key, price),
  settings: DEFAULT_SETTINGS,
});

beforeEach(() => AsyncStorage.clear());

test("salva e rilegge, il più recente per primo", async () => {
  await saveAnalysis(saved("1", "a", "2026-11-01T10:00:00.000Z"));
  await saveAnalysis(saved("2", "b", "2026-11-03T10:00:00.000Z"));
  await saveAnalysis(saved("3", "c", "2026-11-02T10:00:00.000Z"));
  const archive = await loadArchive();
  expect(archive.map((item) => item.id)).toEqual(["2", "3", "1"]);
  expect(archive[0].listing.title).toBe("Immobile b");
  expect(archive[0].settings).toEqual(DEFAULT_SETTINGS);
});

test("lo stesso annuncio sostituisce la voce precedente", async () => {
  await saveAnalysis(saved("1", "a", "2026-11-01T10:00:00.000Z", 200000));
  await saveAnalysis(saved("2", "a", "2026-11-05T10:00:00.000Z", 250000));
  const archive = await loadArchive();
  expect(archive).toHaveLength(1);
  expect(archive[0]).toMatchObject({ id: "2" });
  expect(archive[0].listing.price).toBe(250000);
});

test("elimina una voce", async () => {
  await saveAnalysis(saved("1", "a", "2026-11-01T10:00:00.000Z"));
  await saveAnalysis(saved("2", "b", "2026-11-02T10:00:00.000Z"));
  await deleteAnalysis("1");
  expect((await loadArchive()).map((item) => item.id)).toEqual(["2"]);
  await deleteAnalysis("non esiste");
  expect(await loadArchive()).toHaveLength(1);
});

test("archivio vuoto o corrotto → elenco vuoto, senza eccezioni", async () => {
  expect(await loadArchive()).toEqual([]);
  await AsyncStorage.setItem("affare_subito_v2_archive", "{non è json");
  expect(await loadArchive()).toEqual([]);
  await AsyncStorage.setItem("affare_subito_v2_archive", '{"a":1}');
  expect(await loadArchive()).toEqual([]);
});

test("le voci malformate si scartano e le altre restano", async () => {
  await saveAnalysis(saved("1", "a", "2026-11-01T10:00:00.000Z"));
  const raw = JSON.parse((await AsyncStorage.getItem("affare_subito_v2_archive"))!);
  await AsyncStorage.setItem("affare_subito_v2_archive", JSON.stringify([null, 5, { id: "x" }, ...raw]));
  expect((await loadArchive()).map((item) => item.id)).toEqual(["1"]);
});

test("le chiavi della v1 non si leggono e non si toccano", async () => {
  await AsyncStorage.setItem("affare_subito_analyses", JSON.stringify([{ id: "vecchia" }]));
  expect(await loadArchive()).toEqual([]);
  await saveAnalysis(saved("1", "a", "2026-11-01T10:00:00.000Z"));
  expect(await AsyncStorage.getItem("affare_subito_analyses")).toBe(JSON.stringify([{ id: "vecchia" }]));
});

test("stato d'uso: salva e rilegge", async () => {
  expect(await loadUsage()).toEqual(emptyUsage);
  const usage = { analyzedKeys: ["a", "b"], activeUntil: "2027-11-01T00:00:00.000Z" };
  await saveUsage(usage);
  expect(await loadUsage()).toEqual(usage);
});

test("stato d'uso corrotto o di forma sbagliata → stato vuoto", async () => {
  await AsyncStorage.setItem("affare_subito_v2_usage", "{non è json");
  expect(await loadUsage()).toEqual(emptyUsage);
  await AsyncStorage.setItem("affare_subito_v2_usage", '{"analyzedKeys":"no","activeUntil":5}');
  expect(await loadUsage()).toEqual(emptyUsage);
  await AsyncStorage.setItem("affare_subito_v2_usage", '{"analyzedKeys":["a",7,"b"],"activeUntil":null}');
  expect(await loadUsage()).toEqual({ analyzedKeys: ["a", "b"], activeUntil: null });
});

test("lo stato vuoto restituito non è condiviso tra chiamate", async () => {
  const first = await loadUsage();
  first.analyzedKeys.push("zzz");
  expect((await loadUsage()).analyzedKeys).toEqual([]);
});

test("clearAllData svuota archivio e stato d'uso ma non le chiavi della v1", async () => {
  await AsyncStorage.setItem("affare_subito_analyses", "vecchio");
  await saveAnalysis(saved("1", "a", "2026-11-01T10:00:00.000Z"));
  await saveUsage({ analyzedKeys: ["a"], activeUntil: null });
  await clearAllData();
  expect(await loadArchive()).toEqual([]);
  expect(await loadUsage()).toEqual(emptyUsage);
  expect(await AsyncStorage.getItem("affare_subito_analyses")).toBe("vecchio");
});

test("eliminare un'analisi non restituisce le analisi gratuite già consumate", async () => {
  const usage = { analyzedKeys: ["a", "b", "c"], activeUntil: null };
  await saveUsage(usage);
  await saveAnalysis(saved("1", "a", "2026-11-01T10:00:00.000Z"));
  await deleteAnalysis("1");
  expect(await loadArchive()).toEqual([]);
  expect(await loadUsage()).toEqual(usage);
});
