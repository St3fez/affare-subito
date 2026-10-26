# Affare Subito → app per chi compra casa (3 analisi gratis, poi 0,99 € per un anno)

## Contesto

Oggi l'app è uno strumento per investitori ("flip" o "affitto") con un solo punteggio verde/giallo/rosso.
È complicata da usare, e lo si vede nel codice:

- Tutto sta in [App.tsx](../../../App.tsx) (~10.000 righe) con cinque modi di inserire i dati: form, guida vocale, dettatura, testo incollato, screenshot con OCR.
- Leggere il link da telefono non è affidabile: immobiliare.it è protetto da DataDome (la pagina salvata in `immobiliare-test.html` si è aperta solo perché la richiesta si spacciava per il bot di OpenAI). `fetchListingTextFromUrl` (App.tsx:3054) gestisce il 403 dicendo "usa testo o screenshot". OCR, voce e guida vocale sono con ogni probabilità ripieghi nati da qui.
- L'estrazione con l'AI chiede all'utente la propria chiave OpenAI (App.tsx:5627). Non regge per un'app pubblica.
- Il lato affitto ha un solo canone e spese fisse al 20% (`calculateAnalysis`, App.tsx:3839). Non esistono Airbnb, stanze a studenti né un confronto tra usi. L'arredo è un numero scritto a mano.

**Obiettivo (deciso dall'utente):** app **pubblica** sul Play Store per chi deve comprare casa, **gratis per le prime 3 analisi; poi chiede 0,99 € e si usa per un anno** (aggiunto dall'utente il 26/10, dopo l'approvazione dello schizzo). Si incolla il **link dell'annuncio** e l'app dice se è un affare, quanto costa davvero entrare (ristrutturazione e arredo compresi) e quanto renderebbe affittandola in modi diversi. Motivo di fondo: la versione attuale è "troppo complicata".

## Obiettivi, non-obiettivi, anti-obiettivi

- **Obiettivi:** un solo passaggio in ingresso (il link); un solo schermo di risposta; zero costi di server; zero chiavi o account.
- **Non-obiettivi (v1):** altre lingue oltre l'italiano; piani a pagamento diversi dai 0,99 € annuali (niente "Pro", niente più livelli); Stripe; OCR, voce, screenshot; backend proprio; account utente; iOS.
- **Anti-obiettivi:** numeri inventati presentati come certi. Ogni cifra stimata è etichettata "stima", ha la fonte o l'ipotesi dichiarata ed è modificabile. L'app non è consulenza e lo dice. Anche: richieste di pagamento ingannevoli. Il prezzo, la durata e cosa si ottiene sono chiari prima di pagare, e i risultati già visti non si bloccano mai.

## Scelte dell'utente (così come le ha date)

1. Il problema è la complessità.
2. L'utente fornisce **il link dell'annuncio**.
3. L'app è pubblica sul Play Store (prima risposta: "pubblica e gratuita").
4. Lo schizzo qui sotto è approvato ("niente da cambiare").
5. **Contributo (aggiunto dopo):** "dopo l'analisi di tre immobili, chiede un contributo di 0,99 €"; alla domanda su come funziona ha risposto "0,99 e si può usare per un anno". Il resto (cosa succede alla quarta analisi, rinnovo, cosa resta consultabile) l'ha lasciato a me: vedi "Scelte mie".

### Lo schizzo approvato
1. **Ingresso:** si incolla il link (ipotesi mia: anche "Condividi → Affare Subito" dall'app del portale). L'app mostra "Ho capito: trilocale 85 mq, Lambrate, 340.000 €, da ristrutturare" con pochi campi da correggere.
2. **Verdetto:** prezzo sotto, in linea o sopra la zona, in percentuale, con riferimento ai valori OMI.
3. **Costo per entrare:** prezzo + imposte (una domanda: prima casa sì/no) + notaio + agenzia + ristrutturazione + arredo; le ultime due stimate da stato e metri quadri.
4. **Quattro usi affiancati:** viverci, lungo termine, stanze a studenti, Airbnb. Per ognuno: entrata mensile, spese e tasse stimate, resa netta, avvertenza.
5. **Ritocchi e archivio:** slider su ogni stima, il verdetto si aggiorna; si salva e si confrontano due case.

Si tolgono: voce, OCR, screenshot, guida vocale, chiave OpenAI, Stripe e "Pro" (sostituiti dal contributo annuale via Google Play Billing), lingue diverse dall'italiano. Si tengono: archivio, confronto, calcolo del mutuo.

## Scelte mie (da controllare)

- **Lettura del link con browser interno (WebView)**, non `fetch`: gira sul telefono e sull'IP dell'utente, come in Chrome. Si legge `__NEXT_DATA__` e JSON-LD dalla pagina caricata. Se compare un controllo anti-bot lo risolve l'utente a vista.
- **Scala di ripieghi, ognuno più semplice:** 1) WebView → 2) testo incollato → 3) mini-form di 4 campi (prezzo, mq, comune, stato). Il mini-form funziona sempre ed è la base.
- **Parser, non AI:** nessuna chiamata di rete per interpretare l'annuncio.
- **Valore di mercato = OMI** (Agenzia delle Entrate), forchette min/max al mq per zona e stato, vendita e affitto, aggiornate ogni semestre. Incluse nell'app come JSON compatto generato da uno script; v1 a livello di comune con ricerca della zona per nome, e l'etichetta dice quanta precisione c'è ("comune di Milano" o "zona B12").
- **Tutti i parametri fiscali e di costo in tabelle uniche** (`src/lib/fiscal.ts`, `src/lib/costs.ts`), ognuna con fonte e data di verifica. Niente numeri a memoria: vanno verificati prima del rilascio (imposta di registro prima/seconda casa, IVA da costruttore, cedolare secca ordinaria/concordata/affitti brevi, IMU, tariffe notaio).
- Ipotesi esplicite e modificabili per ciò che non ha dati gratuiti: tariffa e occupazione Airbnb, canone a stanza per gli studenti, costo €/mq dei lavori per livello, arredo per stanza.
- Codice nuovo in `src/` (logica pura in `src/lib`, schermi in `src/screens`, WebView in `src/components`), con test (jest) sulla logica. `App.tsx` diventa un file piccolo che monta la navigazione.
- **Contributo = Google Play Billing, non Stripe.** Le regole del Play Store vogliono Play Billing per ciò che si sbloccia dentro l'app, anche per 0,99 €; il `stripeCheckoutUrl` attuale (App.tsx:65) non è ammesso e sparisce.
- **Forma del contributo:** abbonamento annuale a 0,99 € su Play, **prepagato (non si rinnova da solo)** se la Play Console lo permette per questo prodotto, altrimenti a rinnovo automatico con scritta chiara. Prepagato è la mia scelta perché l'utente ha detto "si può usare per un anno" e un addebito a sorpresa dopo 12 mesi irriterebbe; Play tiene la scadenza e la ripristina su un telefono nuovo senza server nostri.
- **Regole di conteggio (mie):** le 3 analisi gratuite sono 3 annunci *diversi*; riaprire o ritoccare lo stesso annuncio non ne consuma un'altra. Il blocco scatta quando si tenta di analizzare il **quarto** annuncio nuovo; il risultato del terzo si vede e porta la nota "era l'ultima analisi gratuita". L'archivio resta sempre consultabile. Il contatore è sul telefono (nessun server): chi cancella i dati dell'app può ripartire dalle 3 gratuite, e lo accetto per la v1. Senza rete, vale l'ultima scadenza nota fino alla sua data.
- **Logica separata dal pagamento:** le regole stanno in `src/lib/entitlement.ts` (pure, a test); Play Billing è un adattatore a parte, con una versione finta per il debug.

