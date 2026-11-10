import { listingUrlFromDeepLink } from "../deepLink";

test("estrae l'indirizzo dell'annuncio dal link dell'app", () => {
  expect(listingUrlFromDeepLink("affaresubito://analizza?url=https%3A%2F%2Fwww.immobiliare.it%2Fannunci%2F1%2F")).toBe(
    "https://www.immobiliare.it/annunci/1/"
  );
});

test("l'indirizzo può avere a sua volta dei parametri", () => {
  expect(listingUrlFromDeepLink("affaresubito://analizza?url=https%3A%2F%2Fx.it%2Fa%3Fb%3D1%26c%3D2&altro=3")).toBe("https://x.it/a?b=1&c=2");
});

test("senza indirizzo o con un valore illeggibile → null", () => {
  expect(listingUrlFromDeepLink("affaresubito://analizza")).toBeNull();
  expect(listingUrlFromDeepLink("affaresubito://analizza?url=")).toBeNull();
  expect(listingUrlFromDeepLink("affaresubito://analizza?url=%E0%A4%A")).toBeNull();
  expect(listingUrlFromDeepLink("")).toBeNull();
});

test("il testo condiviso da un'altra app: l'indirizzo sta in mezzo alle parole", () => {
  const shared = "Guarda questo annuncio: https://www.immobiliare.it/annunci/123456/ su Immobiliare.it";
  expect(listingUrlFromDeepLink(`affaresubito://analizza?testo=${encodeURIComponent(shared)}`)).toBe("https://www.immobiliare.it/annunci/123456/");
});

test("testo condiviso senza indirizzo o illeggibile → null", () => {
  expect(listingUrlFromDeepLink(`affaresubito://analizza?testo=${encodeURIComponent("Guarda che bella casa")}`)).toBeNull();
  expect(listingUrlFromDeepLink("affaresubito://analizza?testo=")).toBeNull();
  expect(listingUrlFromDeepLink("affaresubito://analizza?testo=%E0%A4%A")).toBeNull();
});

test("solo indirizzi http e https", () => {
  expect(listingUrlFromDeepLink("affaresubito://analizza?url=javascript%3Aalert(1)")).toBeNull();
  expect(listingUrlFromDeepLink("affaresubito://analizza?url=file%3A%2F%2F%2Fsdcard%2Fx")).toBeNull();
});
