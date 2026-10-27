# Affare Subito: cosa serve alla Play Console

Pacchetto `com.st3fez.affaresubito`, versione 1.0.0 (versionCode 2026102701). Tutto in italiano.

## File da caricare

| Cosa | Dove |
|---|---|
| Bundle firmato (AAB) | `android/app/build/outputs/bundle/release/app-release.aab` (si rifà con `npm run android:release:bundle`) |
| File di mappatura R8 (opzionale, per leggere gli errori) | `android/app/build/outputs/mapping/release/mapping.txt` |
| Icona 512 × 512 | `assets/store/play-store-icon.png` |
| Immagine di presentazione 1024 × 500 | `assets/store/play-feature-graphic.png` |
| Screenshot del telefono | `assets/store/screenshots/` (da 2 a 8; lato lungo al massimo il doppio del corto) |

Il bundle è firmato con la chiave di rilascio `android/app/st3fez-release.jks` (alias `st3fez`, parametri in `android/keystore.properties`,
entrambi fuori da git). Impronta SHA-256 del certificato di caricamento:
`22:A6:C0:8D:F2:01:DE:57:0E:3B:BB:58:EE:B1:99:82:4D:1D:7F:F6:7B:24:A6:26:C6:8A:73:5B:83:01:FA:64`.
Se la Console chiede di aderire a Play App Signing, accetta: la chiave sopra resta la chiave di caricamento.
Il `versionCode` ha la forma `AAAAMMGGNN` (data e numero del giorno): sta sopra qualunque numero piccolo caricato prima, e a ogni nuova versione
basta rifarlo con la data di quel giorno (per esempio `2026110301`), perché Play non accetta due volte lo stesso numero né uno più basso.

## Controlli tecnici (27/10/2026)

| Requisito | Esito |
|---|---|
| Livello API | target 36, minimo 24 (Play chiede almeno 35 per le novità) |
| 64 bit | arm64-v8a e x86_64 presenti |
| Pagine da 16 KB | le 16 librerie native di arm64-v8a e di x86_64 hanno i segmenti allineati a 16 KB (`p_align` 0x4000, letto dalle intestazioni ELF del bundle); AGP 8.12.0. Le ABI a 32 bit restano a 4 KB, ed è corretto: i dispositivi a 16 KB sono solo a 64 bit |
| Edge-to-edge | attivo (`edgeToEdgeEnabled=true`); `Screen` rispetta i margini del sistema sui quattro lati e alza campi e pulsante sopra la tastiera (`KeyboardAvoidingView`); la barra di stato non ha colori forzati |
| API deprecate | restano chiamate a `Window.setStatusBarColor`, `setNavigationBarColor` e `layoutInDisplayCutoutMode`, ma solo dentro librerie (React Native, Material Components) e `setRequestedOrientation` nella WebView. Il nostro codice non le usa. La Console può mostrarle come avviso: non bloccano la pubblicazione e spariscono aggiornando React Native o Expo |
| Schermi grandi | da 600 dp Android 16 ignora il blocco in verticale: l'app può ruotare. Le schermate hanno margini laterali e la colonna non supera 640 dp |
| Fatturazione | Play Billing Library 9.1.0 (via expo-iap 6.3.0); Play chiede almeno la 7 |
| Permessi | INTERNET, ACCESS_NETWORK_STATE, VIBRATE, BILLING. Nessun ID pubblicità. I permessi di archiviazione che aggiunge `expo-file-system` (fino ad Android 12L) sono tolti dal manifest: l'app non accede ai file |
| Indietro predittivo | disattivato (`enableOnBackInvokedCallback=false`); consentito con target 36, da rivedere quando si passa a 37 |

## Il contributo (prodotto su Google Play)

Monetizzazione → Prodotti → Abbonamenti → Crea abbonamento:

- **ID prodotto:** `contributo_annuale` (è quello scritto nel codice, `SKU_YEAR` in `src/billing/billing.ts`).
- **Nome:** Contributo annuale.
- **Piano base:** di tipo **prepagato**, durata 1 anno, ID `annuale`, **non si rinnova da solo** (il testo dell'app dice
  "si paga una volta e vale 12 mesi"). Prezzo 0,99 € per l'Italia. Lascia spenta la ricarica prepagata e le prove gratuite.
- **Attiva** il piano base. Il prodotto deve essere attivo prima del test.

Se invece scegli un piano a rinnovo automatico, cambia il testo in `src/screens/PaywallScreen.tsx` e nella sezione "Contributo"
dell'informativa (`docs/index.html`): oggi dicono che non si rinnova.

## Scheda dello store

**Titolo** (30 caratteri al massimo): `Affare Subito`

**Descrizione breve** (80 caratteri al massimo):