## Cosa si riusa da App.tsx (spostandolo in `src/lib`)

- Numeri e formati: `toNumber`, `parseFlexibleNumber`, `formatCurrency`, `formatPercent` (App.tsx:2379–2424).
- `calculateMortgagePayment` (App.tsx:3668).
- Parser di testo dell'annuncio: `buildFormPatchFromText` e i suoi estrattori (`extractMoneyCandidates`, `extractSqm`, `extractBedrooms`, `extractBathrooms`, `extractFloor`, `extractType`, `extractCityZone`, App.tsx:4029–4864) come ripiego "testo incollato".
- Dati strutturati: `extractTitleAndMetaLines`, `collectLinesFromStructuredData`, `extractStructuredLinesFromJsonLd` (App.tsx:2784–2910).
- I casi di regressione OCR (`DEV_OCR_REGRESSION_CASES`, App.tsx:1938) hanno testi reali di annunci: riusarli come fixture di test del parser, poi buttare l'OCR.

## File da non rovinare

- Modifiche **non committate** in `android/app/build.gradle` (firma release da `keystore.properties`, ignorato da git) e in `android/gradle.properties` (R8/shrink attivi), più `assets/store/` (grafiche Play). Sono la preparazione al rilascio: non usare `expo prebuild --clean`, che le cancellerebbe. Togliere i moduli nativi a mano.
- `applicationId com.st3fez.affaresubito`, `versionCode 1` in build.gradle.
- `docs/index.html` è l'informativa privacy: va riscritta (niente AI esterna né chiave; la WebView carica pagine di portali terzi; gli acquisti passano da Google Play).

