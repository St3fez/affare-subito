import type { OmiZoneShapes } from "./types";

const SCALE = 1e5;
/** Fuori da ogni zona ma entro questa distanza dal confine (sbavature della semplificazione, coordinate imprecise) vale la più vicina. */
const NEAR_METERS = 40;
const METERS_PER_DEGREE_LAT = 110540;
const METERS_PER_DEGREE_LON = 111320;

type Point = [number, number];
type Polygon = { outer: Point[]; holes: Point[][]; area: number };

const decoded = new WeakMap<OmiZoneShapes, Map<string, Array<{ code: string; polygons: Polygon[] }>>>();

function decodeRing(flat: number[]): Point[] {
  const points: Point[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    x = i === 0 ? flat[0] : x + flat[i];
    y = i === 0 ? flat[1] : y + flat[i + 1];
    points.push([x, y]);
  }
  return points;
}

/** Area col metodo dei trapezi, in unità di 1e-5 gradi al quadrato: serve solo a confrontare zone tra loro. */
function ringArea(ring: Point[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(sum) / 2;
}

function zonesOf(shapes: OmiZoneShapes, istat: string) {
  let byComune = decoded.get(shapes);
  if (!byComune) {
    byComune = new Map();
    decoded.set(shapes, byComune);
  }
  let zones = byComune.get(istat);
  if (!zones) {
    const raw = shapes.comuni[istat] ?? {};
    zones = Object.entries(raw).map(([code, polygons]) => ({
      code,
      polygons: polygons
        .filter((rings) => rings.length > 0)
        .map((rings) => {
          const outer = decodeRing(rings[0]);
          return { outer, holes: rings.slice(1).map(decodeRing), area: ringArea(outer) };
        }),
    }));
    byComune.set(istat, zones);
  }
  return zones;
}

/** Il metodo del raggio: un punto è dentro se una semiretta orizzontale incrocia il bordo un numero dispari di volte. */
function inRing(x: number, y: number, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distanza in metri dal punto al segmento, con le coordinate a 1e-5 gradi e un'approssimazione piana (basta su poche centinaia di metri). */
function distanceToSegment(px: number, py: number, a: Point, b: Point, cosLat: number): number {
  const ax = (a[0] - px) * cosLat;
  const ay = a[1] - py;
  const bx = (b[0] - px) * cosLat;
  const by = b[1] - py;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  // 1e-5 gradi di latitudine sono circa 1,1 m; la longitudine è già scalata con cosLat.
  return Math.hypot(cx * (METERS_PER_DEGREE_LON / SCALE), cy * (METERS_PER_DEGREE_LAT / SCALE));
}

function distanceToRing(px: number, py: number, ring: Point[], cosLat: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    best = Math.min(best, distanceToSegment(px, py, ring[j], ring[i], cosLat));
  }
  return best;
}

/**
 * La zona OMI in cui cade un punto, o quella più vicina se è a pochi metri dal confine. `null` se il comune non ha i confini,
 * se il punto è lontano da ogni zona, o se le coordinate non sono numeri. Con zone sovrapposte vince la più piccola.
 */
export function locateZone(
  shapes: OmiZoneShapes,
  istat: string,
  lat: number,
  lng: number
): { code: string; inside: boolean; distanceMeters: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const zones = zonesOf(shapes, istat);
  if (zones.length === 0) return null;

  const x = Math.round(lng * SCALE);
  const y = Math.round(lat * SCALE);

  let inside: { code: string; area: number } | null = null;
  for (const zone of zones) {
    for (const polygon of zone.polygons) {
      if (!inRing(x, y, polygon.outer) || polygon.holes.some((hole) => inRing(x, y, hole))) continue;
      if (!inside || polygon.area < inside.area) inside = { code: zone.code, area: polygon.area };
    }
  }
  if (inside) return { code: inside.code, inside: true, distanceMeters: 0 };

  const cosLat = Math.cos((lat * Math.PI) / 180);
  let nearest: { code: string; distance: number } | null = null;
  for (const zone of zones) {
    for (const polygon of zone.polygons) {
      const distance = Math.min(distanceToRing(x, y, polygon.outer, cosLat), ...polygon.holes.map((hole) => distanceToRing(x, y, hole, cosLat)));
      if (!nearest || distance < nearest.distance) nearest = { code: zone.code, distance };
    }
  }
  return nearest && nearest.distance <= NEAR_METERS ? { code: nearest.code, inside: false, distanceMeters: nearest.distance } : null;
}
