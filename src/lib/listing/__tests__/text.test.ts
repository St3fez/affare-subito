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

  test("un annuncio d'affitto con un importo da vendita: resta un affitto, con un avviso sul canone", () => {
    const listing = parseListingText("Appartamento in affitto a Milano, 90.000 € di cauzione, 70 m²");
    expect(listing.contract).toBe("rent");
    expect(checkListing(listing).warnings).toContain("looks_like_sale");
  });
});
