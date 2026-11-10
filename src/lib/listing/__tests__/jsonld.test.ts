import { readListing } from "../index";

// Dati veri di due annunci RE/MAX a Brescia (10/11/2026), ridotti ai campi che il lettore usa. RE/MAX ha un blocco JSON-LD
// "RealEstateListing" con prezzo, superficie, locali e coordinate: più sicuro del testo, dove "Immobili simili" porta altri prezzi.
const fx = require("../__fixtures__/remax-jsonld.json");

const read = (listing: unknown, url?: string) => readListing({ kind: "jsonLd", blocks: [JSON.stringify(listing)], url });

test("vendita RE/MAX: i dati vengono dal JSON-LD e le camere dalla descrizione", () => {
  expect(read(fx.sale, fx.sale.url)).toEqual({
    source: "jsonLd",
    url: fx.sale.url,
    listingKey: "url:progress.remax.it/vendita-appartamento/brescia/panoramica-porta-venezia-45401001-118",
    contract: "sale",
    title: "Appartamento in vendita a Brescia, Brescia est",
    propertyType: "appartamento",
    price: 290000,
    sqm: 160,
    rooms: 5,
    bedrooms: 2, // "2 camere da letto" nella descrizione; il campo del portale (4) è solo locali − 1
    bathrooms: 2,
    floor: "",
    condition: "abitabile", // "buono"
    hasElevator: true,
    hasGarage: true,
    condoMonthly: null,
    energyClass: "A2",
    city: "Brescia",
    province: "BS", // "addressRegion" dice "Brescia"
    zone: "",
    lat: 45.5314514,
    lng: 10.2370497,
  });
});

test("affitto RE/MAX: LeaseOut, canone, piano e camere dalla descrizione, entità HTML decodificate", () => {
  expect(read(fx.rent, fx.rent.url)).toMatchObject({
    contract: "rent",
    propertyType: "appartamento",
    price: 1200,
    sqm: 85,
    rooms: 3,
    bedrooms: 2, // "due camere matrimoniali"
    bathrooms: 1,
    floor: "1", // "al piano primo"
    hasGarage: true,
    energyClass: "G",
    city: "Brescia",
    province: "BS",
  });
});

test("senza camere nella descrizione si usa il campo del portale", () => {
  const listing = { ...fx.sale, description: "Elegante appartamento in zona servita." };
  expect(read(listing)).toMatchObject({ bedrooms: 4 });
});

test("le voci mancanti restano vuote", () => {
  const sparse = { "@type": "RealEstateListing", name: "Villa in vendita a Roma", offers: { price: 500000 }, address: { addressLocality: "Roma" } };
  expect(read(sparse)).toMatchObject({
    contract: "sale",
    propertyType: "villa",
    price: 500000,
    sqm: null,
    rooms: null,
    bathrooms: null,
    hasElevator: null,
    energyClass: "",
    lat: null,
    lng: null,
  });
});

test("il blocco può stare dentro @graph, e ce ne possono essere altri", () => {
  const blocks = [
    JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: "REMAX Italia" }),
    JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "BreadcrumbList" }, fx.sale] }),
  ];
  expect(readListing({ kind: "jsonLd", blocks, url: fx.sale.url })).toMatchObject({ price: 290000, sqm: 160 });
});

test("senza un annuncio nel JSON-LD → null", () => {
  expect(readListing({ kind: "jsonLd", blocks: [] })).toBeNull();
  expect(readListing({ kind: "jsonLd", blocks: ["non json"] })).toBeNull();
  expect(read({ "@type": "Organization", name: "REMAX" })).toBeNull();
  // Un blocco di sole immagini (come quello di Subito.it) non è un annuncio.
  expect(read({ "@type": "ImageObject", contentUrl: "https://esempio.it/a.jpg", description: "Appartamento 108 m²" })).toBeNull();
  // Senza prezzo e senza superficie non c'è nulla di utile.
  expect(read({ "@type": "RealEstateListing", name: "Casa", address: { addressLocality: "Roma" } })).toBeNull();
});
