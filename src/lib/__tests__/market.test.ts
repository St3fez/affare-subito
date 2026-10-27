import { lookupMarket, normalizeName } from "../market";
import type { OmiData, OmiState, OmiZone, OmiZoneShapes, Range } from "../types";

const zone = (
  code: string,
  description: string,
  sale: Partial<Record<OmiState, Range>>,
  rent: Partial<Record<OmiState, Range>> = {}
): OmiZone => ({ code, description, sale, rent });

const comune = (name: string, province: string, zones: OmiZone[]) => ({ istat: "0", name, province, zones });

const omi: OmiData = {
  semester: "2025-S2",
  comuni: {
    "Milano|MI": comune("Milano", "MI", [
      zone("B12", "Centro storico", { normale: { min: 6000, max: 8000 } }, { normale: { min: 15, max: 20 } }),
      zone("C1", "Lambrate", { normale: { min: 3500, max: 4500 } }, { normale: { min: 10, max: 14 } }),
      zone("D1", "Periferia", { normale: { min: 2000, max: 3000 } }, { normale: { min: 7, max: 9 } }),
      zone("B3", "Navigli", { normale: { min: 4500, max: 5500 } }, { normale: { min: 12, max: 16 } }),
    ]),
    "FORLI'|FC": comune("Forli'", "FC", [zone("B1", "Centro", { normale: { min: 1500, max: 2000 } })]),
    "SANT'OMOBONO TERME|BG": comune("Sant'Omobono Terme", "BG", [zone("B1", "Centro", { normale: { min: 900, max: 1300 } })]),
    "Samone|TO": comune("Samone", "TO", [zone("B1", "Centro", { normale: { min: 800, max: 1000 } })]),
    "Samone|TN": comune("Samone", "TN", [zone("B1", "Centro", { normale: { min: 1800, max: 2200 } })]),
    "Tieville|TV": comune("Tieville", "TV", [
      zone("B1", "Centro nord", { normale: { min: 1000, max: 2000 } }),
      zone("B2", "Centro sud", { normale: { min: 3000, max: 4000 } }),
      zone("D1", "Periferia", { normale: { min: 500, max: 900 }, scadente: { min: 400, max: 600 } }),
    ]),
  },
};

test("normalizeName", () => {
  expect(normalizeName("Forlì")).toBe("forli");
  expect(normalizeName("FORLI'")).toBe("forli");
  expect(normalizeName("FORLI`")).toBe("forli"); // come compare nei dati OMI reali
  expect(normalizeName("  Sant’Omobono   Terme ")).toBe("santomobono terme");
  expect(normalizeName("Loggia - Garibaldi")).toBe("loggia garibaldi");
});

test("zona trovata", () => {
  const m = lookupMarket(omi, { city: "Milano", province: "MI", zone: "Lambrate" });
  expect(m).toMatchObject({ precision: "zona", sale: { normale: { min: 3500, max: 4500 } }, semester: "2025-S2" });
  expect(m!.label).toContain("Lambrate");
});

test("senza zona → mediana del comune, per vendita e affitto", () => {
  const m = lookupMarket(omi, { city: "Milano", province: "MI", zone: "" });
  expect(m).toMatchObject({
    precision: "comune",
    sale: { normale: { min: 4000, max: 5000 } },
    rent: { normale: { min: 11, max: 15 } },
  });
  expect(m!.label).toBe("comune di Milano");
});

test("zona sconosciuta → comune", () =>
  expect(lookupMarket(omi, { city: "Milano", province: "MI", zone: "Zona Inesistente" })?.precision).toBe("comune"));

test("parole generiche non bastano per abbinare una zona", () =>
  expect(lookupMarket(omi, { city: "Milano", province: "MI", zone: "Zona via" })?.precision).toBe("comune"));

test("dice quali zone ha usato e di quale comune, per ritrovarne l'andamento", () => {
  expect(lookupMarket(omi, { city: "Milano", province: "MI", zone: "Lambrate" })).toMatchObject({ istat: "0", zoneCodes: ["C1"] });
  expect(lookupMarket(omi, { city: "Milano", province: "MI", zone: "" })!.zoneCodes).toEqual(["B12", "C1", "D1", "B3"]);
});

test("una zona che corrisponde a più voci → mediana di quelle voci", () => {
  const m = lookupMarket(omi, { city: "Tieville", province: "TV", zone: "Centro" });
  expect(m).toMatchObject({ precision: "zona", sale: { normale: { min: 2000, max: 3000 } } });
});

test("gli stati presenti solo in alcune zone restano disponibili a livello di comune", () =>
  expect(lookupMarket(omi, { city: "Tieville", province: "TV", zone: "" })!.sale.scadente).toEqual({ min: 400, max: 600 }));

test("accenti, apostrofi e maiuscole", () => {
  expect(lookupMarket(omi, { city: "FORLÌ", province: "fc", zone: "" })).not.toBeNull();
  expect(lookupMarket(omi, { city: "Sant’Omobono Terme", province: "BG", zone: "" })).not.toBeNull();
});

test("senza sigla vale il nome solo se è univoco", () => {
  expect(lookupMarket(omi, { city: "Forlì", province: "", zone: "" })).not.toBeNull();
  expect(lookupMarket(omi, { city: "Samone", province: "", zone: "" })).toBeNull();
  expect(lookupMarket(omi, { city: "Samone", province: "TN", zone: "" })!.sale.normale).toEqual({ min: 1800, max: 2200 });
});

