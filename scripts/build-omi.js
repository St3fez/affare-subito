"use strict";
// Trasforma i CSV OMI (Agenzia Entrate - OMI: VALORI e ZONE) nel JSON compatto che l'app include.
//   node scripts/build-omi.js --valori <valori.csv> --zone <zone.csv> --semester 2025-S2 --out src/data/omi.json
// Vendita in €/mq, affitto in €/mq al mese. Per ogni zona si usano le "Abitazioni civili";
// se la zona non ne ha, le "Abitazioni di tipo economico". Le altre tipologie si ignorano.

const fs = require("fs");

const RESIDENTIAL_TYPES = ["Abitazioni civili", "Abitazioni di tipo economico"];
const STATES = { NORMALE: "normale", OTTIMO: "ottimo", SCADENTE: "scadente" };

/** CSV con virgola, campi tra virgolette (i decimali sono "2,8"), righe finali vuote ignorate. */
function parseCsv(text) {
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
    } else if (ch === ",") {
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

function toObjects(text) {
  const [header, ...rest] = parseCsv(text);
  return rest.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((name, i) => [name, r[i]])));
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

function titleCase(name) {
  return name.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, separator, letter) => separator + letter.toUpperCase());
}

function buildOmi(valoriCsv, zoneCsv, semester) {
  const descriptions = new Map();
  for (const z of toObjects(zoneCsv)) {
    descriptions.set(`${z.Comune_ISTAT}|${z.Zona}`, z.Zona_Descr.replace(/^'|'$/g, ""));
  }

  // comune → zona → tipologia → { sale, rent }
  const comuni = new Map();
  for (const r of toObjects(valoriCsv)) {
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

  const out = { semester, comuni: {} };
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
  for (const required of ["valori", "zone", "semester", "out"]) {
    if (!args[required]) {
      console.error("uso: node scripts/build-omi.js --valori <csv> --zone <csv> --semester 2025-S2 --out <json>");
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
