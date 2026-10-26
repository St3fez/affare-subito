# Dati OMI

L'app confronta il prezzo al mq con le fasce di mercato dell'Osservatorio del Mercato Immobiliare (Agenzia delle Entrate).
I dati stanno in `src/data/omi.json`, che **non è nel repository** (`src/data/.gitignore`): senza quel file l'app parte lo stesso
e dice "nessun riferimento di mercato".

## Generare il file

1. Scaricare le quotazioni di un semestre recente dall'area riservata dell'Agenzia (SPID, CIE o Fisconline/Entratel):
   "Forniture dati OMI" → **Quotazioni** (non "Perimetri", che sono i confini delle zone in KML), intero territorio nazionale.
   Lo zip contiene due CSV, `QI_…_VALORI.csv` e `QI_…_ZONE.csv`, dello stesso semestre.
2. `node scripts/build-omi.js --valori <…_VALORI.csv> --zone <…_ZONE.csv> --out src/data/omi.json`

Lo script legge il semestre dalla prima riga dei file ufficiali ("… - Semestre 2024/2 - …") e si ferma se VALORI e ZONE sono di
semestri diversi. Legge anche la copia di `ondata/quotazioni-immobiliari-agenzia-entrate` (separatore virgola, senza semestre:
va aggiunto `--semester 2018-S2`), che però si ferma al 2018 e **non va usata per una versione pubblicata**.

Il secondo semestre 2024 dà 7.889 comuni e 22.847 zone con valori residenziali, circa 4 MB.

## Cose da sapere sui file

- Le province sono quelle **catastali**, precedenti alle ultime riforme: Monza sta sotto MI, Fermo sotto AP, Barletta-Andria-Trani
  sotto BA e FG, Forlì è "FO", Pesaro "PS", la Sardegna ha solo CA, SS, NU e OR. `lookupMarket` traduce le sigle nuove degli
  annunci (MB, FM, BT, FC, PU, SU, CI, VS, OG, OT).
- L'apice inverso sta sia per l'accento sia per l'apostrofo ("FORLI`", "CAPRIATA D`ORBA"): lo script scrive "Forlì" e
  "Capriata d'Orba".

## Prima di pubblicare

- Il semestre deve essere recente: con valori di 4 o più semestri fa l'app mostra un avviso e non dà un giudizio sul prezzo.
- Licenza: la pagina "Forniture dati OMI" dice che i servizi sono disponibili con licenza CC-BY 4.0, con l'obbligo di citare
  «Agenzia delle Entrate – OMI». In passato le "Condizioni contrattuali e d'uso" del servizio di download vietavano di cedere i
  contenuti a terzi: rileggere quelle mostrate al momento del download e, se il divieto c'è ancora, chiedere conferma scritta.
- Citare la fonte: «Agenzia delle Entrate – OMI» (l'app lo fa nella schermata del risultato).
