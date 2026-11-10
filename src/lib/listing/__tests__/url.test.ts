import { canonicalListingUrl, listingUrlFromText, normalizeListingUrl } from "../url";

test("normalizeListingUrl", () => {
  expect(normalizeListingUrl("esempio.it/annuncio/1")).toBe("https://esempio.it/annuncio/1");
  expect(normalizeListingUrl("  https://www.immobiliare.it/annunci/1/ ")).toBe("https://www.immobiliare.it/annunci/1/");
  expect(normalizeListingUrl("http://esempio.it/x")).toBe("http://esempio.it/x");
  expect(normalizeListingUrl("ftp://x.it")).toBeNull();
  expect(normalizeListingUrl("")).toBeNull();
  expect(normalizeListingUrl("non un link")).toBeNull();
});

test("canonicalListingUrl toglie parametri, ancore, www e barra finale", () => {
  expect(canonicalListingUrl("https://www.idealista.it/immobile/37025092/?utm_source=x#foto")).toBe("idealista.it/immobile/37025092");
  expect(canonicalListingUrl("HTTPS://WWW.Idealista.IT/immobile/37025092")).toBe("idealista.it/immobile/37025092");
  expect(canonicalListingUrl("https://www.immobiliare.it/annunci/1/")).toBe("immobiliare.it/annunci/1");
});

test("canonicalListingUrl su un testo non valido restituisce null", () => {
  expect(canonicalListingUrl("non un link")).toBeNull();
});

describe("listingUrlFromText: l'indirizzo dentro il testo che Condividi manda", () => {
  test("scarta le parole prima e dopo l'indirizzo", () => {
    expect(listingUrlFromText("Guarda questo annuncio: https://www.immobiliare.it/annunci/123456/ su Immobiliare.it")).toBe(
      "https://www.immobiliare.it/annunci/123456/"
    );
  });

  test("l'indirizzo può stare su una riga a sé", () => {
    expect(listingUrlFromText("Ti consiglio questo annuncio\nhttps://www.idealista.it/immobile/37025092/\nScarica l'app")).toBe(
      "https://www.idealista.it/immobile/37025092/"
    );
  });

  test("toglie la punteggiatura attaccata in fondo", () => {
    expect(listingUrlFromText("Dai un'occhiata (https://www.casa.it/immobile/1/).")).toBe("https://www.casa.it/immobile/1/");
    expect(listingUrlFromText("Eccolo: https://www.casa.it/immobile/1/, bello!")).toBe("https://www.casa.it/immobile/1/");
    expect(listingUrlFromText("<https://www.casa.it/immobile/1/>")).toBe("https://www.casa.it/immobile/1/");
  });

  test("tiene parametri e ancora dell'indirizzo", () => {
    expect(listingUrlFromText("vedi https://esempio.it/a?b=1&c=2#foto ok")).toBe("https://esempio.it/a?b=1&c=2#foto");
  });

  test("se ce ne sono più d'uno vale il primo", () => {
    expect(listingUrlFromText("https://www.casa.it/immobile/1/ e anche https://www.casa.it/app")).toBe("https://www.casa.it/immobile/1/");
  });

  test("un indirizzo scritto senza https:// resta valido, se è tutto il testo", () => {
    expect(listingUrlFromText("  esempio.it/annuncio/1 ")).toBe("https://esempio.it/annuncio/1");
  });

  test("senza un indirizzo → null", () => {
    expect(listingUrlFromText("")).toBeNull();
    expect(listingUrlFromText("non un link")).toBeNull();
    expect(listingUrlFromText("Guarda questo annuncio senza link")).toBeNull();
  });

  test("solo http e https", () => {
    expect(listingUrlFromText("apri ftp://x.it/file")).toBeNull();
    expect(listingUrlFromText("file:///sdcard/x")).toBeNull();
  });
});
