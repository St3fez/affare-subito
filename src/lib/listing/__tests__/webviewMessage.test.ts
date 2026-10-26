import { buildExtractionScript, listingFromWebViewMessage, parseWebViewMessage } from "../webviewMessage";

const fixture = require("../__fixtures__/immobiliare-next-data.json");
const nextData = JSON.stringify(fixture);

const message = (payload: object) => JSON.stringify(payload);
const longText = "Trilocale in vendita a Milano, zona Lambrate. Prezzo 340.000 €. 85 m². Da ristrutturare. ".repeat(4);

describe("parseWebViewMessage", () => {
  test("con i dati di Next.js", () => {
    expect(parseWebViewMessage(message({ url: "https://x.it/1", nextData, bodyText: "" }))).toEqual({
      kind: "nextData",
      json: nextData,
      url: "https://x.it/1",
    });
  });

  test("solo con il testo della pagina", () => {
    expect(parseWebViewMessage(message({ url: "https://x.it/1", bodyText: longText }))).toEqual({
      kind: "text",
      text: longText,
      url: "https://x.it/1",
    });
  });

  test("pagina bloccata → null, anche se contiene del testo", () => {
    expect(parseWebViewMessage(message({ blocked: true, bodyText: longText }))).toBeNull();
    expect(parseWebViewMessage(message({ blocked: true, nextData }))).toBeNull();
  });

  test("JSON rotto, né dati né testo utile → null", () => {
    expect(parseWebViewMessage("non è json")).toBeNull();
    expect(parseWebViewMessage("null")).toBeNull();
    expect(parseWebViewMessage(message({}))).toBeNull();
    expect(parseWebViewMessage(message({ nextData: "", bodyText: "poco testo" }))).toBeNull();
  });
});

describe("listingFromWebViewMessage", () => {
  test("annuncio di immobiliare.it dai dati strutturati", () => {
    const listing = listingFromWebViewMessage(message({ url: "https://www.immobiliare.it/annunci/123353645/", nextData }));
    expect(listing).toMatchObject({ source: "nextData", listingKey: "immobiliare:123353645", price: 790000 });
  });

  test("dati strutturati di un altro formato → si ripiega sul testo, con chiave dall'indirizzo", () => {
    const listing = listingFromWebViewMessage(
      message({ url: "https://www.casa.it/immobili/1/?utm=x", nextData: '{"props":{"pageProps":{"altro":1}}}', bodyText: longText })
    );
    expect(listing).toMatchObject({ source: "text", price: 340000, sqm: 85, listingKey: "url:casa.it/immobili/1" });
  });

  test("solo testo, con indirizzo: la chiave viene dall'indirizzo e non dal testo", () => {
    const a = listingFromWebViewMessage(message({ url: "https://www.idealista.it/immobile/9/", bodyText: longText }));
    const b = listingFromWebViewMessage(message({ url: "https://www.idealista.it/immobile/9/?x=1", bodyText: longText + " altro" }));
    expect(a!.listingKey).toBe("url:idealista.it/immobile/9");
    expect(b!.listingKey).toBe(a!.listingKey);
  });

  test("pagina senza un annuncio (nessun prezzo, metri quadri o comune) → null", () => {
    expect(listingFromWebViewMessage(message({ url: "https://x.it", bodyText: "Case in vendita e in affitto. ".repeat(20) }))).toBeNull();
  });

  test("pagina bloccata → null", () => {
    expect(listingFromWebViewMessage(message({ blocked: true, nextData }))).toBeNull();
  });
});

describe("buildExtractionScript", () => {
  const script = buildExtractionScript();

  test("è JavaScript valido", () => {
    expect(() => new Function(script)).not.toThrow();
  });

  test("invia il risultato all'app", () => {
    expect(script).toContain("ReactNativeWebView.postMessage");
    expect(script).toContain("__NEXT_DATA__");
  });

  test("termina con true, come richiede la WebView", () => {
    expect(script.trim().endsWith("true;")).toBe(true);
  });
});
