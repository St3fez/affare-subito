import { parseListingText } from "../text";

// Testo della pagina di un annuncio di Subito.it a Brescia, come lo passa la WebView dell'app (telefono, 10/11/2026), nelle parti
// che contano. Subito non ha un lettore suo: passa dal lettore generico del testo. Il menu "Ricerche" ha righe con "provincia"
// e la navigazione ha "Brescia (Prov)": da lì il lettore generico ricavava provincia e zona sbagliate.
const SUBITO = [
  "Continua senza accettare →",
  "Vedi i nostri 144 partner",
  "Personalizza",
  "Accetta",
  "Ricerche",
  "offerte lavoro brescia Brescia provincia",
  "m3 auto Brescia provincia",
  "vendita locali Adro",
  "bmw 3 a brescia e provincia",
  "affitto locali Lovere",
  "a3 Brescia provincia",
  "affitto appartamenti desenzano Brescia provincia",
  "Torna alla ricerca",
  "Subito",
  "Appartamenti",
  "Lombardia",
  "Brescia (Prov)",
  "Brescia",
  "1/26",
  "APPARTAMENTI",
  "Oggi alle 10:44",
  "0",
  "ID: 667801512",
  "Appartamento di 108 m² con 3 locali a Brescia",
  "",
  "Brescia (BS)",
  "",
  "168.000 €",
  "",
  "Simulazione mutuo",
  "Calcola la tua assicurazione casa",
  "AGENZIA VERIFICATA",
  "Simone Marchina Immobiliare",
  "",
  "Dati principali",
  "",
  "108 mq",
  "",
  "3 Locali",
  "",
  "- (Piano)",
  "",
  "1 Bagno",
  "",
  "Descrizione",
  "",
  "Rif: (134565569) - BRESCIA - VIA VANTINI - TRILOCALE COMPLETAMENTE RISTRUTTURATO NEL 2026 CON INGRESSO INDIPENDENTE",
  "",
  "Nel cuore della città, una soluzione moderna, completamente rinnovata e ideale anche come investimento immobiliare.",
  "",
  "L'appartamento si compone di una zona giorno con soggiorno e cucina, due camere da letto e un bagno finestrato completo di doccia.",
  "",
  "La richiesta di abitazioni in affitto in questa parte della città offre infatti interessan",
  "",
  "Caratteristiche",
  "Stato",
  "Ottimo - ristrutturato",
  "Superficie",
  "108 mq",
  "Piano",
  "-",
  "Locali",
  "3",
  "Bagni",
  "1",
  "Parcheggio",
  "-",
  "Energia e riscaldamento",
  "Riscaldamento",
  "Autonomo",
  "Classe energetica",
  "A1",
  "",
  "Ricerche consigliate",
  "informatica Brescia",
  "appartamenti brescia",
  "tavolo sedie arredamento Brescia provincia",
  "locali commerciali in affitto roma",
  "affitto locali Treviso provincia",
  "affitto appartamenti da privati Sassari provincia",
  "case in affitto qualiano",
  "case in vendita terracina",
  "case in vendita lido di camaiore privati",
].join("\n");

const url = "https://www.subito.it/appartamenti/appartamento-di-108-m%C2%B2-con-3-locali-a-brescia-brescia-667801512.htm";

test("Subito.it: il titolo è quello dell'annuncio, non una frase della descrizione che dice 'in affitto'", () => {
  expect(parseListingText(SUBITO, url).title).toBe("Appartamento di 108 m² con 3 locali a Brescia");
});

test("Subito.it: prezzo, metri, comune e provincia giusti; la zona non è 'zona giorno'", () => {
  expect(parseListingText(SUBITO, url)).toMatchObject({
    price: 168000,
    sqm: 108,
    city: "Brescia",
    province: "BS",
    zone: "",
    bathrooms: 1,
  });
});

describe("la provincia è sempre una sigla vera, mai un pezzo di testo", () => {
  test("la sigla accanto al comune vince sul resto della pagina", () => {
    expect(parseListingText("Trilocale in vendita\nMilano (MI)\n250.000 €\n80 m²\nProvincia Alla Ricerca Di Casa", "https://esempio.it/a").province).toBe("MI");
  });

  test.each([
    ["Trilocale a Brescia, provincia di Brescia. 168.000 € 108 m²", "BS"],
    ["Bilocale a Correggio, in provincia di Reggio Emilia. 120.000 € 60 m²", "RE"],
    ["Villa a Ischia, Provincia di Napoli. 450.000 € 180 m²", "NA"],
    ["Casa a Bressanone, provincia di Bolzano. 300.000 € 110 m²", "BZ"],
  ])("il nome di una provincia diventa la sigla: %s", (text, code) => {
    expect(parseListingText(text, "https://esempio.it/a").province).toBe(code);
  });

  test.each([
    ["Appartamento in vendita a Brescia\nVia Daniele Comboni 24, Brescia, 25123 (Brescia)\n290.000 €\n160 mq", "BS"],
    ["Bilocale in vendita\nVia Roma 1, Correggio, 42015 (Reggio Emilia)\n120.000 €\n60 mq", "RE"],
    ["Villa in vendita\nVia Mare 3, Ischia, 80077 (Napoli)\n450.000 €\n180 mq", "NA"],
  ])("il nome della provincia tra parentesi dopo il CAP: %#", (text, code) => {
    expect(parseListingText(text, "https://progress.remax.it/vendita-appartamento/x").province).toBe(code);
  });

  test.each([
    "Trilocale 168.000 € 108 m². Provincia Alla Ricerca Subito Appartamenti Brescia",
    "Trilocale 168.000 € 108 m² (IT) Nessun dato utile",
    "Trilocale 168.000 € 108 m². In provincia Offrendo Servizi A Tutti",
  ])("ciò che non è una provincia resta vuoto: %s", (text) => {
    expect(parseListingText(text, "https://esempio.it/a").province).toBe("");
  });
});

test("righe di menu come 'Brescia Prov.' o 'Brescia Provincia' non sono un quartiere", () => {
  for (const menuLine of ["Brescia Prov.", "Brescia Provincia"]) {
    const text = `Appartamento di 108 m² con 3 locali a Brescia\nBrescia (BS)\n${menuLine}\n168.000 €\n108 mq`;
    expect(parseListingText(text, "https://esempio.it/a")).toMatchObject({ city: "Brescia", province: "BS", zone: "" });
  }
});

test("'zona giorno' e 'zona notte' sono parti della casa, non un quartiere", () => {
  const text = "Appartamento a Brescia (BS)\n168.000 €\n108 mq\nL'appartamento ha una zona giorno ampia e una zona notte con due camere.";
  expect(parseListingText(text, "https://esempio.it/a").zone).toBe("");
});
