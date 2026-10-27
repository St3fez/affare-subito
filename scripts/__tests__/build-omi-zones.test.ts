import * as fs from "fs";
import * as path from "path";

import { locateZone } from "../../src/lib/zoneLocator";

const { parseKml, simplifyRing, buildZoneShapes, selectComuni } = require("../build-omi-zones");

const placemark = (code: string, polygons: string[]) => `<Placemark>
<name>MILANO - Zona OMI ${code}</name>
<ExtendedData><Data name="LINKZONA">
<displayName>LinkZONA</displayName>
<value></value>
</Data>
<Data name="CODCOM">
<displayName>Codice Comune</displayName>
<value>F205</value>
</Data>
<Data name="CODZONA">
<displayName>Codice Zona</displayName>
<value>${code}</value>
</Data>
</ExtendedData>
<MultiGeometry>
${polygons.join("\n")}
</MultiGeometry>
</Placemark>`;

const ringText = (points: Array<[number, number]>) => [...points, points[0]].map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)},0`).join(" ");
const polygon = (outer: Array<[number, number]>, holes: Array<Array<[number, number]>> = []) =>
  `<Polygon>
<outerBoundaryIs>
<LinearRing>
<coordinates>
${ringText(outer)}
</coordinates>
</LinearRing>
</outerBoundaryIs>
${holes.map((hole) => `<innerBoundaryIs>\n<LinearRing>\n<coordinates>\n${ringText(hole)}\n</coordinates>\n</LinearRing>\n</innerBoundaryIs>`).join("\n")}
</Polygon>`;
const document = (...placemarks: string[]) => `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n<name>MILANO (MI)</name>\n${placemarks.join("\n")}\n</Document>\n</kml>`;

const square = (lon: number, lat: number, size: number): Array<[number, number]> => [
  [lon, lat],
  [lon + size, lat],
  [lon + size, lat + size],
  [lon, lat + size],
];

describe("lettura del KML", () => {
  test("codice zona e poligoni, con buchi", () => {
    const kml = document(
      placemark("B1", [polygon(square(9.0, 45.0, 0.02), [square(9.008, 45.008, 0.004)]), polygon(square(9.03, 45.0, 0.01))]),
      placemark("C1", [polygon(square(9.008, 45.008, 0.004))])
    );
    const zones = parseKml(kml);
    expect(zones.map((z: any) => z.code)).toEqual(["B1", "C1"]);
    expect(zones[0].polygons).toHaveLength(2);
    expect(zones[0].polygons[0]).toHaveLength(2); // perimetro + buco
    expect(zones[0].polygons[0][0][0]).toEqual([9.0, 45.0]);
    expect(zones[0].polygons[1]).toHaveLength(1);
  });

  test("la stessa zona in più segnaposto si unisce, e un segnaposto senza codice o senza poligoni si ignora", () => {
    const kml = document(placemark("B1", [polygon(square(9.0, 45.0, 0.01))]), placemark("B1", [polygon(square(9.05, 45.0, 0.01))]), placemark("X", []), "<Placemark><name>senza dati</name></Placemark>");
    const zones = parseKml(kml);
    expect(zones).toHaveLength(1);
    expect(zones[0].polygons).toHaveLength(2);
  });
});

describe("semplificazione", () => {
  test("i punti allineati spariscono, gli angoli restano", () => {
    const ring: Array<[number, number]> = [
      [9.0, 45.0], [9.005, 45.0], [9.01, 45.0], [9.01, 45.005], [9.01, 45.01], [9.005, 45.01], [9.0, 45.01], [9.0, 45.005], [9.0, 45.0],
    ];
    const simple = simplifyRing(ring, 10);
    expect(simple).toHaveLength(4);
    expect(simple).toEqual(expect.arrayContaining([[9.0, 45.0], [9.01, 45.0], [9.01, 45.01], [9.0, 45.01]]));
  });

  test("una piccola sbavatura entro la tolleranza sparisce, una grande resta", () => {
    // 0.00003° di latitudine sono circa 3 m; 0.001° circa 110 m.
    const small: Array<[number, number]> = [[9.0, 45.0], [9.005, 45.00003], [9.01, 45.0], [9.01, 45.01], [9.0, 45.01]];
    const large: Array<[number, number]> = [[9.0, 45.0], [9.005, 45.001], [9.01, 45.0], [9.01, 45.01], [9.0, 45.01]];
    expect(simplifyRing(small, 10)).toHaveLength(4);
    expect(simplifyRing(large, 10)).toHaveLength(5);
  });

  test("un anello che non resta un'area non resta", () => {
    expect(simplifyRing([[9.0, 45.0], [9.0001, 45.0], [9.0, 45.0]], 10).length).toBeLessThan(3);
  });
});

describe("dal KML ai confini compatti", () => {
  const kml = document(
    placemark("B1", [polygon(square(9.0, 45.0, 0.02), [square(9.008, 45.008, 0.004)])]),
    placemark("C1", [polygon(square(9.008, 45.008, 0.004))]),
    placemark("D1", [polygon(square(9.02, 45.0, 0.02)), polygon(square(9.05, 45.0, 0.00002))])
  );
  const build = (options = {}) => buildZoneShapes([{ istat: "15146", amm: "F205" }], (amm: string) => (amm === "F205" ? kml : null), { tolerance: 10, ...options });

  test("la struttura è quella attesa e le zone si ritrovano dal punto", () => {
    const shapes = build();
    expect(shapes.version).toBe(1);
    expect(Object.keys(shapes.comuni["15146"]).sort()).toEqual(["B1", "C1", "D1"]);
    expect(locateZone(shapes, "15146", 45.002, 9.002)).toMatchObject({ code: "B1", inside: true });
    expect(locateZone(shapes, "15146", 45.01, 9.01)).toMatchObject({ code: "C1", inside: true });
    expect(locateZone(shapes, "15146", 45.01, 9.03)).toMatchObject({ code: "D1", inside: true });
    expect(locateZone(shapes, "15146", 45.5, 9.5)).toBeNull();
  });

  test("i poligoni minuscoli si scartano", () => {
    expect(build().comuni["15146"].D1).toHaveLength(1);
  });

  test("di una zona fatta solo di poligoni minuscoli resta il più grande", () => {
    const tiny = document(placemark("Z1", [polygon(square(9.0, 45.0, 0.00003)), polygon(square(9.1, 45.0, 0.00002))]));
    const shapes = buildZoneShapes([{ istat: "1", amm: "A001" }], () => tiny, { tolerance: 10 });
    expect(shapes.comuni["1"].Z1).toHaveLength(1);
  });

  test("un comune senza file KML non c'è", () => {
    const shapes = buildZoneShapes([{ istat: "15146", amm: "F205" }, { istat: "9", amm: "Z999" }], (amm: string) => (amm === "F205" ? kml : null), { tolerance: 10 });
    expect(Object.keys(shapes.comuni)).toEqual(["15146"]);
  });
});

describe("quali comuni", () => {
  const valori = fs.readFileSync(path.join(__dirname, "..", "__fixtures__", "valori-official-sample.csv"), "utf8");

  test("quelli con almeno tante zone di case: codice ISTAT e codice catastale", () => {
    expect(selectComuni(valori, 4)).toEqual([{ istat: "15061018", amm: "B860", name: "CASAGIOVE", zones: 4 }]);
    expect(selectComuni(valori, 5)).toEqual([]);
  });
});
