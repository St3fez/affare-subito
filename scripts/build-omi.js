"use strict";
// Trasforma i CSV OMI (Agenzia Entrate - OMI: VALORI e ZONE) nel JSON compatto che l'app include.
//   node scripts/build-omi.js --valori <valori.csv> --zone <zone.csv> --out src/data/omi.json [--semester 2025-S2]
// Legge sia i file ufficiali (riga di intestazione col semestre, separatore ";") sia la copia di onData (virgola, senza
// semestre: va passato con --semester). Vendita in €/mq, affitto in €/mq al mese. Per ogni zona si usano le
// "Abitazioni civili"; se la zona non ne ha, le "Abitazioni di tipo economico". Le altre tipologie si ignorano.

const fs = require("fs");

const RESIDENTIAL_TYPES = ["Abitazioni civili", "Abitazioni di tipo economico"];
const STATES = { NORMALE: "normale", OTTIMO: "ottimo", SCADENTE: "scadente" };

/** CSV con campi tra virgolette (nella copia onData i decimali sono "2,8"), righe finali vuote ignorate. */
function parseCsv(text, separator = ",") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === separator) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

function toObjects(text, separator) {
  const [header, ...rest] = parseCsv(text, separator);
  return rest.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((name, i) => [name, r[i]])));
}

const firstLine = (text) => {
  const end = text.indexOf("\n");
  return (end === -1 ? text : text.slice(0, end)).replace(/\r$/, "");
};

/** File ufficiale: "Quotazioni Immobiliari : … - Semestre 2024/2 - …", poi l'intestazione con ";". Copia onData: subito l'intestazione con ",". */
function readCsv(text) {
  let source = text.replace(/^﻿/, "");
  let semester = null;
  const intro = firstLine(source);
  if (intro.startsWith("Quotazioni Immobiliari")) {
    const match = /Semestre (\d{4})\/([12])/.exec(intro);
    if (match) semester = `${match[1]}-S${match[2]}`;
    source = source.slice(source.indexOf("\n") + 1);
  }
  const separator = firstLine(source).includes(";") ? ";" : ",";
  return { semester, rows: toObjects(source, separator) };
}

function toNumber(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (text === "") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function toRange(min, max) {
  const a = toNumber(min);
  const b = toNumber(max);
  return a !== null && b !== null ? { min: a, max: b } : null;
}

const LOWERCASE_WORDS = new Set(["d", "di", "del", "della", "dei", "delle", "degli", "dello", "e", "in", "sul", "sulla", "nel", "nella", "al", "alla", "da", "a", "su", "con", "per", "dell", "nell", "all", "sull", "dall"]);

const ACCENTED = { A: "À", E: "È", I: "Ì", O: "Ò", U: "Ù" };

/** L'OMI scrive "FORLI`" e "CAPRIATA D`ORBA": l'apice inverso in fondo alla parola è un accento, davanti a una lettera un apostrofo. */
function restoreAccents(name) {
  return name.replace(/([AEIOU])`(?![\p{L}])/gu, (_, vowel) => ACCENTED[vowel]).replace(/`/g, "'");
}

/** "SAN LAZZARO DI SAVENA" → "San Lazzaro di Savena"; "REGGIO NELL'EMILIA" → "Reggio nell'Emilia"; "FORLI`" → "Forlì". */
function titleCase(name) {
  return restoreAccents(name).toLowerCase().replace(/(^|[\s'`-])(\p{L}+)/gu, (_, separator, word, offset) => {
    const connector = offset > 0 && separator === " " && LOWERCASE_WORDS.has(word);
    return separator + (connector ? word : word.charAt(0).toUpperCase() + word.slice(1));
  });
}

function buildOmi(valoriCsv, zoneCsv, semester) {
  const valori = readCsv(valoriCsv);
  const zone = readCsv(zoneCsv);
  if (valori.semester && zone.semester && valori.semester !== zone.semester) {
    throw new Error(`VALORI del semestre ${valori.semester} e ZONE del semestre ${zone.semester}: servono due file dello stesso semestre`);
  }
  const period = semester ?? valori.semester ?? zone.semester;
  if (!period) throw new Error("semestre mancante: il file non lo dichiara, passalo con --semester (es. 2025-S2)");

  const descriptions = new Map();
  for (const z of zone.rows) {
    descriptions.set(`${z.Comune_ISTAT}|${z.Zona}`, z.Zona_Descr.replace(/^'|'$/g, ""));
  }

  // comune → zona → tipologia → { sale, rent }
  const comuni = new Map();
  for (const r of valori.rows) {
    if (!RESIDENTIAL_TYPES.includes(r.Descr_Tipologia)) continue;
    const state = STATES[r.Stato];
    if (!state) continue;

    const key = `${r.Comune_descrizione}|${r.Prov}`;
    if (!comuni.has(key)) comuni.set(key, { istat: r.Comune_ISTAT, name: titleCase(r.Comune_descrizione), province: r.Prov, zones: new Map() });
    const zones = comuni.get(key).zones;
    if (!zones.has(r.Zona)) zones.set(r.Zona, new Map());
    const byType = zones.get(r.Zona);
    if (!byType.has(r.Descr_Tipologia)) byType.set(r.Descr_Tipologia, { sale: {}, rent: {} });
    const entry = byType.get(r.Descr_Tipologia);

    const sale = toRange(r.Compr_min, r.Compr_max);
    const rent = toRange(r.Loc_min, r.Loc_max);
    if (sale) entry.sale[state] = sale;
    if (rent) entry.rent[state] = rent;
  }

  const out = { semester: period, comuni: {} };
  for (const key of [...comuni.keys()].sort()) {
    const comune = comuni.get(key);
    const zones = [];
    for (const [code, byType] of comune.zones) {
      const type = RESIDENTIAL_TYPES.find((t) => {
        const e = byType.get(t);
        return e && (Object.keys(e.sale).length > 0 || Object.keys(e.rent).length > 0);
      });
      if (!type) continue;
      const { sale, rent } = byType.get(type);
      zones.push({ code, description: descriptions.get(`${comune.istat}|${code}`) ?? code, sale, rent });
    }
    if (zones.length > 0) out.comuni[key] = { istat: comune.istat, name: comune.name, province: comune.province, zones };
  }
  return out;
}

function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
  for (const required of ["valori", "zone", "out"]) {
    if (!args[required]) {
      console.error("uso: node scripts/build-omi.js --valori <csv> --zone <csv> --out <json> [--semester 2025-S2]");
      process.exit(2);
    }
  }
  const omi = buildOmi(fs.readFileSync(args.valori, "utf8"), fs.readFileSync(args.zone, "utf8"), args.semester);
  fs.writeFileSync(args.out, JSON.stringify(omi));
  const comuni = Object.keys(omi.comuni).length;
  const zones = Object.values(omi.comuni).reduce((n, c) => n + c.zones.length, 0);
  console.log(`${args.out}: ${comuni} comuni, ${zones} zone, ${(fs.statSync(args.out).size / 1048576).toFixed(2)} MB`);
}

module.exports = { buildOmi, parseCsv };

if (require.main === module) main(process.argv.slice(2));
