"use strict";
// I confini delle zone OMI delle città con più zone, in forma compatta, per trovare la zona dalla posizione di un annuncio.
//   node scripts/build-omi-zones.js --valori <…_VALORI.csv> --kml-dir <cartella dei KML> --out src/data/omi-zones.json
//                                   [--min-zones 6] [--tolerance 12]
// I KML sono nel download "Perimetri" dell'Agenzia delle Entrate (un file per comune, chiamato col codice catastale). Il file dei
// valori dice, per ogni comune, il codice catastale (Comune_amm), l'ISTAT e quante zone hanno valori di case.
// Formato dell'uscita: vedi `OmiZoneShapes` in src/lib/types.ts.

const fs = require("fs");
const path = require("path");
const { readCsv, toNumber, RESIDENTIAL_TYPES } = require("./build-omi");

const SCALE = 1e5;
const METERS_PER_DEGREE_LAT = 110540;
const METERS_PER_DEGREE_LON = 111320;
const MIN_POLYGON_M2 = 2000; // sotto questa area un poligono è una sbavatura del disegno (salvo sia l'unico della zona)
const MIN_HOLE_M2 = 500;
const STATES = ["NORMALE", "OTTIMO", "SCADENTE"];

function parseCoordinates(text) {
  const points = [];
  for (const token of text.trim().split(/\s+/)) {
    const [lon, lat] = token.split(",").map(Number);
    if (Number.isFinite(lon) && Number.isFinite(lat)) points.push([lon, lat]);
  }
  return points;
}

/** Le zone di un KML: codice e poligoni, ciascuno con il perimetro e poi gli eventuali buchi. La stessa zona in più segnaposto si unisce. */
function parseKml(text) {
  const byCode = new Map();
  for (const placemark of text.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || []) {
    const code = ((/<Data name="CODZONA">[\s\S]*?<value>([^<]*)<\/value>/.exec(placemark) || [])[1] || "").trim();
    if (!code) continue;
    for (const polygon of placemark.match(/<Polygon>[\s\S]*?<\/Polygon>/g) || []) {
      // Nel KML il perimetro (outerBoundaryIs) viene prima dei buchi (innerBoundaryIs).
      const rings = [...polygon.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)].map((m) => parseCoordinates(m[1])).filter((ring) => ring.length >= 4);
      if (rings.length === 0) continue;
      if (!byCode.has(code)) byCode.set(code, { code, polygons: [] });
      byCode.get(code).polygons.push(rings);
    }
  }
  return [...byCode.values()];
}

function openRing(points) {
  const first = points[0];
  const last = points[points.length - 1];
  return points.length > 1 && first[0] === last[0] && first[1] === last[1] ? points.slice(0, -1) : points;
}

function toMeters(points) {
  const cosLat = Math.cos((points[0][1] * Math.PI) / 180);
  return points.map(([lon, lat]) => [lon * METERS_PER_DEGREE_LON * cosLat, lat * METERS_PER_DEGREE_LAT]);
}

function ringAreaM2(points) {
  const ring = toMeters(openRing(points));
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(sum) / 2;
}

function distanceToLine(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / length;
}

/** Douglas–Peucker senza ricorsione: quali punti di una linea tenere perché nessun altro disti più di `tolerance` metri. */
function keepFlags(points, tolerance) {
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [from, to] = stack.pop();
    let farthest = -1;
    let max = tolerance;
    for (let i = from + 1; i < to; i++) {
      const distance = distanceToLine(points[i], points[from], points[to]);
      if (distance > max) {
        max = distance;
        farthest = i;
      }
    }
    if (farthest >= 0) {
      keep[farthest] = true;
      stack.push([from, farthest], [farthest, to]);
    }
  }
  return keep;
}

/** Toglie i punti che servono meno di `toleranceMeters` metri. L'anello esce aperto (senza ripetere il primo punto). */
function simplifyRing(points, toleranceMeters) {
  const ring = openRing(points);
  if (ring.length <= 3) return ring;

  // Un anello si divide in due linee, dal primo punto al più lontano e da questo di nuovo al primo.
  const metric = toMeters(ring);
  let far = 0;
  let best = -1;
  for (let i = 1; i < metric.length; i++) {
    const distance = Math.hypot(metric[i][0] - metric[0][0], metric[i][1] - metric[0][1]);
    if (distance > best) {
      best = distance;
      far = i;
    }
  }
  const firstHalf = keepFlags(metric.slice(0, far + 1), toleranceMeters);
  const secondHalf = keepFlags([...metric.slice(far), metric[0]], toleranceMeters);
  const kept = [];
  for (let i = 0; i <= far; i++) if (firstHalf[i]) kept.push(ring[i]);
  for (let i = 1; i < secondHalf.length - 1; i++) if (secondHalf[i]) kept.push(ring[far + i]);
  return kept;
}

