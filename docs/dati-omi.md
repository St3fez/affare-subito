# Dati OMI

L'app confronta il prezzo al mq con le fasce di mercato dell'Osservatorio del Mercato Immobiliare (Agenzia delle Entrate).
I dati stanno in `src/data/omi.json`, che **non è nel repository** (`src/data/.gitignore`): senza quel file l'app parte lo stesso
e dice "nessun riferimento di mercato".

## Generare il file

1. Scaricare le quotazioni di un semestre recente dall'area riservata dell'Agenzia (SPID, CIE o Fisconline/Entratel):
   "Forniture dati OMI" → Quotazioni, intero territorio nazionale. Lo zip contiene due CSV, `QI_…_VALORI.csv` e
   `QI_…_ZONE.csv`, dello stesso semestre (circa 2 MB compressi). La fornitura con i perimetri (circa 110 MB) contiene gli stessi
   due CSV più un KML per comune con i confini delle zone: all'app servono solo i CSV.
2. `node scripts/build-omi.js --valori <…_VALORI.csv> --zone <…_ZONE.csv> --out src/data/omi.json`

Lo script legge il semestre dalla prima riga dei file ufficiali ("… - Semestre 2024/2 - …") e si ferma se VALORI e ZONE sono di
semestri diversi. Legge anche la copia di `ondata/quotazioni-immobiliari-agenzia-entrate` (separatore virgola, senza semestre:
va aggiunto `--semester 2018-S2`), che però si ferma al 2018 e **non va usata per una versione pubblicata**.

Il primo semestre 2026 dà 7.887 comuni e 22.848 zone con valori residenziali, circa 4 MB.

## Storico per i grafici

I grafici "Come sono cambiati i valori della zona" leggono `src/data/omi-history.json` (anch'esso fuori dal repository).
Si genera dai VALORI di più semestri, ognuno col proprio file ufficiale:

`node scripts/build-omi-history.js --out src/data/omi-history.json <2021-1_VALORI.csv> <2021-2_VALORI.csv> … <2026-1_VALORI.csv>`

Per ogni zona dell'ultimo semestre c'è il valore centrale della forchetta "normale" di vendita e di affitto, semestre per
semestre; i semestri mancanti restano vuoti (nel grafico un buco nella linea). Le zone si seguono con il codice LinkZona: tra il
2023 e il 2024 l'OMI ne ha ridisegnate circa l'8%, e per quelle la serie parte dal 2024. Dal 2021/1 al 2026/1 (senza il 2024/1)
sono 22.503 zone, circa 2,7 MB. Senza il file l'app funziona e non mostra il grafico.

## Zone dalla posizione dell'annuncio

In una città le zone vanno dalla periferia al centro e la media del comune non dice nulla di una casa. Se l'annuncio ha le coordinate
(immobiliare.it, tecnocasa.it), l'app trova la zona OMI in cui cade il punto, e il riferimento di mercato è quello della zona. Servono
i confini, che stanno in `src/data/omi-zones.json` (fuori dal repository, come gli altri). Si generano dal download "Perimetri"
dell'Agenzia (un file KML per comune, chiamato col codice catastale) e dal file VALORI dell'ultimo semestre:

`node scripts/build-omi-zones.js --valori <2026-1_VALORI.csv> --kml-dir <cartella dei KML> --out src/data/omi-zones.json --min-zones 6 --tolerance 25`

Solo i comuni con almeno `--min-zones` zone di case: sono quelli in cui la zona conta. Con 6 sono 563 comuni e 5.782 zone, circa 4,2 MB
(tolleranza 25 m; con 12 m 6,4 MB). I contorni sono semplificati: vicino a un confine il punto può cadere nella zona accanto, e per questo
la zona più piccola vince e si accetta un punto fino a 40 m fuori dai contorni. Il file si carica alla prima analisi; se manca o è
rovinato l'app cerca la zona per nome, come prima. Quando la zona viene dalla posizione la schermata lo scrive.

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
