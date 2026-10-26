import { staleDataWarning } from "../staleness";

const now = new Date("2026-10-26T12:00:00Z"); // secondo semestre 2026

test("valori di più di due anni fa → avviso che nomina il semestre", () => {
  const warning = staleDataWarning("2018-S2", now);
  expect(warning).toMatch(/secondo semestre 2018/);
  expect(staleDataWarning("2019-S1", now)).toMatch(/primo semestre 2019/);
});

test("il confine: quattro semestri fa avvisa, tre no", () => {
  expect(staleDataWarning("2024-S2", now)).not.toBeNull();
  expect(staleDataWarning("2025-S1", now)).toBeNull();
});

test("valori recenti → nessun avviso", () => {
  expect(staleDataWarning("2026-S1", now)).toBeNull();
  expect(staleDataWarning("2025-S2", now)).toBeNull();
});

test("il semestre corrente dipende dal mese", () => {
  expect(staleDataWarning("2025-S1", new Date("2027-03-01T12:00:00Z"))).not.toBeNull(); // 4 semestri
  expect(staleDataWarning("2025-S1", new Date("2026-12-31T12:00:00Z"))).toBeNull(); // 3 semestri
});

test("semestre sconosciuto o nel futuro → nessun avviso", () => {
  expect(staleDataWarning("boh", now)).toBeNull();
  expect(staleDataWarning("", now)).toBeNull();
  expect(staleDataWarning("2031-S1", now)).toBeNull();
});
