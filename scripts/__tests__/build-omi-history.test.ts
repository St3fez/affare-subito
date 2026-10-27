import * as fs from "fs";
import * as path from "path";

const { buildHistory } = require("../build-omi-history");

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "..", "__fixtures__", name), "utf8");
const latest = fixture("valori-official-sample.csv"); // 2024/2
const older = fixture("valori-official-2021-1-sample.csv"); // 2021/1

test("i semestri vanno dal primo all'ultimo senza buchi: quelli mancanti restano vuoti", () => {
  const history = buildHistory([latest, older]);
  expect(history.semesters).toEqual(["2021-S1", "2021-S2", "2022-S1", "2022-S2", "2023-S1", "2023-S2", "2024-S1", "2024-S2"]);
  expect(history.zones["15061018|C3"].sale).toEqual([1050, null, null, null, null, null, null, 1075]);
});

test("valore centrale della forchetta: vendita in euro interi, affitto con un decimale", () => {
  const d5 = buildHistory([latest, older]).zones["15061018|D5"];
  expect(d5.sale[0]).toBe(1000);
  expect(d5.sale[7]).toBe(1050);
  expect(d5.rent[0]).toBe(3);
  expect(d5.rent[7]).toBe(3.3);
});

test("la tipologia è quella dell'ultimo semestre anche negli anni prima", () => {
  // B5 ha le abitazioni civili nel 2024: nel 2021 vale 600-900 (civili), non 400-600 (tipo economico).
  expect(buildHistory([latest, older]).zones["15061018|B5"].sale[0]).toBe(750);
  const withoutCivili = latest
    .split("\n")
    .filter((line: string) => !(line.includes(";B6;") && line.includes("Abitazioni civili")))
    .join("\n");
  expect(buildHistory([withoutCivili, older]).zones["15061018|B6"].sale[0]).toBe(500);
});

test("una zona ridisegnata (codice LinkZona diverso) non prende i valori della vecchia", () => {
  const redrawn = older.split("CE00003486").join("CE99999999");
  const d5 = buildHistory([latest, redrawn]).zones["15061018|D5"];
  expect(d5.sale[0]).toBeNull();
  expect(d5.sale[7]).toBe(1050);
});

test("file senza semestre, o lo stesso semestre due volte: errore", () => {
  expect(() => buildHistory([fixture("valori-sample.csv")])).toThrow(/semestr/i);
  expect(() => buildHistory([latest, latest])).toThrow(/semestr/i);
});
