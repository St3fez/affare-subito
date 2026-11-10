import { readListing } from "../index";
import { listingFromWebViewMessage } from "../webviewMessage";

// Dati veri di annunci di casa.it a Brescia (10/11/2026), ridotti ai campi che il lettore usa.
const fx = require("../__fixtures__/casa-pdp.json");

const page = (pdp: unknown) => JSON.stringify({ props: { pageProps: { pdp } } });
const parseNextData = (json: string, url?: string) => readListing({ kind: "nextData", json, url });

test("vendita: tutti i dati vengono dalla scheda strutturata", () => {
  expect(parseNextData(page(fx.sale), "https://www.casa.it/immobili/55176836/")).toEqual({
    source: "nextData",
    url: "https://www.casa.it/immobili/55176836/",
    listingKey: "casa:55176836",
    contract: "sale",
    title: "Trilocale in Vendita in Via Leonida Bissolati 15 a Brescia",
    propertyType: "appartamento",
    price: 139000,
    sqm: 80,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    floor: "4",
    condition: "abitabile",
    hasElevator: true,
    hasGarage: true,
    condoMonthly: 200,
    energyClass: "", // "In fase di richiesta": non è una classe
    city: "Brescia",
    province: "BS",
    zone: "San Polo Parco",
    lat: 45.52011,
    lng: 10.231818,
  });
});

test("affitto: il canone è il prezzo, le spese condominiali al mese", () => {
  expect(parseNextData(page(fx.rent))).toMatchObject({
    contract: "rent",
    price: 660,
    sqm: 40,
    rooms: 1,
    bedrooms: 0,
    bathrooms: 1,
    floor: "piano terra",
    condition: "pronto", // "ristrutturato"
    hasElevator: true,
    condoMonthly: 50,
    energyClass: "A1",
    zone: "Porta Venezia, Panoramica", // senza quartiere vale la zona
  });
});

test("villa all'asta: il tipo viene dalla scheda, il box dalla descrizione, l'ascensore resta ignoto", () => {
  expect(parseNextData(page(fx.auctionVilla))).toMatchObject({
    propertyType: "villa",
    price: 85485,
    sqm: 120,
    rooms: 5,
    bathrooms: 1,
    floor: "piano terra",
    hasElevator: null,
    hasGarage: true,
    energyClass: "G",
    zone: "Villaggio Sereno",
  });
});

test("nuova costruzione con forchetta di prezzo: i dati che non ci sono restano vuoti, non si inventano", () => {
  expect(parseNextData(page(fx.newBuild))).toMatchObject({
    propertyType: "nuova costruzione",
    price: null,
    sqm: null,
    rooms: null,
    bathrooms: null,
    floor: "",
    condition: "pronto", // "nuovo"
    hasElevator: false,
    energyClass: "A4",
    city: "Roncadelle",
    province: "BS",
    zone: "",
  });
});

test("senza scheda o senza identificativo → null", () => {
  expect(parseNextData(page({}))).toBeNull();
  expect(parseNextData(page(null))).toBeNull();
  expect(parseNextData(page({ ...fx.sale, id: undefined }))).toBeNull();
});

test("dal messaggio della pagina: la scheda vince sul testo, che comincia con il banner dei cookie", () => {
  const cookieWall =
    "Continua senza accettare →\nIn Casa.it utilizziamo cookie e tecnologie simili, nostri e di terze parti (vedi i nostri 14 fornitori), per offrirti un'esperienza personalizzata. ".repeat(3);
  const message = JSON.stringify({ url: "https://www.casa.it/immobili/55176836/", nextData: page(fx.sale), bodyText: cookieWall, blocked: false, coords: null });
  expect(listingFromWebViewMessage(message)).toMatchObject({ listingKey: "casa:55176836", price: 139000, sqm: 80, city: "Brescia", lat: 45.52011 });
});
