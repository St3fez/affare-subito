import type { OmiData, OmiHistory } from "./types";

export const emptyOmi: OmiData = { semester: "", comuni: {} };

/** Il JSON OMI generato da `scripts/build-omi.js`; se manca o ha una forma sbagliata si lavora senza riferimenti di mercato. */
export function normalizeOmi(raw: unknown): OmiData {
  const data = raw as Partial<OmiData> | null | undefined;
  const valid =
    !!data &&
    typeof data === "object" &&
    typeof data.semester === "string" &&
    !!data.comuni &&
    typeof data.comuni === "object" &&
    !Array.isArray(data.comuni);
  return valid ? (raw as OmiData) : emptyOmi;
}

/** Lo storico generato da `scripts/build-omi-history.js`; se manca o ha una forma sbagliata i grafici dell'andamento non compaiono. */
export function normalizeHistory(raw: unknown): OmiHistory | null {
  const data = raw as Partial<OmiHistory> | null | undefined;
  const valid = !!data && Array.isArray(data.semesters) && !!data.zones && typeof data.zones === "object" && !Array.isArray(data.zones);
  return valid ? (raw as OmiHistory) : null;
}
