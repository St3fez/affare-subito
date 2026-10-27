import * as fs from "fs";
import * as path from "path";

import { checkListing } from "../check";
import { readPortalText } from "../portals";
import { parseListingText } from "../text";

// Porzioni reali (accorciate) delle pagine di annuncio: intestazione, riassunto, descrizione e scheda delle caratteristiche.
const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "..", "__fixtures__", "portals", `${name}.txt`), "utf8");

type Expected = Partial<{
  contract: "sale" | "rent";
  price: number;
  sqm: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  floor: string;
  propertyType: string;
  city: string;
  province: string;
  zone: string;
  condition: string | null;
  condoMonthly: number | null;
  energyClass: string;
  hasElevator: boolean;
}>;

const toscano: Array<[string, string, Expected]> = [
  [
    "toscano-rogoredo",
    "https://www.toscano.it/comune-milano/1198347-appartamento-via-rogoredo",
    { contract: "sale", price: 229000, sqm: 73, rooms: 3, bedrooms: 2, bathrooms: 1, floor: "4", propertyType: "appartamento", city: "Milano", province: "", zone: "", condition: "abitabile", condoMonthly: 250, energyClass: "C", hasElevator: true },
  ],
  [
    "toscano-brindisi",
    "https://www.toscano.it/comune-brindisi/1166572-appartamento-via-bastioni-carlo-v",
    { contract: "sale", price: 330000, sqm: 164, rooms: 6, bedrooms: 5, bathrooms: 2, floor: "7", city: "Brindisi", condition: "abitabile", condoMonthly: null, energyClass: "D", hasElevator: true },
  ],
  [
    "toscano-sale-lodi",
    "https://www.toscano.it/comune-milano/1148352-appartamento-corso-lodi-1",
    { contract: "sale", price: 890000, sqm: 130, rooms: 4, bedrooms: 3, bathrooms: 1, floor: "5", city: "Milano", condition: "abitabile", energyClass: "G" },
  ],
  [
    "toscano-sale-loft",
    "https://www.toscano.it/comune-milano/1099264-loft-via-legnone",
    { contract: "sale", price: 224000, sqm: 60, rooms: 2, bedrooms: 1, bathrooms: 1, propertyType: "loft", city: "Milano", condition: "pronto", condoMonthly: 100, energyClass: "A1", hasElevator: false },
  ],
  [
    "toscano-rent-colonna",
    "https://www.toscano.it/comune-milano/1129770-appartamento-via-vittoria-colonna",
    { contract: "rent", price: 1500, sqm: 75, rooms: 2, bedrooms: 1, floor: "3", city: "Milano", condition: "abitabile", condoMonthly: 170, energyClass: "G" },
  ],
  [
    "toscano-rent-montano",
    "https://www.toscano.it/comune-milano/1180534-appartamento-via-cola-montano",
    { contract: "rent", price: 1300, sqm: 50, rooms: 2, bedrooms: 1, floor: "2", city: "Milano", condition: "pronto", condoMonthly: 100, energyClass: "" },
  ],
  [
    "toscano-rent-ovada",
    "https://www.toscano.it/comune-milano/1221906-appartamento-via-ovada",
    { contract: "rent", price: 1200, sqm: 75, rooms: 3, bedrooms: 2, bathrooms: 2, city: "Milano", condition: "pronto", condoMonthly: 300, hasElevator: false },
  ],
];

