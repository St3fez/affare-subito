import { presentVerdict } from "../verdictView";
import type { Verdict } from "../verdict";

const verdict = (level: Verdict["level"], gapPct: number): Verdict => ({
  level,
  gapPct,
  pricePerSqm: 3000,
  reference: { min: 1800, max: 2200, mid: 2000, state: "normale" },
  label: "",
});

test("con valori recenti: titolo e tono dipendono dal livello", () => {
  expect(presentVerdict(verdict("sotto", -25), null)).toEqual({ headline: "Sotto il mercato", tone: "good", detail: "−25% rispetto al valore medio della fascia di zona" });
  expect(presentVerdict(verdict("in_linea", 9), null)).toMatchObject({ headline: "In linea con il mercato", tone: "neutral", detail: "+9% rispetto al valore medio della fascia di zona" });
  expect(presentVerdict(verdict("sopra", 57), null)).toMatchObject({ headline: "Sopra il mercato", tone: "bad" });
});

test("con valori vecchi: nessun titolo rosso o verde, il confronto è dichiarato datato", () => {
  const stale = "I valori di mercato sono del secondo semestre 2018: ...";
  const view = presentVerdict(verdict("sopra", 57), stale, "2018-S2");
  expect(view.tone).toBe("neutral");
  expect(view.headline).not.toMatch(/sopra|sotto|linea/i);
  expect(view.headline).toMatch(/2018/);
  expect(view.detail).toContain("+57%");
});
