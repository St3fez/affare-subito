import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AnalysisSettings } from "./analysis";
import type { UsageState } from "./entitlement";
import type { ListingData } from "./types";

// Chiavi nuove: quelle della v1 ("affare_subito_analyses", ...) non si leggono né si cancellano.
const ARCHIVE_KEY = "affare_subito_v2_archive";
const USAGE_KEY = "affare_subito_v2_usage";

/** Si salvano gli ingressi, non il risultato: all'apertura si ricalcola, così i miglioramenti arrivano anche alle voci vecchie. */
export type SavedAnalysis = {
  id: string;
  savedAt: string;
  listing: ListingData;
  settings: AnalysisSettings;
};

function isSavedAnalysis(value: any): value is SavedAnalysis {
  return (
    typeof value?.id === "string" &&
    typeof value?.savedAt === "string" &&
    typeof value?.listing?.listingKey === "string" &&
    typeof value?.settings === "object" &&
    value.settings !== null
  );
}

async function readArchive(): Promise<SavedAnalysis[]> {
  try {
    const raw = await AsyncStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedAnalysis) : [];
  } catch {
    return [];
  }
}

/** Dal più recente. */
export async function loadArchive(): Promise<SavedAnalysis[]> {
  const items = await readArchive();
  return items.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}

/** Lo stesso annuncio (`listing.listingKey`) sostituisce la voce precedente. */
export async function saveAnalysis(item: SavedAnalysis): Promise<void> {
  const others = (await readArchive()).filter((existing) => existing.listing.listingKey !== item.listing.listingKey);
  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify([...others, item]));
}

export async function deleteAnalysis(id: string): Promise<void> {
  const remaining = (await readArchive()).filter((item) => item.id !== id);
  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(remaining));
}

export async function loadUsage(): Promise<UsageState> {
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed?.analyzedKeys) && (parsed.activeUntil === null || typeof parsed.activeUntil === "string")) {
      return {
        analyzedKeys: parsed.analyzedKeys.filter((key: unknown): key is string => typeof key === "string"),
        activeUntil: parsed.activeUntil,
      };
    }
  } catch {
    // dati illeggibili: si riparte da zero
  }
  return { analyzedKeys: [], activeUntil: null };
}

export async function saveUsage(state: UsageState): Promise<void> {
  await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(state));
}

/** Azzera archivio e stato d'uso (le chiavi della v1 restano). Serve ai test sul telefono. */
export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([ARCHIVE_KEY, USAGE_KEY]);
}
