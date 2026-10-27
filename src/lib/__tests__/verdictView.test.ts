import { marketSource, presentVerdict } from "../verdictView";
import type { Verdict } from "../verdict";

const verdict = (level: Verdict["level"], gapPct: number, kind: Verdict["kind"] = "sale"): Verdict => ({
  kind,
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

test("per un affitto il titolo parla di canone", () => {
  expect(presentVerdict(verdict("sotto", -20, "rent"), null)).toMatchObject({ headline: "Canone sotto il mercato", tone: "good" });
  expect(presentVerdict(verdict("sopra", 15, "rent"), null).detail).toBe("+15% rispetto al canone medio della fascia di zona");
});

test("zona non riconosciuta in un comune con più zone: confronto con la media del comune, senza rosso né verde", () => {
  const view = presentVerdict(verdict("sopra", 119, "rent"), null, "2026-S1", { precision: "comune", zoneCount: 42 });
  expect(view.tone).toBe("neutral");
  expect(view.headline).toBe("Confronto con la media del comune");
  expect(view.detail).toContain("+119%");
  expect(view.detail).toMatch(/zona/);
});

test("comune con una sola zona, o zona riconosciuta: verdetto normale", () => {
  expect(presentVerdict(verdict("sopra", 20), null, "2026-S1", { precision: "comune", zoneCount: 1 }).tone).toBe("bad");
  expect(presentVerdict(verdict("sopra", 20), null, "2026-S1", { precision: "zona", zoneCount: 1 }).tone).toBe("bad");
});

describe("fonte dei valori", () => {
  const market = { label: "zona Porta Romana, Milano", semester: "2026-S1" };

  test("senza la posizione: etichetta e semestre", () => {
    expect(marketSource(market)).toBe("zona Porta Romana, Milano · valori OMI 2026-S1");
  });

  test("zona trovata dalla posizione dell'annuncio: lo dice", () => {
    expect(marketSource({ ...market, locatedBy: "position" })).toBe("zona Porta Romana, Milano, trovata dalla posizione dell'annuncio · valori OMI 2026-S1");
  });
});
