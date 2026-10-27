import { buildExtractionScript, isBlockedMessage, listingFromWebViewMessage, parseWebViewMessage } from "../webviewMessage";

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

describe("isBlockedMessage", () => {
  test("la pagina chiede un controllo anti-robot", () => {
    expect(isBlockedMessage(message({ blocked: true, bodyText: "Verifica che sei una persona" }))).toBe(true);
  });

  test("una pagina normale, vuota o illeggibile non è bloccata", () => {
    expect(isBlockedMessage(message({ blocked: false, bodyText: longText }))).toBe(false);
    expect(isBlockedMessage(message({}))).toBe(false);
    expect(isBlockedMessage("non è json")).toBe(false);
    expect(isBlockedMessage("null")).toBe(false);
  });
});

describe("coordinate dell'annuncio", () => {
  const withCoords = (coords: unknown, payload: object = {}) => message({ url: "https://milano18.tecnocasa.it/milano/appartamenti-in-vendita-61176236", bodyText: longText, coords, ...payload });

  test("la posizione mandata dalla pagina finisce nell'annuncio", () => {
    expect(listingFromWebViewMessage(withCoords({ lat: 45.5145, lng: 9.19575 }))).toMatchObject({ lat: 45.5145, lng: 9.19575 });
  });

  test("senza posizione o con una posizione che non è in Italia, l'annuncio non ha coordinate", () => {
    for (const coords of [undefined, null, {}, { lat: 45.5 }, { lat: "45.5", lng: "9.1" }, { lat: 0, lng: 0 }, { lat: 48.85, lng: 2.35 }, { lat: 95, lng: 9.1 }, { lat: NaN, lng: 9.1 }]) {
      expect(listingFromWebViewMessage(withCoords(coords))).toMatchObject({ lat: null, lng: null });
    }
  });

  test("i dati strutturati hanno la precedenza sulla posizione della pagina", () => {
    const listing = listingFromWebViewMessage(message({ url: "https://www.immobiliare.it/annunci/123353645/", nextData, coords: { lat: 41.9, lng: 12.5 } }));
    expect(listing).toMatchObject({ lat: fixture.props.pageProps.detailData.realEstate.properties[0].location.latitude });
  });
});

describe("lo script legge la posizione dalla pagina", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const TECNOCASA_SOURCE = `<div class="map"><detail-map :latitude="45.5145" :longitude="9.19575" tecnomaps-endpoint="x"></detail-map></div>`;

  async function run({ host, ldJson = [], source, fetchFails = false }: { host: string; ldJson?: string[]; source?: string; fetchFails?: boolean }) {
    const posted: any[] = [];
    const doc = {
      readyState: "complete",
      title: "Annuncio",
      body: { innerText: longText },
      getElementById: () => null,
      querySelectorAll: (selector: string) => (selector.includes("ld+json") ? ldJson.map((textContent) => ({ textContent })) : []),
    };
    const win = { ReactNativeWebView: { postMessage: (raw: string) => posted.push(JSON.parse(raw)) } };
    const fetchMock = jest.fn(() => (fetchFails ? Promise.reject(new Error("rete")) : Promise.resolve({ text: () => Promise.resolve(source ?? "") })));
    new Function("window", "document", "location", "fetch", buildExtractionScript())(win, doc, { href: `https://${host}/annuncio/1`, hostname: host }, fetchMock);
    await jest.advanceTimersByTimeAsync(20000);
    return { posted, fetchMock };
  }

  test("tecnocasa: la posizione sta nel sorgente della pagina, non in quella già composta, e si rilegge il sorgente", async () => {
    const { posted, fetchMock } = await run({ host: "milano18.tecnocasa.it", source: TECNOCASA_SOURCE });
    expect(fetchMock).toHaveBeenCalledWith("https://milano18.tecnocasa.it/annuncio/1", expect.objectContaining({ credentials: "same-origin" }));
    expect(posted).toHaveLength(1);
    expect(posted[0].coords).toEqual({ lat: 45.5145, lng: 9.19575 });
  });

  test("tecnocasa: se il sorgente non si riesce a leggere il messaggio parte lo stesso, senza posizione", async () => {
    const { posted } = await run({ host: "www.tecnocasa.it", fetchFails: true });
    expect(posted).toHaveLength(1);
    expect(posted[0].coords).toBeNull();
    expect(posted[0].bodyText).toContain("Trilocale");
  });

  test("dati strutturati della pagina con la posizione (schema.org): si leggono senza altre richieste", async () => {
    const geo = JSON.stringify({ "@type": "Apartment", geo: { "@type": "GeoCoordinates", latitude: 45.4642, longitude: 9.19 } });
    const { posted, fetchMock } = await run({ host: "www.altro.it", ldJson: [geo] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(posted[0].coords).toEqual({ lat: 45.4642, lng: 9.19 });
  });

  test("un altro portale senza posizione non fa nessuna richiesta in più", async () => {
    const { posted, fetchMock } = await run({ host: "www.altro.it" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(posted[0].coords).toBeNull();
  });
});
