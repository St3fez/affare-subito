import { lookupMarket, normalizeName } from "../market";
import type { OmiData, OmiState, OmiZone, Range } from "../types";

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

test("sigla sbagliata o comune assente → null", () => {
  expect(lookupMarket(omi, { city: "Milano", province: "XX", zone: "" })).toBeNull();
  expect(lookupMarket(omi, { city: "Atlantide", province: "XX", zone: "" })).toBeNull();
  expect(lookupMarket(omi, { city: "", province: "MI", zone: "" })).toBeNull();
});
