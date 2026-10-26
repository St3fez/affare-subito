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
