import * as fs from "fs";
import * as path from "path";

const { buildOmi } = require("../build-omi");

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "..", "__fixtures__", name), "utf8");
const valori = fixture("valori-sample.csv");
const zone = fixture("zone-sample.csv");

const casagiove = (omi: any) => omi.comuni["CASAGIOVE|CE"];
const zoneByCode = (omi: any, code: string) => casagiove(omi).zones.find((z: any) => z.code === code);

test("struttura: un comune con le quattro zone che hanno valori", () => {
  const omi = buildOmi(valori, zone, "2018-S2");
  expect(omi.semester).toBe("2018-S2");
  expect(casagiove(omi)).toMatchObject({ istat: "15061018", name: "Casagiove", province: "CE" });
  // R2 "zona priva di apprezzamento" non ha valori e non compare.
  expect(casagiove(omi).zones.map((z: any) => z.code).sort()).toEqual(["B5", "B6", "C3", "D5"]);
});

test("descrizione della zona senza apici", () => {
  expect(zoneByCode(buildOmi(valori, zone, "2018-S2"), "C3").description).toBe("ESPANSIONE SUD-EST");
});

test("valori di vendita e di affitto, con decimali alla virgola", () => {
  const c3 = zoneByCode(buildOmi(valori, zone, "2018-S2"), "C3");
  expect(c3.sale.normale).toEqual({ min: 900, max: 1200 });
  expect(c3.sale.ottimo).toEqual({ min: 1150, max: 1750 });
  expect(c3.sale.scadente).toBeUndefined();
  expect(c3.rent.normale).toEqual({ min: 2.8, max: 4 });
  expect(c3.rent.ottimo).toEqual({ min: 3.2, max: 4.6 });
});

test("abitazioni civili battono il tipo economico, e le altre tipologie si ignorano", () => {
  const b5 = zoneByCode(buildOmi(valori, zone, "2018-S2"), "B5");
  expect(b5.sale.normale).toEqual({ min: 600, max: 900 }); // economico sarebbe 400-600
  expect(b5.sale.scadente).toEqual({ min: 400, max: 600 });
  expect(JSON.stringify(b5)).not.toMatch(/Negozi/);
});

test("senza abitazioni civili in una zona si usa il tipo economico", () => {
  const withoutCivili = valori
    .split("\n")
    .filter((line: string) => !(line.includes(",B6,") && line.includes("Abitazioni civili")))
    .join("\n");
  const b6 = zoneByCode(buildOmi(withoutCivili, zone, "2018-S2"), "B6");
  expect(b6.sale.normale).toEqual({ min: 400, max: 600 });
});

test("un valore vuoto non fa saltare lo script: manca solo quell'intervallo", () => {
  const blank = valori.replace(",P,600,900,L,", ",P,,900,L,");
  const b5 = zoneByCode(buildOmi(blank, zone, "2018-S2"), "B5");
  expect(b5.sale.normale).toBeUndefined();
  expect(b5.sale.ottimo).toEqual({ min: 900, max: 1350 });
});

test("nomi dei comuni in maiuscolo diventano leggibili, con le preposizioni minuscole", () => {
  const rename = (csv: string, to: string) => csv.split("CASAGIOVE").join(to);
  const names = ["SAN LAZZARO DI SAVENA", "SANT'OMOBONO TERME", "REGGIO NELL'EMILIA", "DI CASTELLO"].map((raw) => {
    const omi = buildOmi(rename(valori, raw), rename(zone, raw), "2018-S2");
    return omi.comuni[`${raw}|CE`].name;
  });
  expect(names).toEqual(["San Lazzaro di Savena", "Sant'Omobono Terme", "Reggio nell'Emilia", "Di Castello"]);
});

test("BOM iniziale e righe vuote finali non rompono la lettura", () => {
  const omi = buildOmi("﻿" + valori + "\n\n", zone, "2018-S2");
  expect(casagiove(omi).zones).toHaveLength(4);
});
