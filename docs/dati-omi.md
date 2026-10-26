# Dati OMI

L'app confronta il prezzo al mq con le fasce di mercato dell'Osservatorio del Mercato Immobiliare (Agenzia delle Entrate).
I dati stanno in `src/data/omi.json`, che **non è nel repository** (`src/data/.gitignore`): senza quel file l'app parte lo stesso
e dice "nessun riferimento di mercato".

## Generare il file

1. Procurarsi i due CSV OMI di un semestre recente: `VALORI` e `ZONE`. Il download ufficiale richiede l'accesso Fisconline/Entratel
   ("Forniture OMI - Quotazioni immobiliari"). La copia pubblica del repository `ondata/quotazioni-immobiliari-agenzia-entrate`
   si ferma al secondo semestre 2018 e **non va usata per una versione pubblicata**.
2. `node scripts/build-omi.js --valori <valori.csv> --zone <zone.csv> --semester 2025-S2 --out src/data/omi.json`

## Prima di pubblicare

- Il semestre deve essere recente: con valori vecchi l'app mostra un avviso e non dà un giudizio sul prezzo.
- La licenza va chiarita per iscritto con l'Agenzia: la pagina "Forniture dati OMI" cita la CC-BY 4.0, ma le "Condizioni contrattuali
  e d'uso" vietano di cedere i contenuti della banca dati a terzi. Distribuire i dati dentro un'app è una redistribuzione.
- Citare la fonte: «Agenzia delle Entrate – OMI» (l'app lo fa nella schermata del risultato).
