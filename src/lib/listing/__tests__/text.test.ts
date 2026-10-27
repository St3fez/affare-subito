import { checkListing } from "../check";
import { textCases } from "../__fixtures__/text-cases";
import { parseListingText } from "../text";

test.each(textCases)("$label", ({ text, expected }) => {
  expect(parseListingText(text)).toMatchObject(expected);
});

test("testo pulito", () => {
  const listing = parseListingText(
    "Trilocale in vendita a Milano, zona Lambrate. Prezzo 340.000 €. 85 m². Da ristrutturare."
  );
  expect(listing).toMatchObject({ price: 340000, sqm: 85, condition: "da_ristrutturare" });
});

test("senza segnali sullo stato la condizione resta sconosciuta", () => {
  expect(parseListingText("Bilocale in vendita a Roma, 249.000 €, 48 m²").condition).toBeNull();
});

describe("contratto: vendita o affitto", () => {
  test("affitto riconosciuto dal titolo", () => {
    expect(parseListingText("Appartamento in affitto a Milano, 900 €/mese, 70 m²").contract).toBe("rent");
    expect(parseListingText("Affittasi bilocale a Roma, 800 € al mese").contract).toBe("rent");
  });

  test("affitto riconosciuto dall'indirizzo della pagina", () => {
    expect(parseListingText("Bilocale Roma 70 m²", "https://www.idealista.it/affitto-case/roma-roma/").contract).toBe("rent");
    expect(parseListingText("Bilocale Roma 70 m²", "https://www.casa.it/affitto/residenziale/roma/").contract).toBe("rent");
  });

  test("una vendita con un affitto in corso resta una vendita", () => {
    expect(parseListingText("Trilocale in vendita a Milano. Immobile attualmente locato a 500 €/mese, affitto fino al 2027.").contract).toBe("sale");
    expect(parseListingText("Vendesi appartamento, ottimo investimento da affitto").contract).toBe("sale");
  });

  test("senza indizi resta sconosciuto", () => {
    expect(parseListingText("Bilocale Roma 249.000 € 48 m²").contract).toBe("unknown");
  });

  test("un annuncio d'affitto che non indica il canone: resta un affitto, senza canone", () => {
    // L'unico importo è una cauzione: non si scambia per il canone.
    const listing = parseListingText("Appartamento in affitto a Milano, 90.000 € di cauzione, 70 m²");
    expect(listing.contract).toBe("rent");
    expect(listing.price).toBeNull();
    expect(checkListing(listing).blocking).toContain("price_missing");
  });
});

describe("falsi positivi sui testi dei portali", () => {
  test("«mezzi di superficie» non sono metri quadri", () => {
    const text = "Trilocale in vendita a Milano\n73 m²\n€ 229.000\nMezzi di superficie: Autobus di linea (84, 95, 140).";
    expect(parseListingText(text).sqm).toBe(73);
  });

  test("l'anno di ristrutturazione non dice che serve una ristrutturazione", () => {
    expect(parseListingText("Trilocale in vendita a Pontedera 95.000 €\nAnno di ristrutturazione interna: 1980").condition).toBeNull();
  });

  test("«cucina abitabile» e «cucina non abitabile» descrivono la cucina, non lo stato della casa", () => {
    expect(parseListingText("Trilocale in vendita a Roma 95.000 €. Cucina abitabile, due camere.").condition).toBeNull();
    expect(parseListingText("Trilocale in vendita a Roma 95.000 €.\nCucina non abitabile\nBagno con finestra").condition).toBeNull();
  });

  test("l'anno di ristrutturazione non cancella le etichette che seguono, anche senza a-capo", () => {
    const text = "Monolocale in affitto a Milano 740 € al mese. Anno di ristrutturazione interna: 2020 Prezzo € 740 / mese Caratteristiche: Ristrutturato Usato";
    expect(parseListingText(text).condition).toBe("pronto");
  });

  test("chi ha bisogno di lavori resta «da ristrutturare»", () => {
    expect(parseListingText("Trilocale in vendita a Roma 95.000 €. Immobile che necessita di ristrutturazione completa.").condition).toBe("da_ristrutturare");
    expect(parseListingText("Trilocale in vendita a Roma 95.000 €. Da ristrutturare.").condition).toBe("da_ristrutturare");
  });

  test.each([
    ["Le spese condominiali ammontano circa a: 250€ mensili.", 250],
    ["Spese condominiali: € 60/mese", 60],
    ["Spese condominiali 1.200 € annue", 100],
    ["Dal canone di locazione sono escluse le spese condominiali pari ad 300 mensili.", 300],
    ["Le spese ammontano a c.a 170€ mensili.", 170],
    ["Piccola palazzina senza spese condominiali.", null],
    ["Spese di condominio non indicate.", null],
  ])("spese condominiali: %s", (line, expected) => {
    expect(parseListingText(`Bilocale in vendita a Roma, 150.000 €, 60 m².\n${line}`).condoMonthly).toBe(expected);
  });

  test("affitto: il canone è l'importo al mese, non la cauzione né le spese né altri annunci", () => {
    const text = [
      "Trilocale in affitto",
      "Milano, Via Vincenzo da Filicaia - Niguarda",
      "€ 950 / mese",
      "75 Mq",
      "Cauzione 3.000 €",
      "Dal canone sono escluse le spese condominiali pari ad 300 mensili.",
      "Altri immobili in zona: 411.200 €",
    ].join("\n");
    expect(parseListingText(text).price).toBe(950);
    // Anche se la pagina non va a capo tra un blocco e l'altro.
    expect(parseListingText(text.replace(/\n/g, " ")).price).toBe(950);
  });
});