## Fasi

**Fase 0 — Prova con il telefono collegato (2412DPC0AG, visibile via adb). Go/no-go.**
Prototipo usa-e-getta: una WebView che apre un annuncio di immobiliare.it, idealista e casa.it, ed estrae i campi. Si misura se il controllo anti-bot passa. Se passa → fase 1. Se non passa → si ripensa l'ingresso (ripiego: testo incollato o testo condiviso dall'app del portale) prima di costruire il resto. Il prototipo non si tiene senza nuovo via libera.

**Fase 1 — Logica (a test, TDD).**
`listing` (da `__NEXT_DATA__`/JSON-LD/testo), `market` (ricerca OMI), `costs` (imposte, lavori per stato, arredo per usi), `strategies` (viverci, lungo termine, studenti, Airbnb; ciascuna dà entrata, spese, tasse, resa netta, cashflow col mutuo, avvertenze), `verdict` (prezzo/mq contro forchetta OMI aggiustata per stato). Script `scripts/build-omi` che trasforma i CSV OMI in JSON compatto (dimensione massima da fissare, ~10 MB).

**Fase 2 — Schermi.**
Incolla/Carica → Rivedi → Verdetto (con i quattro usi e gli slider) → Archivio → Confronto. Stile visivo da decidere con l'utente a schermi pronti (si parte dalla palette esistente, `#f5efe6` crema).

**Fase 3 — Pulizia e rilascio.**
Contributo: regole in `entitlement.ts`, adattatore Play Billing (libreria da scegliere, richiede nuova build nativa), schermata del contributo. Via moduli e codice morto (voce, OCR, image-picker, Stripe, traduzioni), via permessi inutili da `AndroidManifest.xml` (RECORD_AUDIO, query RecognitionService, storage), via il plugin `expo-speech-recognition` da `app.json`. Nuova informativa privacy, scheda Play (comprese le dichiarazioni sugli acquisti), `versionCode`.

## Verifica

- `npx tsc --noEmit` e `npx jest` verdi (logica e fixture reali di annunci).
- Fase 0 e fase 2 sul telefono: `adb install`, aprire un annuncio vero, controllare i campi estratti a occhio, e uno screenshot dello schermo del verdetto.
- Caso senza rete e caso annuncio non leggibile: deve comparire il mini-form, mai un errore nudo.
- Controllo a mano di ogni cifra fiscale contro la fonte dichiarata in tabella.
- `android:release:bundle` produce un bundle firmato (richiede `keystore.properties`) e il manifest non contiene più i permessi tolti.
- **Contributo:** le regole si provano a test (3 annunci, il quarto bloccato, stesso annuncio non conta, scadenza, senza rete). Il pagamento vero **non si prova dal cavo USB**: Play Billing funziona solo con la build caricata in "test interno" sulla Play Console e un account tester con carta di prova. Quel passaggio lo fa l'utente con me accanto.

## Questioni aperte

- **Licenza OMI.** Il download è gratuito con citazione "Agenzia Entrate - OMI", ma non ho trovato una licenza chiara per ridistribuire i dati dentro un'app (il Comune di Milano ne pubblica una parte in CC BY 4.0). Da chiarire prima del rilascio; senza via libera le forchette vanno altrove (es. calcolate lato utente da file scaricato) o si usa solo la fonte di Milano.
- **L'app è già su Play?** Ipotesi mia: no (`versionCode 1`, firma in preparazione). Se invece ha utenti, l'archivio vecchio non viene migrato e va detto.
- **Condivisione dal portale** ("Condividi → Affare Subito") richiede una libreria di terze parti per l'intent: da decidere dopo la fase 0.
- **Valori di partenza** per lavori e arredo: li cerco con fonti citate in fase 1; l'utente li rivede.
- **Play Console e pagamenti (serve l'utente).** Per vendere servono un account sviluppatore Play con profilo pagamenti attivo e la creazione del prodotto da 0,99 €. Non posso farlo io. Google trattiene una commissione e l'IVA sul prezzo: i centesimi che restano a chi pubblica sono meno di 0,99 € (cifra esatta da verificare). Gli aspetti fiscali di un incasso ricorrente li deve valutare un commercialista.
- **Prepagato o rinnovo automatico.** Dipende da cosa permette la Play Console per questo prodotto; la prima scelta è il prepagato.
- **Documento e piano:** questo documento vive in `docs/superpowers/specs/`; il piano passo-passo è in `docs/superpowers/plans/2026-10-26-affare-subito-compratori.md`. Commit solo su richiesta.
