import { locateZone } from "../zoneLocator";
import type { OmiZoneShapes } from "../types";

// Un quadrato da (9.00, 45.00) a (9.02, 45.02) con un buco, e un secondo quadrato accanto, a est.
const SCALE = 1e5;
const ring = (points: Array<[number, number]>): number[] => {
  const flat: number[] = [];
  let previous: [number, number] = [0, 0];
  points.forEach(([lon, lat], index) => {
    const x = Math.round(lon * SCALE);
    const y = Math.round(lat * SCALE);
    if (index === 0) flat.push(x, y);
    else flat.push(x - previous[0], y - previous[1]);
    previous = [x, y];
  });
  return flat;
};
const square = (lon: number, lat: number, size: number): Array<[number, number]> => [
  [lon, lat],
  [lon + size, lat],
  [lon + size, lat + size],
  [lon, lat + size],
];

const shapes: OmiZoneShapes = {
  version: 1,
  comuni: {
    "1": {
      // B1 ha un buco al centro (dove sta C1) e una seconda isola più a nord.
      B1: [[ring(square(9.0, 45.0, 0.02)), ring(square(9.008, 45.008, 0.004))], [ring(square(9.0, 45.03, 0.005))]],
      C1: [[ring(square(9.008, 45.008, 0.004))]],
      D1: [[ring(square(9.02, 45.0, 0.02))]],
    },
  },
};

test("un punto dentro una zona", () => {
  expect(locateZone(shapes, "1", 45.002, 9.002)).toMatchObject({ code: "B1", inside: true });
  expect(locateZone(shapes, "1", 45.01, 9.03)).toMatchObject({ code: "D1", inside: true });
});

test("un buco appartiene alla zona che lo riempie, non a quella che lo circonda", () => {
  expect(locateZone(shapes, "1", 45.01, 9.01)).toMatchObject({ code: "C1", inside: true });
});

test("una zona fatta di più poligoni", () => {
  expect(locateZone(shapes, "1", 45.0325, 9.0025)).toMatchObject({ code: "B1", inside: true });
});

test("fuori da tutte le zone ma a pochi metri dal confine: la zona più vicina", () => {
  // 0.0002° di latitudine sono circa 22 m a nord del bordo di B1.
  const near = locateZone(shapes, "1", 45.0202, 9.005);
  expect(near).toMatchObject({ code: "B1", inside: false });
  expect(near!.distanceMeters).toBeGreaterThan(15);
  expect(near!.distanceMeters).toBeLessThan(30);
});

test("lontano da ogni zona: nessuna", () => {
  expect(locateZone(shapes, "1", 45.1, 9.1)).toBeNull();
});

test("comune senza confini, coordinate non valide: nessuna", () => {
  expect(locateZone(shapes, "999", 45.01, 9.01)).toBeNull();
  expect(locateZone(shapes, "1", Number.NaN, 9.01)).toBeNull();
  expect(locateZone(shapes, "1", 45.01, Number.POSITIVE_INFINITY)).toBeNull();
});

test("se due zone si sovrappongono vince la più piccola", () => {
  const overlapping: OmiZoneShapes = {
    version: 1,
    comuni: { "2": { BIG: [[ring(square(9.0, 45.0, 0.02))]], SMALL: [[ring(square(9.005, 45.005, 0.004))]] } },
  };
  expect(locateZone(overlapping, "2", 45.007, 9.007)).toMatchObject({ code: "SMALL" });
  expect(locateZone(overlapping, "2", 45.001, 9.001)).toMatchObject({ code: "BIG" });
});
