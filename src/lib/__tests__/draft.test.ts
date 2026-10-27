import { applyDraft, describeIssue, describeListing, draftFromListing, type ListingDraft } from "../draft";
import { emptyManualListing } from "../listing";
import type { Issue, ListingData } from "../types";

const listing: ListingData = {
  source: "nextData",
  listingKey: "immobiliare:1",
  contract: "sale",
  title: "Quadrilocale",
  propertyType: "appartamento",
  price: 790000,
  sqm: 200,
  rooms: 4,
  bedrooms: 3,
  bathrooms: 2,
  floor: "2",
  condition: "abitabile",
  hasElevator: true,
  hasGarage: true,
  condoMonthly: 267,
  energyClass: "A2",
  city: "Brescia",
  province: "BS",
  zone: "Loggia - Garibaldi",
  lat: 45.5,
  lng: 10.2,
};

const draft: ListingDraft = {
  price: "790000",
  sqm: "200",
  bedrooms: "3",
  bathrooms: "2",
  city: "Brescia",
  province: "BS",
  zone: "Loggia - Garibaldi",
  condition: "abitabile",
  contract: "sale",
};

test("annuncio → campi di testo", () => {
  expect(draftFromListing(listing)).toEqual(draft);
});

test("dati mancanti → campi vuoti", () => {
  expect(draftFromListing(emptyManualListing("x"))).toEqual({
    price: "",
    sqm: "",
    bedrooms: "",
    bathrooms: "",
    city: "",
    province: "",
    zone: "",
    condition: null,
    contract: "sale",
  });
});

test("campi di testo → annuncio, con i formati italiani", () => {
  const next = applyDraft(listing, { ...draft, price: " 340.000 ", sqm: "85,5", bedrooms: "2", bathrooms: "1" });
  expect(next).toMatchObject({ price: 340000, sqm: 85.5, bedrooms: 2, bathrooms: 1 });
});

test("i campi che non si modificano restano com'erano", () => {
  const next = applyDraft(listing, { ...draft, price: "700000" });
  expect(next).toMatchObject({
    listingKey: "immobiliare:1",
    source: "nextData",
    rooms: 4,
    condoMonthly: 267,
    floor: "2",
    hasElevator: true,
    energyClass: "A2",
    lat: 45.5,
    title: "Quadrilocale",
  });
});

test("vuoto, testo o valori non positivi → null per prezzo e metri quadri", () => {
  const next = applyDraft(listing, { ...draft, price: "", sqm: "abc" });
  expect(next.price).toBeNull();
  expect(next.sqm).toBeNull();
  expect(applyDraft(listing, { ...draft, price: "-5", sqm: "0" })).toMatchObject({ price: null, sqm: null });
});

test("zero camere è un valore valido (monolocale), il negativo no", () => {
  expect(applyDraft(listing, { ...draft, bedrooms: "0" }).bedrooms).toBe(0);
  expect(applyDraft(listing, { ...draft, bedrooms: "-1", bathrooms: "" })).toMatchObject({ bedrooms: null, bathrooms: null });
});

test("comune, sigla e zona vengono ripuliti", () => {
  const next = applyDraft(listing, { ...draft, city: "  Milano ", province: " mi ", zone: " Lambrate  ", condition: null });
  expect(next).toMatchObject({ city: "Milano", province: "MI", zone: "Lambrate", condition: null });
});

test("riassunto dell'annuncio", () => {
  expect(describeListing(listing)).toMatch(/^Appartamento · 200 m² · Loggia - Garibaldi, Brescia · 790\.000\s€$/);
  expect(describeListing({ ...listing, price: null, zone: "", sqm: 80, city: "Milano" })).toBe("Appartamento · 80 m² · Milano");
  expect(describeListing(emptyManualListing("x"))).toBe("Nessun dato ancora");
});

test("ogni problema ha una spiegazione in italiano", () => {
  const issues: Issue[] = [
    "not_a_sale",
    "not_a_rent",
    "not_residential",
    "price_missing",
    "sqm_missing",
    "city_missing",
    "sqm_implausible",
    "looks_like_sale",
    "looks_like_rent",
  ];
  for (const issue of issues) expect(describeIssue(issue).length).toBeGreaterThan(10);
});

test("annuncio vuoto per l'inserimento a mano", () => {
  expect(emptyManualListing("abc")).toMatchObject({
    source: "manual",
    listingKey: "manual:abc",
    contract: "sale",
    price: null,
    sqm: null,
    city: "",
    condition: null,
  });
});

test("vendita o affitto: si legge dall'annuncio e si può cambiare", () => {
  expect(draftFromListing({ ...listing, contract: "rent" }).contract).toBe("rent");
  expect(draftFromListing({ ...listing, contract: "unknown" }).contract).toBe("sale");
  expect(applyDraft(listing, { ...draft, contract: "rent" }).contract).toBe("rent");
});

test("nel riassunto di un affitto il canone è al mese", () => {
  expect(describeListing({ ...listing, contract: "rent", price: 900 })).toMatch(/· 900\s€ al mese$/);
});
