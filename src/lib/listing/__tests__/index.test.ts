import { manualListing, readListing } from "../index";

const immobiliare = require("../__fixtures__/immobiliare-next-data.json");

// Descrizione vera di un annuncio di immobiliare.it a Brescia (10/11/2026).
const CROCIFISSA =
  "BRESCIA CROCIFISSA DI ROSA\nQUADRILOCALE RISTRUTTURATO\nAl secondo piano servito da ascensore di una palazzina ottimamente abitata, Dinamicasa propone uno splendido QUADRILOCALE COMPLETAMENTE RISTRUTTURATO con estremo gusto e materiali di pregio. Da questo ambiente una porta conduce nella zona notte: in quest'area ci sono tre grandi camere da letto, di cui, quella padronale, munita di cabina armadio. La soluzione è servita da due bagni, entrambi con doccia e da un ulteriore balcone. Nell'interrato l'appartamento è completato da un box.";

/** L'annuncio di immobiliare.it del fixture, con le voci della scheda che si vogliono cambiare (`null` toglie la voce). */
function immobiliarePage(overrides: Record<string, unknown>) {
  const property = { ...immobiliare.props.pageProps.detailData.realEstate.properties[0] };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete property[key];
    else property[key] = value;
  }
  return JSON.stringify({
    props: { pageProps: { detailData: { realEstate: { ...immobiliare.props.pageProps.detailData.realEstate, properties: [property] } } } },
  });
}

describe("immobiliare.it: ciò che la scheda non ha si legge dalla descrizione", () => {
  const empty = { bedRoomsNumber: null, bathrooms: null, floor: null, elevator: null, garage: null, condition: null, conditionId: null };

  test("camere, bagni, piano, ascensore, box e stato vengono dal testo dell'agenzia", () => {
    const listing = readListing({ kind: "nextData", json: immobiliarePage({ ...empty, description: CROCIFISSA }) });
    expect(listing).toMatchObject({
      price: 790000,
      sqm: 200,
      rooms: 4,
      bedrooms: 3,
      bathrooms: 2,
      floor: "2",
      hasElevator: true,
      hasGarage: true,
      condition: "pronto",
    });
  });

  test("camere e bagni anche dal riepilogo della scheda ('4 (3 camere da letto, 1 altro), 2 bagni')", () => {
    const listing = readListing({
      kind: "nextData",
      json: immobiliarePage({ bedRoomsNumber: null, bathrooms: null, roomsValue: "4 (3 camere da letto, 1 altro), 2 bagni, Cucina a vista", description: "Bella casa." }),
    });
    expect(listing).toMatchObject({ bedrooms: 3, bathrooms: 2 });
  });

  test("ciò che la scheda dice con certezza non lo cambia la descrizione", () => {
    const listing = readListing({
      kind: "nextData",
      json: immobiliarePage({ bathrooms: "3", elevator: false, description: CROCIFISSA }),
    });
    expect(listing).toMatchObject({ bedrooms: 3, bathrooms: 3, hasElevator: false, floor: "interrato (-1), 2" });
  });

  test("se nemmeno la descrizione lo dice, resta vuoto", () => {
    const listing = readListing({ kind: "nextData", json: immobiliarePage({ ...empty, description: "Bella casa luminosa." }) });
    expect(listing).toMatchObject({ bedrooms: null, bathrooms: null, floor: "", hasElevator: null, hasGarage: null, condition: null });
  });

  test("conta anche 'bagni' scritto come '3+' dal portale", () => {
    const listing = readListing({ kind: "nextData", json: immobiliarePage({ bathrooms: "3+", rooms: "5+" }) });
    expect(listing).toMatchObject({ bathrooms: 3, rooms: 5 });
  });
});

test("readListing", () => {
  expect(readListing({ kind: "nextData", json: "<html>captcha</html>" })).toBeNull();
  expect(readListing({ kind: "text", text: "boh" })).toBeNull();
  expect(readListing({ kind: "text", text: "Bilocale Roma 249.000 € 48 m²" })?.price).toBe(249000);
});

test("manualListing", () => {
  const input = { price: 1, sqm: 2, city: "A", province: "B", condition: null };
  const first = manualListing(input);
  expect(first.source).toBe("manual");
  expect(manualListing(input).listingKey).toBe(first.listingKey);
  expect(manualListing({ ...input, price: 9 }).listingKey).not.toBe(first.listingKey);
});