const tecnocasa: Array<[string, string, Expected]> = [
  [
    "tecnocasa-pontedera",
    "https://pontedera1.tecnocasa.it/pontedera/appartamenti-in-vendita-61209652",
    { contract: "sale", price: 95000, sqm: 90, rooms: 3, bedrooms: 2, bathrooms: 1, floor: "1", propertyType: "trilocale", city: "Pontedera", province: "PI", zone: "Fuori Dal Ponte", condition: null, condoMonthly: null, energyClass: "G", hasElevator: false },
  ],
  [
    "tecnocasa-bassano",
    "https://bassanodelgrappa2.tecnocasa.it/bassano-del-grappa/appartamenti-in-vendita-61144278",
    // "cucina abitabile" non dice nulla sullo stato; l'etichetta "Ristrutturato" sì.
    { contract: "sale", price: 185000, sqm: 132, rooms: 4, bedrooms: 3, bathrooms: 1, floor: "Rialzato", propertyType: "quadrilocale", city: "Bassano Del Grappa", province: "VI", zone: "", condition: "pronto", condoMonthly: null, energyClass: "G", hasElevator: false },
  ],
  [
    "tecnocasa-soave",
    "https://soave1.tecnocasa.it/soave/appartamenti-in-vendita-61226759",
    { contract: "sale", price: 300000, sqm: 147, rooms: 4, bedrooms: 2, bathrooms: 2, floor: "1", city: "Soave", province: "VR", zone: "", condition: null, condoMonthly: 42, energyClass: "F" },
  ],
  [
    "tecnocasa-sale-milano1",
    "https://milano18.tecnocasa.it/milano/appartamenti-in-vendita-61176236",
    { contract: "sale", price: 375000, sqm: 116, rooms: 3, bedrooms: 2, bathrooms: 1, floor: "3", city: "Milano", province: "MI", zone: "Niguarda", condition: "abitabile", condoMonthly: 267, hasElevator: true },
  ],
  [
    "tecnocasa-rent-milano1",
    "https://milano18.tecnocasa.it/milano/appartamenti-in-affitto-61062818",
    { contract: "rent", price: 950, sqm: 75, rooms: 3, bedrooms: 2, bathrooms: 1, floor: "Basso", propertyType: "trilocale", city: "Milano", province: "MI", zone: "Niguarda", condition: "pronto", condoMonthly: 300, hasElevator: true },
  ],
  [
    "tecnocasa-rent-milano2",
    "https://milano18.tecnocasa.it/milano/appartamenti-in-affitto-61178850",
    { contract: "rent", price: 740, sqm: 30, rooms: 1, bedrooms: 1, bathrooms: 1, floor: "1", propertyType: "monolocale", city: "Milano", province: "MI", zone: "Niguarda", condition: "pronto", condoMonthly: 80, hasElevator: false },
  ],
  [
    // Il tipo può essere più lungo di una parola.
    "tecnocasa-bifamiliare-trecase",
    "https://torreannunziata1.tecnocasa.it/trecase/ville-in-vendita-61233432",
    { contract: "sale", price: 395000, sqm: 100, rooms: 4, bathrooms: 2, propertyType: "porzione di bifamiliare", city: "Trecase", province: "NA", zone: "" },
  ],
  [
    // Uffici e negozi: il tipo si legge lo stesso, così l'app dice che non è una casa.
    "tecnocasa-office-bologna",
    "https://bologna6.tecnocasa.it/bologna/ufficio-in-affitto-61198384",
    { contract: "rent", price: 1400, sqm: 90, rooms: 4, bathrooms: 1, propertyType: "ufficio", city: "Bologna", province: "BO" },
  ],
];

// La pagina vera può andare a capo in modo diverso dalla mia ricostruzione: i due formati devono dare lo stesso risultato.
const layouts: Array<[string, (text: string) => string]> = [
  ["con gli a-capo", (text) => text],
  ["senza a-capo", (text) => text.replace(/\n/g, " ")],
];

describe.each([
  ["toscano.it", toscano],
  ["tecnocasa.it", tecnocasa],
])("%s", (_portal, cases) => {
  describe.each(layouts)("%s", (_layout, layout) => {
    test.each(cases)("%s", (name, url, expected) => {
      expect(parseListingText(layout(fixture(name)), url)).toMatchObject(expected);
    });
  });
});

describe("portali non riconosciuti o pagine diverse dal previsto", () => {
  test("altri indirizzi: nessun adattatore", () => {
    expect(readPortalText(fixture("toscano-rogoredo"), "https://www.example.com/annuncio/1")).toBeNull();
    expect(readPortalText(fixture("toscano-rogoredo"))).toBeNull();
  });

  test("un portale riconosciuto ma con la pagina cambiata: si ripiega sul lettore generico, senza inventare", () => {
    const text = "Una pagina senza né riassunto né scheda.\nTrilocale in vendita a Milano, 340.000 €, 85 m².";
    expect(readPortalText(text, "https://www.toscano.it/comune-milano/1-appartamento-via-x")).toBeNull();
    expect(parseListingText(text, "https://www.toscano.it/comune-milano/1-appartamento-via-x")).toMatchObject({ price: 340000, sqm: 85 });
  });

  test("le pagine in inglese di toscano non fanno danni", () => {
    const english = "House for sale - Via Rogoredo, Milano (ref. 23/2026)\n73 m²\n3 Rooms\nProperty price\n€ 229,000";
    expect(() => parseListingText(english, "https://en.toscano.it/comune-milano/1198347-appartamento-via-rogoredo")).not.toThrow();
  });

  test("un ufficio o un negozio non è una casa, su entrambi i portali", () => {
    const office = parseListingText(fixture("tecnocasa-office-bologna"), "https://bologna6.tecnocasa.it/bologna/ufficio-in-affitto-61198384");
    expect(checkListing(office).blocking).toContain("not_residential");

    const shop = "Negozio in vendita - Via Torino, Milano (rif. 3/2026)\n40 m²\n1 Locali\n1 Bagni\nPiano Terra\nPrezzo immobile\n€ 150.000\nDescrizione\nOttima visibilità.";
    const listing = parseListingText(shop, "https://www.toscano.it/comune-milano/1234567-negozio-via-torino");
    expect(listing).toMatchObject({ propertyType: "negozio", price: 150000, sqm: 40, city: "Milano" });
    expect(checkListing(listing).blocking).toContain("not_residential");
  });

  test("l'indirizzo dell'annuncio di tecnocasa decide anche il contratto", () => {
    expect(parseListingText(fixture("tecnocasa-rent-milano1"), "https://milano18.tecnocasa.it/milano/appartamenti-in-affitto-61062818").contract).toBe("rent");
  });
});
