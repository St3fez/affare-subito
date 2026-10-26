# Esito della prova WebView (Task 0) — 26/10/2026

**Verdetto: GO.** Nella WebView dell'app, sul telefono dell'utente (2412DPC0AG), i portali non hanno bloccato la lettura. Regola del piano: immobiliare.it con `nextDataBytes > 0` su 3 annunci su 3 **e** almeno un altro portale con `ldJsonCount > 0` oppure `hasEuro && hasSqm`.

## Come è stata fatta
- Build di debug con `react-native-webview`, user agent di default (non sovrascritto), JavaScript e DOM storage attivi, cookie condivisi.
- Ogni annuncio aperto da PC con `adb shell am start -d "affaresubito://spike?url=…"`; esito letto da `adb logcat` (`ReactNativeJS`). Nessun controllo anti-bot da risolvere a mano in nessun caso.
- Annunci presi da una ricerca web (non scelti a mano). Alcuni erano già scaduti.
- Script iniettato: aspetta fino a 15 s `#__NEXT_DATA__` o più di 5000 caratteri di testo, poi invia un riepilogo.

## Risultati

| Portale | Annuncio | Esito | nextData | ld+json | €/m² nel testo | Tempo |
|---|---|---|---|---|---|---|
| immobiliare.it | 132160002 (Sutri) | caricato, non bloccato | 213.242 B | 1 | sì | 0,5 s |
| immobiliare.it | 132246220 (San Lazzaro) | caricato, non bloccato | 221.322 B | 1 | sì | 0,5 s |
| immobiliare.it | 133244266 (Milano) | caricato, non bloccato | 229.896 B | 1 | sì | 0,5 s |
| immobiliare.it | 123353645 (Brescia, quello del fixture) | caricato, non bloccato | 219.292 B | 0 | sì | 0,5 s |
| idealista.it | 37025092 (Sesto S. Giovanni) | caricato, non bloccato, **finestra cookie** | 0 | 0 | sì | timeout 15 s |
| idealista.it | 35950186 (Roma) | caricato, non bloccato, **finestra cookie** | 0 | 0 | sì | timeout 15 s |
| idealista.it | 36225378, 36017963, 34433622, 36782773 | annuncio scaduto (404, pagina iniziale) | – | – | – | – |
| casa.it | 53235851 (Torino) | caricato, non bloccato; risposta HTTP 404 ma pagina con i dati | 36.781 B | 1 | sì | 0,5 s |
| casa.it | 53536360, `…36951706` | annuncio scaduto ("Pagina non trovata") | – | – | – | – |

Screenshot (esempio idealista, con la finestra cookie): `C:\Users\Pc\AppData\Local\Temp\claude\c--Users-Pc-Desktop-AffareSubito\74133310-a115-4ad6-be0f-46936e49812d\scratchpad\spike-ide1.png`.

## Cosa significa per il piano
- **immobiliare.it** è la strada migliore: i dati sono già in `__NEXT_DATA__` e la lettura è immediata, come previsto dal Task 2.
- **idealista.it** non ha JSON strutturato né `ld+json`: si legge dal testo della pagina (parser di testo, Task 3). Compare una finestra cookie che copre la pagina: l'utente la chiude con un tocco oppure l'app lo fa con uno script. Il timeout di 15 s dello spike era solo la mia condizione di attesa (aspettava più di 5000 caratteri); in produzione per le pagine senza `__NEXT_DATA__` si invia il testo dopo `document.readyState === "complete"` più circa 1,5 s. **La qualità dell'estrazione da idealista non è ancora verificata**: va controllata nel Task 14.
- **casa.it:** non bloccato, con `ld+json` e `__NEXT_DATA__`. Un solo annuncio testato con contenuto. Il Task 3 deve gestire anche l'estrazione da `ld+json`? **No per la v1:** si parte da immobiliare.it e dal testo; casa.it ricade sul testo.

## Limiti della prova
- Pochi annunci, pochi minuti, un solo telefono e una sola rete. DataDome può comportarsi diversamente con molte richieste, altre reti o altri dispositivi. La scala di ripieghi (testo incollato, mini-form) resta necessaria.
- Alcuni annunci di prova erano scaduti: il test dei portali diversi da immobiliare.it è più sottile.
- Non è stata provata la finestra di consenso di immobiliare.it su un telefono "pulito" (primo avvio senza cookie).