```
Incolla il link di un annuncio e scopri se il prezzo o l'affitto è giusto.
```

**Descrizione completa** (4.000 caratteri al massimo):

```
Stai per comprare o affittare casa e non sai se il prezzo è giusto? Incolla il link dell'annuncio: Affare Subito lo legge e lo confronta con i valori di mercato della zona.

COSA TI DICE
• Se il prezzo è sotto, in linea o sopra il mercato, con la fascia di prezzo della zona e il modo in cui i valori sono cambiati negli ultimi anni.
• Per gli affitti: se il canone è giusto, e quanto costerebbe invece comprare una casa simile (anticipo, imposte e rata del mutuo).
• Quanto costa davvero entrare in una casa che compri: imposte, notaio, agenzia, lavori e arredo. Ogni cifra stimata è segnata come stima.
• Come potrebbe rendere la casa in quattro modi: viverci, affitto a lungo termine, stanze a studenti, affitto breve. Entrate, spese, tasse e resa netta, con ipotesi che puoi modificare.
• Un archivio delle analisi e il confronto tra due case.

COME FUNZIONA
Incolli il link, l'app apre la pagina come farebbe il tuo browser e legge prezzo, metri quadri e comune. Controlli i dati, correggi quello che non torna e ottieni il risultato. Se un sito non si lascia leggere puoi incollare il testo dell'annuncio o inserire i dati a mano.
In molte grandi città la zona si trova dalla posizione dell'annuncio, e il confronto è con i valori di quella zona e non con la media di tutta la città.

QUANTO COSTA
Le prime tre analisi di annunci diversi sono gratuite. Poi serve un contributo di 0,99 € che vale 12 mesi: si paga una volta, non si rinnova da solo. Le analisi già fatte restano sempre consultabili.

PRIVACY
Nessun account, nessuna pubblicità. Le analisi restano sul tuo telefono: l'app non invia i tuoi dati a server dell'autore.

FONTI E LIMITI
I valori di mercato vengono dalle quotazioni dell'Osservatorio del Mercato Immobiliare (OMI) dell'Agenzia delle Entrate. I risultati sono stime basate su valori di zona e su ipotesi che puoi modificare: non sono consulenza finanziaria, fiscale o legale. Prima di acquistare, affittare o investire rivolgiti a un professionista.
```

**Novità di questa versione:**

```
Prima versione di Affare Subito: verdetto sul prezzo, costo per entrare, affitti, quattro usi della casa, archivio e confronto.
```

**Categoria:** Casa e arredamento (House & Home). **Tag:** immobili, mutuo, affitto. **Indirizzo e-mail di contatto:** il tuo (è pubblico nella scheda).
**Sito web (facoltativo):** https://github.com/St3fez/affare-subito

## Moduli "Contenuti dell'app"

- **Informativa sulla privacy:** https://st3fez.github.io/affare-subito/ (va letta la versione nuova: pubblicata quando il ramo `feat/compratori` entra in `main`).
- **Accesso all'app:** tutte le funzioni sono disponibili senza account.
- **Annunci:** l'app non contiene annunci. **ID pubblicità:** non lo usa (nel manifest non c'è `AD_ID`): rispondi "No".
- **Pubblico di destinazione:** solo adulti (18+); non è pensata per i bambini.
- **Classificazione dei contenuti:** nessuna violenza, contenuto sessuale, linguaggio volgare, gioco d'azzardo o interazione tra utenti; è un'app di utilità.
- **App di notizie, salute, enti pubblici:** no. **Funzioni finanziarie:** nessuna (non offre prestiti, banca o scambio di titoli: calcola solo stime).
- **Acquisti in-app:** sì (il contributo).
- **Sicurezza dei dati** (controlla le risposte alla luce dell'informativa):
  - Raccolta di dati: l'app non raccoglie e non invia dati a server dell'autore; archivio e contatore delle analisi stanno sul telefono.
  - Condivisione con terzi: nessuna. La pagina dell'annuncio la apre il sito dell'annuncio nel browser integrato, come in un browser; il pagamento lo gestisce Google Play.
  - Cancellazione: i dati sono solo sul telefono e si cancellano dalle impostazioni (Dati dell'app) o disinstallando.
  - Per l'app non ci sono SDK di pubblicità o statistiche.

## Prima di premere "Invia"

1. **Pagamento vero:** già provato nel test interno. Il prodotto `contributo_annuale` deve restare attivo.
2. **Account personale nuovo?** Google può richiedere un test chiuso con almeno 12 tester per 14 giorni prima di concedere l'accesso alla produzione: controlla in Console → Rilascia → Test e rilascio.
3. **Screenshot:** da 2 a 8, vedi `assets/store/screenshots/`.
4. Dopo l'invio, la revisione dura di solito da poche ore a qualche giorno.