describe("zona dalla posizione dell'annuncio", () => {
  const SCALE = 1e5;
  const square = (lon: number, lat: number, size: number): number[] => {
    const x = Math.round(lon * SCALE);
    const y = Math.round(lat * SCALE);
    const s = Math.round(size * SCALE);
    return [x, y, s, 0, 0, s, -s, 0]; // (x,y) → est → nord → ovest, a differenze
  };
  // Nel comune "0" di prova: Lambrate (C1) sta a ovest, Periferia (D1) a est, e B12 ha un solo punto di riferimento senza valori.
  const shapes: OmiZoneShapes = {
    version: 1,
    comuni: { "0": { C1: [[square(9.2, 45.4, 0.01)]], D1: [[square(9.22, 45.4, 0.01)]], R2: [[square(9.24, 45.4, 0.01)]] } },
  };
  const at = (lat: number, lng: number) => ({ city: "Milano", province: "MI", zone: "", point: { lat, lng } });

  test("la zona viene dai confini, anche se il testo non la nomina", () => {
    const m = lookupMarket(omi, { ...at(45.405, 9.225), zone: "Quartiere inventato" }, shapes)!;
    expect(m).toMatchObject({ precision: "zona", locatedBy: "position", zoneCodes: ["D1"], sale: { normale: { min: 2000, max: 3000 } } });
    expect(m.label).toBe("zona Periferia, Milano");
  });

  test("la posizione vale più del nome: l'annuncio dice Lambrate ma cade in periferia", () => {
    expect(lookupMarket(omi, { ...at(45.405, 9.225), zone: "Lambrate" }, shapes)).toMatchObject({ zoneCodes: ["D1"], locatedBy: "position" });
  });

  test("senza posizione, o senza confini del comune, si ripiega sul nome", () => {
    for (const m of [
      lookupMarket(omi, { city: "Milano", province: "MI", zone: "Lambrate" }, shapes)!,
      lookupMarket(omi, { ...at(45.405, 9.225), zone: "Lambrate" }, null)!,
      lookupMarket(omi, { ...at(45.405, 9.225), zone: "Lambrate" })!,
    ]) {
      expect(m.zoneCodes).toEqual(["C1"]);
      expect(m.locatedBy).toBeUndefined();
    }
  });

  test("posizione fuori da ogni zona: si ripiega sul nome o sul comune", () => {
    const byName = lookupMarket(omi, { ...at(46.0, 10.0), zone: "Lambrate" }, shapes)!;
    expect(byName.zoneCodes).toEqual(["C1"]);
    expect(byName.locatedBy).toBeUndefined();
    const byComune = lookupMarket(omi, at(46.0, 10.0), shapes)!;
    expect(byComune.precision).toBe("comune");
    expect(byComune.locatedBy).toBeUndefined();
  });

  test("zona dei confini che non ha valori di case: si ripiega, senza prendere quelli di una zona vicina", () => {
    const m = lookupMarket(omi, at(45.405, 9.245), shapes)!;
    expect(m.locatedBy).toBeUndefined();
    expect(m.precision).toBe("comune");
  });
});

// L'OMI usa le province catastali, precedenti a quelle nuove: Monza sta sotto MI, Forlì è "FO", la Sardegna ha solo CA, SS, NU, OR.
const catastali: OmiData = {
  semester: "2024-S2",
  comuni: Object.fromEntries(
    [
      ["Monza", "MI"],
      ["Forli`", "FO"],
      ["Pesaro", "PS"],
      ["Fermo", "AP"],
      ["Barletta", "BA"],
      ["Margherita di Savoia", "FG"],
      ["Olbia", "SS"],
      ["Carbonia", "CA"],
      ["Tortoli`", "NU"],
      ["Samone", "TO"],
      ["Samone", "TN"],
    ].map(([name, province]) => [`${name}|${province}`, comune(name, province, [zone("B1", "Centro", { normale: { min: 1000, max: 1500 } })])])
  ),
};

test("le sigle delle province nuove trovano la provincia catastale dell'OMI", () => {
  const found = (city: string, province: string) => lookupMarket(catastali, { city, province, zone: "" })?.label;
  expect(found("Monza", "MB")).toBe("comune di Monza");
  expect(found("Forlì", "FC")).toBe("comune di Forli`");
  expect(found("Pesaro", "PU")).toBe("comune di Pesaro");
  expect(found("Fermo", "FM")).toBe("comune di Fermo");
  expect(found("Barletta", "BT")).toBe("comune di Barletta");
  expect(found("Margherita di Savoia", "BT")).toBe("comune di Margherita di Savoia");
  expect(found("Olbia", "OT")).toBe("comune di Olbia");
  expect(found("Carbonia", "SU")).toBe("comune di Carbonia");
  expect(found("Tortolì", "OG")).toBe("comune di Tortoli`");
});

test("la sigla nuova non apre la porta a un comune omonimo di un'altra provincia", () => {
  expect(lookupMarket(catastali, { city: "Samone", province: "MB", zone: "" })).toBeNull();
});

test("sigla sbagliata o comune assente → null", () => {
  expect(lookupMarket(omi, { city: "Milano", province: "XX", zone: "" })).toBeNull();
  expect(lookupMarket(omi, { city: "Atlantide", province: "XX", zone: "" })).toBeNull();
  expect(lookupMarket(omi, { city: "", province: "MI", zone: "" })).toBeNull();
});
