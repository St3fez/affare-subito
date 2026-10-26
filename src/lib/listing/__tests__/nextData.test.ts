import { conditionFromPortalLabel, parseNextData } from "../nextData";

const fx = require("../__fixtures__/immobiliare-next-data.json");

test("annuncio reale", () => {
  expect(parseNextData(JSON.stringify(fx))).toMatchObject({
    source: "nextData",
    listingKey: "immobiliare:123353645",
    contract: "sale",
    price: 790000,
    sqm: 200,
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    condition: "abitabile",
    hasElevator: true,
    hasGarage: true,
    condoMonthly: 267,
    energyClass: "A2",
    city: "Brescia",
    province: "BS",
    zone: "Loggia - Garibaldi",
    lat: 45.5378,
    lng: 10.212,
    propertyType: "appartamento",
  });
});

test("affitto", () => {
  const rent = {
    ...fx,
    props: {
      pageProps: {
        detailData: {
          realEstate: { ...fx.props.pageProps.detailData.realEstate, contract: "rent" },
        },
      },
    },
  };
  expect(parseNextData(JSON.stringify(rent))?.contract).toBe("rent");
});

test("pagina senza dati o JSON rotto → null", () => {
  expect(parseNextData('{"props":{"pageProps":{}}}')).toBeNull();
  expect(parseNextData("<html>captcha</html>")).toBeNull();
});

test.each([
  ["Nuovo / In costruzione", "pronto"],
  ["Ottimo / Ristrutturato", "pronto"],
  ["Buono / Abitabile", "abitabile"],
  ["Da ristrutturare", "da_ristrutturare"],
  ["", null],
])("stato %s", (label, expected) => expect(conditionFromPortalLabel(label)).toBe(expected));
