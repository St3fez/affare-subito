import { emptyOmi, normalizeHistory, normalizeOmi } from "../omiData";

const valid = {
  semester: "2025-S2",
  comuni: { "MILANO|MI": { istat: "15146", name: "Milano", province: "MI", zones: [] } },
};

test("dati validi passano così come sono", () => {
  expect(normalizeOmi(valid)).toBe(valid);
});

test("file mancante, vuoto o di forma sbagliata → dati vuoti, mai un errore", () => {
  for (const bad of [undefined, null, 5, "testo", [], {}, { semester: 5, comuni: {} }, { semester: "2025-S2" }, { semester: "2025-S2", comuni: null }, { semester: "2025-S2", comuni: [] }]) {
    expect(normalizeOmi(bad)).toEqual(emptyOmi);
  }
});

test("storico: valido così com'è, altrimenti null (i grafici non compaiono)", () => {
  const history = { semesters: ["2025-S2", "2026-S1"], zones: { "1|B1": { sale: [1000, 1100], rent: [5, 5.5] } } };
  expect(normalizeHistory(history)).toBe(history);
  for (const bad of [null, undefined, {}, { semesters: "x", zones: {} }, { semesters: [], zones: [] }]) expect(normalizeHistory(bad)).toBeNull();
});