/** Interi in 1e-5 gradi: il primo punto e poi le differenze, calcolate sui valori già arrotondati così non si accumula errore. */
function encodeRing(points) {
  const flat = [];
  let previous = [0, 0];
  points.forEach(([lon, lat], index) => {
    const x = Math.round(lon * SCALE);
    const y = Math.round(lat * SCALE);
    flat.push(index === 0 ? x : x - previous[0], index === 0 ? y : y - previous[1]);
    previous = [x, y];
  });
  return flat;
}

/** Un anello semplificato; se la semplificazione lo schiaccia (poligono minuscolo) si tiene quello originale. */
function compactRing(points, tolerance) {
  const simple = simplifyRing(points, tolerance);
  return simple.length >= 3 ? simple : openRing(points);
}

function encodePolygon(rings, tolerance) {
  const outer = compactRing(rings[0], tolerance);
  if (outer.length < 3) return null;
  const holes = rings
    .slice(1)
    .filter((hole) => ringAreaM2(hole) >= MIN_HOLE_M2)
    .map((hole) => compactRing(hole, tolerance))
    .filter((hole) => hole.length >= 3);
  return [encodeRing(outer), ...holes.map(encodeRing)];
}

/** `comuni`: [{ istat, amm }]; `readKml(amm)`: il testo del KML del comune o null. */
function buildZoneShapes(comuni, readKml, options = {}) {
  const tolerance = options.tolerance ?? 12;
  const shapes = { version: 1, comuni: {} };
  for (const { istat, amm } of comuni) {
    const kml = readKml(amm);
    if (!kml) continue;
    const zones = {};
    for (const zone of parseKml(kml)) {
      const polygons = zone.polygons.map((rings) => ({ rings, area: ringAreaM2(rings[0]) }));
      const largest = Math.max(...polygons.map((polygon) => polygon.area));
      const encoded = polygons
        .filter((polygon) => polygon.area >= MIN_POLYGON_M2 || polygon.area === largest)
        .map((polygon) => encodePolygon(polygon.rings, tolerance))
        .filter(Boolean);
      if (encoded.length > 0) zones[zone.code] = encoded;
    }
    if (Object.keys(zones).length > 0) shapes.comuni[istat] = zones;
  }
  return shapes;
}

/** I comuni con almeno `minZones` zone con valori di case: ISTAT, codice catastale (nome dei file KML), nome e numero di zone. */
function selectComuni(valoriCsv, minZones) {
  const comuni = new Map();
  for (const r of readCsv(valoriCsv).rows) {
    if (!RESIDENTIAL_TYPES.includes(r.Descr_Tipologia) || !STATES.includes(r.Stato)) continue;
    const hasValues = [r.Compr_min, r.Compr_max, r.Loc_min, r.Loc_max].some((value) => toNumber(value) !== null);
    if (!hasValues) continue;
    if (!comuni.has(r.Comune_amm)) comuni.set(r.Comune_amm, { istat: r.Comune_ISTAT, amm: r.Comune_amm, name: r.Comune_descrizione, zoneCodes: new Set() });
    comuni.get(r.Comune_amm).zoneCodes.add(r.Zona);
  }
  return [...comuni.values()]
    .filter((comune) => comune.zoneCodes.size >= minZones)
    .map((comune) => ({ istat: comune.istat, amm: comune.amm, name: comune.name, zones: comune.zoneCodes.size }));
}

function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
  for (const required of ["valori", "kml-dir", "out"]) {
    if (!args[required]) {
      console.error("uso: node scripts/build-omi-zones.js --valori <…_VALORI.csv> --kml-dir <cartella> --out <json> [--min-zones 6] [--tolerance 12]");
      process.exit(2);
    }
  }
  const minZones = Number(args["min-zones"] ?? 6);
  const comuni = selectComuni(fs.readFileSync(args.valori, "utf8"), minZones);
  const shapes = buildZoneShapes(
    comuni,
    (amm) => {
      const file = path.join(args["kml-dir"], `${amm}.kml`);
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    },
    { tolerance: Number(args.tolerance ?? 12) }
  );
  fs.writeFileSync(args.out, JSON.stringify(shapes));

  const built = Object.values(shapes.comuni);
  const zones = built.reduce((n, c) => n + Object.keys(c).length, 0);
  console.log(
    `${args.out}: ${built.length} comuni su ${comuni.length} con almeno ${minZones} zone, ${zones} zone, ${(fs.statSync(args.out).size / 1048576).toFixed(2)} MB`
  );
  const missing = comuni.filter((comune) => !shapes.comuni[comune.istat]);
  if (missing.length > 0) console.log(`senza confini: ${missing.map((c) => c.name).join(", ")}`);
}

module.exports = { parseKml, simplifyRing, encodeRing, buildZoneShapes, selectComuni };

if (require.main === module) main(process.argv.slice(2));
