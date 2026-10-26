import {
  applyPurchase,
  emptyUsage,
  ENTITLEMENT_DAYS,
  FREE_ANALYSES,
  isActive,
  registerAnalysis,
  type UsageState,
} from "../entitlement";

const now = new Date("2026-11-01T10:00:00Z");

/** Registra annunci uno dopo l'altro, come farebbe l'app. */
function registerAll(keys: string[], start: UsageState = emptyUsage): UsageState {
  let state = start;
  for (const key of keys) {
    const gate = registerAnalysis(state, key, now);
    if (!gate.allowed) throw new Error(`bloccato su ${key}`);
    state = gate.state;
  }
  return state;
}

test("costanti del contributo", () => {
  expect(FREE_ANALYSES).toBe(3);
  expect(ENTITLEMENT_DAYS).toBe(365);
});

test("le prime tre analisi sono gratis, la quarta è bloccata", () => {
  let state = emptyUsage;
  for (const [key, left] of [["a", 2], ["b", 1], ["c", 0]] as const) {
    const gate = registerAnalysis(state, key, now);
    expect(gate).toMatchObject({ allowed: true, freeLeft: left });
    state = gate.state;
  }
  expect(registerAnalysis(state, "d", now)).toMatchObject({ allowed: false, reason: "paywall" });
});

test("riaprire un annuncio già analizzato non conta e non è mai bloccato", () => {
  const state = registerAll(["a", "b", "c"]);
  const again = registerAnalysis(state, "a", now);
  expect(again.allowed).toBe(true);
  expect(again.state.analyzedKeys).toHaveLength(3);
});

test("la stessa chiave due volte conta una volta sola", () => {
  const state = registerAll(["a", "a", "a"]);
  expect(state.analyzedKeys).toEqual(["a"]);
  expect(registerAnalysis(state, "b", now)).toMatchObject({ allowed: true, freeLeft: 1 });
});

test("registerAnalysis non modifica lo stato che riceve", () => {
  const state = registerAll(["a"]);
  registerAnalysis(state, "b", now);
  expect(state.analyzedKeys).toEqual(["a"]);
});

test("lo stato non cambia quando l'analisi è bloccata", () => {
  const state = registerAll(["a", "b", "c"]);
  expect(registerAnalysis(state, "d", now).state).toEqual(state);
});

test("con il contributo attivo si analizza senza limite", () => {
  const paid = applyPurchase(registerAll(["a", "b", "c"]), new Date("2027-11-01T10:00:00Z"));
  expect(isActive(paid, now)).toBe(true);
  expect(registerAnalysis(paid, "d", now).allowed).toBe(true);
  expect(registerAnalysis(paid, "e", now).allowed).toBe(true);
});

test("scaduto il contributo si torna al blocco; gli annunci già analizzati restano aperti", () => {
  const paid = applyPurchase(registerAll(["a", "b", "c"]), new Date("2027-11-01T10:00:00Z"));
  const gate = registerAnalysis(paid, "d", now);
  const afterExpiry = new Date("2027-11-02T10:00:00Z");
  expect(registerAnalysis(gate.state, "e", afterExpiry).allowed).toBe(false);
  expect(registerAnalysis(gate.state, "d", afterExpiry).allowed).toBe(true);
});

test("il giorno di scadenza esatto non è più attivo", () => {
  const state = applyPurchase(emptyUsage, now);
  expect(isActive(state, now)).toBe(false);
  expect(isActive(state, new Date(now.getTime() - 1))).toBe(true);
});

test("senza acquisto o con una data illeggibile non è attivo", () => {
  expect(isActive(emptyUsage, now)).toBe(false);
  expect(isActive({ analyzedKeys: [], activeUntil: "non una data" }, now)).toBe(false);
});

test("applyPurchase conserva gli annunci già analizzati", () => {
  const state = applyPurchase(registerAll(["a", "b"]), new Date("2027-01-01T00:00:00Z"));
  expect(state.analyzedKeys).toEqual(["a", "b"]);
  expect(state.activeUntil).toBe("2027-01-01T00:00:00.000Z");
});
