"use strict";
// Lo storico dei valori OMI per zona, per i grafici dell'andamento. Si passano i VALORI ufficiali di più semestri:
//   node scripts/build-omi-history.js --out src/data/omi-history.json <…_VALORI.csv> [<…_VALORI.csv> …]
// Per ogni zona dell'ultimo semestre: il valore centrale della forchetta "normale" di vendita (€/mq) e di affitto (€/mq al
// mese), semestre per semestre. La tipologia è quella dell'ultimo semestre (civili, altrimenti tipo economico), anche negli
// anni prima; le zone si seguono con il codice LinkZona, quindi una zona ridisegnata parte dal semestre in cui è nata.

const fs = require("fs");
const { readCsv, toNumber, RESIDENTIAL_TYPES } = require("./build-omi");

const semesterIndex = (semester) => {
  const [year, half] = semester.split("-S").map(Number);
  return year * 2 + (half - 1);
};
const semesterName = (index) => `${Math.floor(index / 2)}-S${(index % 2) + 1}`;

const mid = (min, max) => {
  const a = toNumber(min);
  const b = toNumber(max);
  return a !== null && b !== null ? (a + b) / 2 : null;
};
const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10);
const round0 = (value) => (value === null ? null : Math.round(value));

/** LinkZona → tipologia → { sale, rent } dello stato "normale". */
function normalValues(rows) {
  const byLink = new Map();
  for (const r of rows) {
    if (r.Stato !== "NORMALE" || !RESIDENTIAL_TYPES.includes(r.Descr_Tipologia)) continue;
    if (!byLink.has(r.LinkZona)) byLink.set(r.LinkZona, { istat: r.Comune_ISTAT, code: r.Zona, types: new Map() });
    byLink.get(r.LinkZona).types.set(r.Descr_Tipologia, { sale: mid(r.Compr_min, r.Compr_max), rent: mid(r.Loc_min, r.Loc_max) });
  }
  return byLink;
}

function buildHistory(valoriCsvs) {
  const files = valoriCsvs.map((text) => readCsv(text));
  for (const file of files) {
    if (!file.semester) throw new Error("semestre mancante: servono i file ufficiali, con la riga del semestre in cima");
  }
  const seen = new Set();
  for (const { semester } of files) {
    if (seen.has(semester)) throw new Error(`semestre ${semester} passato due volte`);
    seen.add(semester);
  }
  files.sort((a, b) => semesterIndex(a.semester) - semesterIndex(b.semester));

  const first = semesterIndex(files[0].semester);
  const last = semesterIndex(files[files.length - 1].semester);
  const semesters = [];
  for (let i = first; i <= last; i++) semesters.push(semesterName(i));

  const values = new Map(files.map((file) => [file.semester, normalValues(file.rows)]));
  const newest = values.get(files[files.length - 1].semester);

  const zones = {};
  for (const [link, zone] of newest) {
    const type = RESIDENTIAL_TYPES.find((t) => zone.types.has(t));
    const sale = [];
    const rent = [];
    for (const semester of semesters) {
      const entry = values.get(semester)?.get(link)?.types.get(type);
      sale.push(round0(entry?.sale ?? null));
      rent.push(round1(entry?.rent ?? null));
    }
    zones[`${zone.istat}|${zone.code}`] = { sale, rent };
  }
  return { semesters, zones };
}

function main(argv) {
  const outAt = argv.indexOf("--out");
  const out = outAt >= 0 ? argv[outAt + 1] : null;
  const inputs = argv.filter((_, i) => i !== outAt && i !== outAt + 1);
  if (!out || inputs.length === 0) {
    console.error("uso: node scripts/build-omi-history.js --out <json> <…_VALORI.csv> [<…_VALORI.csv> …]");
    process.exit(2);
  }
  const history = buildHistory(inputs.map((file) => fs.readFileSync(file, "utf8")));
  fs.writeFileSync(out, JSON.stringify(history));
  const size = (fs.statSync(out).size / 1048576).toFixed(2);
  console.log(`${out}: ${history.semesters[0]} → ${history.semesters[history.semesters.length - 1]}, ${Object.keys(history.zones).length} zone, ${size} MB`);
}

module.exports = { buildHistory };

if (require.main === module) main(process.argv.slice(2));
