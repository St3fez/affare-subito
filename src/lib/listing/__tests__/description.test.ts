import { readDescriptionDetails } from "../text";

// Descrizioni vere di annunci di immobiliare.it a Brescia (10/11/2026), nella parte che il portale mostra per intero.
const CROCIFISSA =
  "BRESCIA CROCIFISSA DI ROSA\nQUADRILOCALE RISTRUTTURATO\nAl secondo piano servito da ascensore di una palazzina ottimamente abitata in zona adiacente a Via Crocifissa di Rosa e a tutti i principali servizi Dinamicasa propone uno splendido QUADRILOCALE COMPLETAMENTE RISTRUTTURATO con estremo gusto e materiali di pregio. La porta d'ingresso accoglie nel grande e luminoso salone con zona cottura semi separata e servito da una loggia; da questo ambiente una porta conduce nella zona notte: in quest'area ci sono tre grandi camere da letto, di cui, quella padronale, munita di cabina armadio. La soluzione è servita da due bagni, entrambi con doccia e da un ulteriore balcone.";

const MAGENTA =
  "Rif: AB_24\nNel cuore del centro storico di Brescia, in Corso Magenta, una delle vie più prestigiose e ricercate della città, proponiamo in vendita un elegante trilocale completamente ristrutturato, posto al secondo piano di un edificio servito da ascensore.\nL’appartamento è stato oggetto di una ristrutturazione appena ultimata, con particolare attenzione alla funzionalità degli spazi, alla qualità delle finiture e al comfort abitativo in Classe Energetica B.\nL’ingresso apre sulla zona giorno con soggiorno e cucina a vista. La zona notte comprende una camera singola, un primo bagno completo e una camera padronale più riservata, dotata di cabina armadio e bagno privato.\nLa ristrutturazione ha interessato integralmente l’immobile: sono stati rifatti e certificati gli impianti elettrico e idraulico, rinnovati completamente i due bagni con nuovi sanitari, arredi e boiler.";

const VILLETTA_ASTA =
  "Porzione di villetta bifamiliare con giardino al piano terreno (classica costruzione dei villaggi di Padre Marcolini), composta a piano terra da soggiorno, cucina, box e scala per accedere al piano intermedio e primo; al piano intermedio si trova una camera, al piano primo si trovano due camere ed un bagno.";

const SENZA_ASCENSORE =
  "UN TERRAZZO STRAORDINARIO, UNA VISTA A 180° E TUTTA LA CITTÀ A PORTATA DI MANO. L’appartamento si trova al terzo e ultimo piano, senza ascensore, e conquista fin da subito per il suo carattere.";

describe("readDescriptionDetails: ciò che una descrizione dice sulla casa", () => {
  test("camere, bagni, piano, ascensore e stato scritti a parole", () => {
    expect(readDescriptionDetails(CROCIFISSA)).toMatchObject({
      bedrooms: 3,
      bathrooms: 2,
      floor: "2",
      hasElevator: true,
      condition: "pronto",
    });
  });

  test("conta i bagni anche quando sono scritti come 'i due bagni'", () => {
    expect(readDescriptionDetails(MAGENTA)).toMatchObject({ bathrooms: 2, floor: "2", hasElevator: true, condition: "pronto" });
  });

  test("il box citato nella descrizione conta", () => {
    expect(readDescriptionDetails(VILLETTA_ASTA).hasGarage).toBe(true);
  });

  test("il piano si legge dall'ordinale, anche se il testo parla pure dell'interrato", () => {
    expect(readDescriptionDetails("Al secondo piano di una palazzina. Nell'interrato l'appartamento è completato da una cantina.").floor).toBe("2");
    expect(readDescriptionDetails("Appartamento al piano 3 con vista; cantina al piano interrato.").floor).toBe("3");
    expect(readDescriptionDetails("Luminoso trilocale al 4° piano.").floor).toBe("4");
  });

  test("il piano resta ignoto se i piani citati sono più d'uno o se non c'è un numero", () => {
    expect(readDescriptionDetails("Al primo piano zona giorno, al secondo piano zona notte.").floor).toBe("");
    expect(readDescriptionDetails("Soluzioni al piano terra con giardino privato o al piano superiore con ampie balconate.").floor).toBe("");
  });

  test("'senza ascensore' è un no", () => {
    expect(readDescriptionDetails(SENZA_ASCENSORE)).toMatchObject({ hasElevator: false });
  });

  test("ciò che la descrizione non dice resta ignoto: niente numeri inventati", () => {
    expect(readDescriptionDetails("Bella casa luminosa, vicina ai servizi. Contattaci per una visita.")).toEqual({
      bedrooms: null,
      bathrooms: null,
      floor: "",
      condition: null,
      hasElevator: null,
      hasGarage: null,
      condoMonthly: null,
    });
    expect(readDescriptionDetails("")).toEqual({
      bedrooms: null,
      bathrooms: null,
      floor: "",
      condition: null,
      hasElevator: null,
      hasGarage: null,
      condoMonthly: null,
    });
  });
});
