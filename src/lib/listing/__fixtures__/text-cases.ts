import type { ListingData } from "../../types";

export type TextCase = {
  id: string;
  label: string;
  /** Testo di un annuncio reale, copiato da DEV_OCR_REGRESSION_CASES della v1. */
  text: string;
  expected: Partial<ListingData>;
};

// Dei cinque casi della v1 restano i tre con testo pulito. "immobiliare-card" e "immobiliare-features"
// testano rumore tipico dell'OCR (per esempio "242m²" letto al posto di "42"), che l'app non ha più.
export const textCases: TextCase[] = [
  {
    id: "immobiliare-description",
    label: "Immobiliare descrizione",
    text: `Descrizione
piano seminterrato.
Infissi in pvc doppio vetro, pavimentazione e bagno fatti nuovi nel 2022.
Immobile attualmente locato a 500e/mese con scadenza il 31/10/2027 con contratto del 2019,
potenzialmente locabile a 650 euro/mese con i valori di mercato attuali.
Prezzo: 109.000,00
Rif.: BP-08
C.E.: G`,
    expected: { price: 109000 },
  },
  {
    id: "tecnocasa-roma",
    label: "Tecnocasa Roma",
    text: `Affiliato: Immobiliare Villa Fiorelli Re Di Roma Srl
Via Enna, 33 00182 Roma (RM)
Rif: 61186133
249.000
Bilocale in vendita
Roma, Via Mirandola - Villa Fiorelli
Tipologia: appartamenti
Superficie: mq 48 ca.
Locali: 2
Bagni: 1
Piano:
Nel cuore di Villa Fiorelli`,
    expected: {
      price: 249000,
      city: "Roma",
      zone: "Villa Fiorelli",
      sqm: 48,
      bathrooms: 1,
      propertyType: "bilocale",
    },
  },
  {
    id: "toscano-brescia",
    label: "Toscano Brescia",
    text: `Affittato | 1 Livello
Casa in vendita - Via Marino Ballini, Brescia (rif. 35/2025)
116 m2
4 Locali
2 Bagni
Piano 2
Prezzo immobile
210.000
Rata di 740 al mese`,
    expected: {
      price: 210000,
      city: "Brescia",
      sqm: 116,
      bathrooms: 2,
      floor: "2",
      propertyType: "quadrilocale",
    },
  },
];
