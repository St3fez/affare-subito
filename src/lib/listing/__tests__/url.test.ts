import { canonicalListingUrl, normalizeListingUrl } from "../url";

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
