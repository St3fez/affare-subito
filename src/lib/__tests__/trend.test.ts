import { marketTrend, trendChange } from "../trend";
import type { OmiHistory } from "../types";

const history: OmiHistory = {
  semesters: ["2021-S1", "2021-S2", "2022-S1", "2022-S2"],
  zones: {
    "100|B1": { sale: [2000, 2100, null, 2400], rent: [10, 10.5, null, 12] },
    "100|C1": { sale: [1000, 1100, null, 1200], rent: [6, 6, null, 7] },
    "100|D1": { sale: [null, null, null, 800], rent: [null, null, null, 4] },
  },
};

test("una zona: la sua serie, semestre per semestre", () => {
  const trend = marketTrend(history, "100", ["B1"])!;
  expect(trend.sale).toEqual([
    { semester: "2021-S1", value: 2000 },
    { semester: "2021-S2", value: 2100 },
    { semester: "2022-S1", value: null },
    { semester: "2022-S2", value: 2400 },
  ]);
  expect(trend.rent[3]).toEqual({ semester: "2022-S2", value: 12 });
});

test("più zone: la mediana delle zone con la serie completa, così una zona nuova non crea un salto finto", () => {
  // D1 ha valori solo nell'ultimo semestre: entrando nella mediana porterebbe l'ultimo punto a 1200 invece di 1800.
  const trend = marketTrend(history, "100", ["B1", "C1", "D1"])!;
  expect(trend.sale.map((p) => p.value)).toEqual([1500, 1600, null, 1800]);
});

test("più zone, nessuna completa: la mediana di quelle che hanno un valore in quel semestre", () => {
  const patchy: OmiHistory = {
    semesters: ["2021-S1", "2021-S2", "2022-S1"],
    zones: { "1|A": { sale: [1000, null, 1200], rent: [5, null, 6] }, "1|B": { sale: [null, 2000, 2400], rent: [null, 9, 10] } },
  };
  expect(marketTrend(patchy, "1", ["A", "B"])!.sale.map((p) => p.value)).toEqual([1000, 2000, 1800]);
});

test("senza zone note, o con un solo valore, non c'è andamento", () => {
  expect(marketTrend(history, "999", ["B1"])).toBeNull();
  expect(marketTrend(history, "100", ["D1"])).toBeNull();
  expect(marketTrend(history, "100", [])).toBeNull();
});

test("variazione tra il primo e l'ultimo valore presenti", () => {
  const change = trendChange(marketTrend(history, "100", ["B1"])!.sale)!;
  expect(change.from).toEqual({ semester: "2021-S1", value: 2000 });
  expect(change.to).toEqual({ semester: "2022-S2", value: 2400 });
  expect(change.pct).toBeCloseTo(20);
  expect(change.years).toBeCloseTo(1.5);
});

test("variazione: null con meno di due valori o partendo da zero", () => {
  expect(trendChange([{ semester: "2021-S1", value: 5 }])).toBeNull();
  expect(trendChange([{ semester: "2021-S1", value: 0 }, { semester: "2021-S2", value: 5 }])).toBeNull();
});
