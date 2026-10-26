# Affare Subito per chi compra casa — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare l'app in uno strumento che, dato il link di un annuncio, dice se il prezzo è un affare, quanto costa entrare e quanto renderebbe in quattro usi (viverci, lungo termine, stanze a studenti, Airbnb); 3 analisi gratis, poi 0,99 € per un anno.

**Architecture:** Logica pura in `src/lib` (TypeScript senza React Native, testata con jest), adattatore Play Billing in `src/billing`, schermi in `src/screens`. L'annuncio si legge con una WebView sul telefono (fase 0 la valida); il valore di mercato viene da dati OMI inclusi nell'app. `App.tsx` diventa una shell sottile.

**Tech Stack:** Expo 55 / React Native 0.83 / TypeScript strict, `jest-expo`, `react-native-webview`, `@react-native-async-storage/async-storage`, libreria Play Billing da scegliere nel Task 13.

**Spec:** `docs/superpowers/specs/2026-10-26-affare-subito-compratori-design.md`

## Global Constraints

- Solo italiano. Nessuna chiave AI, nessun account, nessun server nostro. Rete solo per la WebView verso il portale dell'annuncio e per Google Play Billing.
- `applicationId com.st3fez.affaresubito`; `versionCode` non si tocca fino al Task 19.
- Mai `git add -A` o `git add .`: si aggiungono i file per percorso. `android/app/build.gradle`, `android/gradle.properties`, `.gitignore` e `assets/store/` hanno modifiche non committate che non fanno parte dei task. Mai `expo prebuild --clean`.
- I passi "Commit" valgono solo se l'utente ha autorizzato i commit per l'esecuzione. Messaggi di commit chiusi con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- `src/lib/**` non importa `react-native`, `expo-*` né `App.tsx` (App.tsx importa React Native: il codice da riusare si **copia**).
- Parametri fiscali e di costo solo in tabelle `Param<T> = { value: T; source: string; verifiedAt: string | null }`. Nessun numero a memoria: se non si riesce a verificare, `verifiedAt: null` e la UI scrive "dato da verificare". Le funzioni ricevono la tabella come argomento; i test usano tabelle proprie.
- Ogni cifra stimata è etichettata "stima" in UI ed è modificabile. L'app dichiara che non è consulenza.
- Contributo: 3 annunci *diversi* gratis; il **quarto nuovo** è bloccato; riaprire lo stesso annuncio non conta; l'archivio resta sempre consultabile; prezzo 0,99 €, durata 12 mesi, Google Play Billing (mai Stripe).
- Fonte OMI citata in UI: "Fonte: Agenzia Entrate - OMI".

## Review Focus

Casi che lo spec implica e nessun task dichiara; ognuno ha il suo test nel task indicato.

1. **Pagina bloccata o senza dati** (captcha, nessun `__NEXT_DATA__`): l'utente vede la scala di ripieghi, mai schermo vuoto o errore nudo. → Task 2, 14.
2. **Annuncio d'affitto o non residenziale**: "non è una vendita", nessun verdetto assurdo. → Task 2, 10.
3. **Prezzo mancante o "su richiesta"**: nessun `NaN`, nessuna divisione per zero. → Task 3, 9, 10.
4. **Comune o zona assenti dai dati OMI**: "nessun riferimento", i costi si vedono ancora e gli affitti si possono inserire a mano. → Task 5, 10.
5. **Metri quadri assurdi** (0, 5, 4200): si chiede conferma prima di dare un verdetto. → Task 3, 15.

---

## Struttura dei file

```
src/lib/types.ts                 ListingData, Condition, Issue, Range, OmiState, Usage
src/lib/format.ts, mortgage.ts
src/lib/listing/{nextData,text,check,index,webviewMessage,url}.ts   + __fixtures__/, __tests__/
scripts/build-omi.js             CSV OMI → src/data/omi.json (CommonJS, con test)
src/lib/market.ts                lookupMarket (dati OMI)
src/lib/{fiscal,costs,strategies,verdict,analysis}.ts
src/lib/{entitlement,entitlementSync,archive}.ts
src/billing/{billing,playBilling,fakeBilling}.ts
src/data/omi.json                generato da scripts/build-omi.mjs
src/app/AppRoot.tsx, src/screens/*, src/components/*
```

I test stanno in `src/lib/**/__tests__/*.test.ts`.

---

### Task 0: Prova della WebView sul telefono (usa-e-getta, GATE)

**Files:** solo sul ramo `spike/webview`: `spike/SpikeScreen.tsx`, `index.ts` (puntato allo spike). Esito in `docs/superpowers/specs/2026-10-26-webview-spike-results.md` (su `main`).

**Produces:** una decisione GO/NO-GO. Nessun codice si tiene.

- [ ] **Step 1:** `git switch -c spike/webview`; `npx expo install react-native-webview`.
- [ ] **Step 2:** Scrivere `SpikeScreen`: campo URL (precompilato `https://www.immobiliare.it/annunci/123353645/`), `WebView` con `javaScriptEnabled`, `domStorageEnabled`, `sharedCookiesEnabled`, user agent di default (non sovrascriverlo), e uno script iniettato che per al massimo 15 s controlla ogni 500 ms se esiste `#__NEXT_DATA__` o `document.body.innerText.length > 5000`, poi invia con `window.ReactNativeWebView.postMessage` un JSON `{ url, title, nextDataBytes, ldJsonCount, ogTitle, bodyLen, hasEuro, hasSqm, blocked, ms }` (`blocked` = `/datadome|captcha|robot|verifica/i` sul titolo e sui primi 2000 caratteri del testo). Il JSON si mostra sotto la WebView.
- [ ] **Step 3:** Puntare `index.ts` allo spike; `npm run android:debug:install` (telefono 2412DPC0AG, controllare `adb devices -l`); la build di debug incorpora il JS, non serve Metro.
- [ ] **Step 4:** Chiedere all'utente 3 URL di annunci attuali per ciascuno tra immobiliare.it, idealista.it, casa.it. Per ogni URL: aprirlo, risolvere a mano un eventuale controllo anti-bot, annotare il JSON ricevuto; screenshot dei fallimenti con `adb exec-out screencap -p > <scratchpad>\spike-N.png`.
- [ ] **Step 5:** Scrivere la tabella dei risultati nel documento di esito. **Regola:** GO se immobiliare.it si carica e produce `nextDataBytes > 0` su 3 annunci su 3 (un captcha risolto una volta dall'utente, dopo il quale le pagine si aprono, conta come GO con nota) **e** almeno un altro portale dà `ldJsonCount > 0` oppure `hasEuro && hasSqm`. Altrimenti NO-GO.
- [ ] **Step 6:** `git switch main`, copiare il documento di esito. **FERMARSI e riferire all'utente** con la tabella e gli screenshot. Se NO-GO decide l'utente il ripiego (testo incollato o testo condiviso dall'app del portale). Non iniziare il Task 1 senza un esplicito via libera.

---

### Task 1: Infrastruttura di test, formati numerici, rata del mutuo

**Files:**
- Modify: `package.json` (devDependencies, script `test`, blocco `jest`)
- Create: `jest.setup.js`, `src/lib/format.ts`, `src/lib/mortgage.ts`
- Test: `src/lib/__tests__/format.test.ts`, `src/lib/__tests__/mortgage.test.ts`

**Interfaces:**
- Produces: `toNumber(value: string): number`, `parseFlexibleNumber(raw: string): number`, `formatCurrency(value: number): string`, `formatPercent(value: number): string` (copiati da App.tsx:2379–2418); `monthlyPayment(principal: number, annualRatePct: number, years: number): number` (da `calculateMortgagePayment`, App.tsx:3668).

- [ ] **Step 1:** `git switch -c feat/compratori` da `main`. `npx expo install jest-expo jest @types/jest -- --save-dev`; in `package.json` aggiungere `"test": "jest"` e `"jest": { "preset": "jest-expo", "setupFiles": ["./jest.setup.js"], "testPathIgnorePatterns": ["/node_modules/", "/android/", "/spike/"] }`. `jest.setup.js` mocka AsyncStorage con `require('@react-native-async-storage/async-storage/jest/async-storage-mock')`.
- [ ] **Step 2:** Scrivere i test falliti:
```ts
test("parseFlexibleNumber legge i formati italiani", () => {
  expect(parseFlexibleNumber("1.250.000")).toBe(1250000);
  expect(parseFlexibleNumber("41,8")).toBe(41.8);
  expect(parseFlexibleNumber("3.950 €/m²")).toBe(3950);
  expect(parseFlexibleNumber("€ 267/mese")).toBe(267);
  expect(parseFlexibleNumber("")).toBe(0);
});
test("toNumber", () => expect(toNumber("1.234,56")).toBe(1234.56));
test("formatCurrency", () => expect(formatCurrency(1234)).toMatch(/1\.234\s?€/));
test("monthlyPayment", () => {
  expect(monthlyPayment(200000, 3.5, 25)).toBeCloseTo(1001.25, 2);
  expect(monthlyPayment(120000, 0, 10)).toBe(1000);
  expect(monthlyPayment(0, 3, 20)).toBe(0);
  expect(monthlyPayment(100000, 3, 0)).toBe(0);
});
```
- [ ] **Step 3:** `npx jest src/lib` → FAIL (moduli mancanti).
- [ ] **Step 4:** Copiare le funzioni nei due file, invariate salvo il rename in `monthlyPayment`.
- [ ] **Step 5:** `npx jest src/lib` → PASS; `npx tsc --noEmit` senza nuovi errori rispetto al punto di partenza (annotare quelli già presenti).
- [ ] **Step 6:** Commit di `package.json package-lock.json jest.setup.js src/lib`.

---

### Task 2: Tipi condivisi e lettura di `__NEXT_DATA__`

**Files:**
- Create: `src/lib/types.ts`, `src/lib/listing/nextData.ts`, `src/lib/listing/__fixtures__/immobiliare-next-data.json`
- Test: `src/lib/listing/__tests__/nextData.test.ts`

**Interfaces:**
- Produces in `types.ts`:
```ts
export type Condition = "pronto" | "abitabile" | "da_rinfrescare" | "da_ristrutturare";
export type Issue = "not_a_sale" | "price_missing" | "sqm_missing" | "city_missing" | "sqm_implausible";
export type ListingData = {
  source: "nextData" | "text" | "manual"; url?: string;
  listingKey: string;                    // dedupe: "immobiliare:<id>", URL senza query, "text:<hash>", "manual:<hash>"
  contract: "sale" | "rent" | "unknown";
  title: string; propertyType: string;   // minuscolo: "appartamento", "bilocale"
  price: number | null; sqm: number | null;
  rooms: number | null; bedrooms: number | null; bathrooms: number | null;
  floor: string; condition: Condition | null;
  hasElevator: boolean | null; hasGarage: boolean | null;
  condoMonthly: number | null; energyClass: string;
  city: string; province: string; zone: string;   // province = sigla ("BS")
  lat: number | null; lng: number | null;
};
```
- Produces in `nextData.ts`: `parseNextData(json: string, url?: string): ListingData | null`; `conditionFromPortalLabel(label: string): Condition | null`.

Percorsi nel JSON (osservati sul file reale `immobiliare-test.html`): `props.pageProps.detailData.realEstate` → `id`, `contract` ("sale"), `title`, `price.value`, `typology.name`, e in `properties[0]`: `surface` ("200 m²"), `rooms`, `bedRoomsNumber`, `bathrooms`, `floor.floorOnlyValue`, `elevator`, `garage` (testo, es. "1 in parcheggio/garage comune"), `condition` ("Buono / Abitabile"), `costs.condominiumExpenses` ("€ 267/mese"), `energy.class.name`, `location.{city, provinceId, macrozone, microzone, latitude, longitude}`. `zone` = `microzone`, altrimenti `macrozone`.

- [ ] **Step 1:** Generare il fixture con uno script node fuori dal repo (percorso del file come argomento): estrarre `<script id="__NEXT_DATA__">` da `immobiliare-test.html` e salvare **solo** i campi sopra, nella stessa struttura annidata, senza inserzionista, foto, descrizione. Il fixture è l'unico file derivato dalla pagina da committare.
- [ ] **Step 2:** Test falliti:
```ts
const fx = require("../__fixtures__/immobiliare-next-data.json");
test("annuncio reale", () => {
  expect(parseNextData(JSON.stringify(fx))).toMatchObject({
    source: "nextData", listingKey: "immobiliare:123353645", contract: "sale",
    price: 790000, sqm: 200, rooms: 4, bedrooms: 3, bathrooms: 2, condition: "abitabile",
    hasElevator: true, hasGarage: true, condoMonthly: 267, energyClass: "A2",
    city: "Brescia", province: "BS", zone: "Loggia - Garibaldi",
    lat: 45.5378, lng: 10.212, propertyType: "appartamento" });
});
test("affitto", () => {
  const rent = { ...fx, props: { pageProps: { detailData: { realEstate: { ...fx.props.pageProps.detailData.realEstate, contract: "rent" } } } } };
  expect(parseNextData(JSON.stringify(rent))?.contract).toBe("rent");
});
test("pagina senza dati o JSON rotto → null", () => {
  expect(parseNextData('{"props":{"pageProps":{}}}')).toBeNull();
  expect(parseNextData("<html>captcha</html>")).toBeNull();
});
test.each([["Nuovo / In costruzione","pronto"],["Ottimo / Ristrutturato","pronto"],["Buono / Abitabile","abitabile"],["Da ristrutturare","da_ristrutturare"],["",null]])(
  "stato %s", (label, expected) => expect(conditionFromPortalLabel(label)).toBe(expected));
```
- [ ] **Step 3:** `npx jest src/lib/listing` → FAIL.
- [ ] **Step 4:** Implementare. `conditionFromPortalLabel`: `da ristrutturare` → `da_ristrutturare`; `nuov|ottimo|ristrutturat` → `pronto`; `buono|abitabile` → `abitabile`; altrimenti `null` (l'ordine conta: "Ottimo / Ristrutturato" non deve cadere in `da_ristrutturare`). Numeri con `parseFlexibleNumber`; campi mancanti → `null` o `""`, mai eccezioni.
- [ ] **Step 5:** `npx jest src/lib/listing` → PASS. Commit.

---

### Task 3: Parser del testo incollato, controlli, `readListing`

**Files:**
- Create: `src/lib/listing/text.ts` (e file per argomento se utile), `src/lib/listing/check.ts`, `src/lib/listing/index.ts`, `src/lib/listing/__fixtures__/text-cases.ts`
- Test: `src/lib/listing/__tests__/text.test.ts`, `check.test.ts`, `index.test.ts`

**Interfaces:**
- Consumes: `ListingData`, `Issue`, `parseNextData`, `parseFlexibleNumber`.
- Produces:
```ts
export function parseListingText(text: string, url?: string): ListingData;
export function checkListing(l: ListingData): { blocking: Issue[]; warnings: Issue[] };
export type ListingSource = { kind: "nextData"; json: string; url?: string } | { kind: "text"; text: string; url?: string };
export function readListing(src: ListingSource): ListingData | null;   // null se non c'è nulla di usabile
export function manualListing(i: { price: number; sqm: number; city: string; province: string; condition: Condition | null }): ListingData;
```

- [ ] **Step 1:** Copiare `buildFormPatchFromText` (App.tsx:4786) **con ogni funzione e costante che richiama, in modo transitivo** (cercarle con grep: `extractTitle`, `parseCondition`, `normalizeSpeechPhrase`, `extractType`, `extractFloor`, `extractSqm`, `extractBedrooms`, `extractBathrooms`, `extractMoneyCandidates`, `pickMoneyCandidate`, `extractCityZone`, `extractProvince`, `extractBooleanFeature`, `extractGarageFeature` e le liste `LISTING_TEXT_*`, `LOCATION_STOP_WORDS`, `PROPERTY_TYPES`…). La copia è fedele: nessuna correzione al comportamento. Si butta tutto ciò che riguarda `goal`, `resalePrice`, `monthlyRent`, `PropertyForm` e voce; l'uscita diventa `ListingData` (`source: "text"`, `contract: "unknown"`, `listingKey: "text:" + hash djb2 del testo normalizzato`).
- [ ] **Step 2:** Fixture `text-cases.ts` = i casi `immobiliare-description`, `tecnocasa-roma`, `toscano-brescia` di `DEV_OCR_REGRESSION_CASES` (App.tsx:1938–2041), con `expected` convertiti in numeri e senza `monthlyRent`. I casi `immobiliare-card` e `immobiliare-features` si **escludono**: testano rumore tipico dell'OCR (es. "242m²" letto al posto di "42"), che l'app non ha più.
- [ ] **Step 3:** Test:
```ts
test.each(textCases)("$label", ({ ocrText, expected }) => {
  expect(parseListingText(ocrText)).toMatchObject(expected);
});
test("testo pulito", () => {
  const l = parseListingText("Trilocale in vendita a Milano, zona Lambrate. Prezzo 340.000 €. 85 m². Da ristrutturare.");
  expect(l).toMatchObject({ price: 340000, sqm: 85, condition: "da_ristrutturare" });
});
// check.test.ts
const base = { price: 200000, sqm: 80, city: "Milano", contract: "sale" } as ListingData;
test("blocking", () => {
  expect(checkListing({ ...base, price: null }).blocking).toContain("price_missing");
  expect(checkListing({ ...base, sqm: null }).blocking).toContain("sqm_missing");
  expect(checkListing({ ...base, city: "" }).blocking).toContain("city_missing");
  expect(checkListing({ ...base, contract: "rent" }).blocking).toContain("not_a_sale");
  expect(checkListing(base).blocking).toEqual([]);
});
test("metri quadri assurdi → avviso, non blocco", () => {
  for (const sqm of [5, 4200]) expect(checkListing({ ...base, sqm }).warnings).toContain("sqm_implausible");
  expect(checkListing({ ...base, sqm: 80 }).warnings).toEqual([]);
});
// index.test.ts
test("readListing", () => {
  expect(readListing({ kind: "nextData", json: "<html>captcha</html>" })).toBeNull();
  expect(readListing({ kind: "text", text: "boh" })).toBeNull();
  expect(readListing({ kind: "text", text: "Bilocale Roma 249.000 € 48 m²" })?.price).toBe(249000);
});
test("manualListing", () => {
  const a = manualListing({ price: 1, sqm: 2, city: "A", province: "B", condition: null });
  expect(a.source).toBe("manual");
  expect(manualListing({ price: 1, sqm: 2, city: "A", province: "B", condition: null }).listingKey).toBe(a.listingKey);
  expect(manualListing({ price: 9, sqm: 2, city: "A", province: "B", condition: null }).listingKey).not.toBe(a.listingKey);
});
```
- [ ] **Step 4:** `npx jest src/lib/listing` → FAIL. Implementare `check.ts` (`sqm_implausible` se `sqm < 10 || sqm > 1000`) e `index.ts` (`readListing`: per `nextData` chiama `parseNextData`; per `text` chiama `parseListingText` e restituisce `null` se `price`, `sqm` e `city` sono tutti vuoti).
- [ ] **Step 5:** `npx jest src/lib/listing` → PASS. Se un caso del Step 2 fallisce dopo una copia fedele, marcarlo `it.skip` con il motivo scritto accanto: non si ritocca il parser per farlo passare. Commit.

---

### Task 4: Script che trasforma i CSV OMI in JSON

**Files:**
- Create: `scripts/build-omi.js` (CommonJS: gira sia con `node` sia sotto jest, e non importa codice TypeScript), `scripts/__tests__/build-omi.test.ts`, `scripts/__fixtures__/valori-sample.csv`, `scripts/__fixtures__/zone-sample.csv`, `src/data/omi.json`
- Modify: `src/lib/types.ts` (aggiungere `Range`, `OmiState`, `OmiZone`, `OmiComune`, `OmiData`)

**Interfaces:**
- Produces in `types.ts`:
```ts
export type Range = { min: number; max: number };
export type OmiState = "ottimo" | "normale" | "scadente";
export type OmiZone = { code: string; description: string; sale: Partial<Record<OmiState, Range>>; rent: Partial<Record<OmiState, Range>> };  // sale €/mq, rent €/mq/mese
export type OmiComune = { istat: string; name: string; province: string; zones: OmiZone[] };
export type OmiData = { semester: string; comuni: Record<string, OmiComune> };   // chiave: nome del comune come nel CSV + "|" + SIGLA, es. "Milano|MI"
```
- Produces: `buildOmi(valoriCsv: string, zoneCsv: string, semester: string): OmiData` (`module.exports` di `scripts/build-omi.js`) e uso da riga di comando `node scripts/build-omi.js --valori <csv> --zone <csv> --semester 2025-S2 --out src/data/omi.json` (la parte CLI parte solo se `require.main === module`).

Colonne dei file (dal repository `ondata/quotazioni-immobiliari-agenzia-entrate`): VALORI = `Area_territoriale, Regione, Prov, Comune_ISTAT, Comune_cat, Sez, Comune_amm, Comune_descrizione, Fascia, Zona, LinkZona, Cod_Tip, Descr_Tipologia, Stato, Stato_prev, Compr_min, Compr_max, Sup_NL_compr, Loc_min, Loc_max, Sup_NL_loc`; ZONE = `…, Zona_Descr, Zona, LinkZona, …, Microzona`.

- [ ] **Step 1 (serve un file vero):** ottenere i CSV reali. Il download ufficiale richiede un accesso Fisconline/Entratel; il repository `ondata/quotazioni-immobiliari-agenzia-entrate` ripubblica `data/valori.7z` e `data/zone.7z`. Se non si riescono a ottenere, chiedere i file all'utente. Il separatore va rilevato dalla riga di intestazione. Estrarre in una cartella nuova e vuota, **fuori dal repo**.
- [ ] **Step 2:** Creare i fixture `*-sample.csv` copiando intestazione e poche righe reali di un solo comune (quattro zone, stati OTTIMO/NORMALE/SCADENTE dove presenti). Nessuna riga inventata.
- [ ] **Step 3:** Test: `buildOmi(sampleValori, sampleZone, "2025-S2")` produce `comuni["<Nome>|<SIGLA>"]` (nome come nel CSV) con `zones.length === 4`, per ogni zona `sale.normale.min <= sale.normale.max`, `rent.normale` presente, e solo righe di tipologia "Abitazioni civili" (verificare il valore esatto di `Descr_Tipologia` sul file reale e usarlo nel test). Una riga con `Compr_min` vuoto non fa saltare lo script: l'intervallo manca.
- [ ] **Step 4:** `npx jest scripts` → FAIL. Implementare `build-omi.js` (nessuna normalizzazione dei nomi: la fa `lookupMarket` al momento della ricerca, Task 5).
- [ ] **Step 5:** `npx jest scripts` → PASS. Eseguire lo script sui CSV reali e scrivere `src/data/omi.json`. Misurare la dimensione: **se supera 10 MB, riferire all'utente prima di andare avanti.**
- [ ] **Step 6:** Commit di script, fixture e tipi. **`src/data/omi.json` non si committa** finché la licenza OMI non è chiarita (Task 19): aggiungerlo a `.git/info/exclude`.

---

### Task 5: Ricerca del riferimento di mercato

**Files:**
- Create: `src/lib/market.ts`
- Test: `src/lib/__tests__/market.test.ts`

**Interfaces:**
- Consumes: `OmiData`, `Range`, `OmiState`.
- Produces:
```ts
export type MarketReference = { label: string; precision: "zona" | "comune"; sale: Partial<Record<OmiState, Range>>; rent: Partial<Record<OmiState, Range>>; semester: string };
export function lookupMarket(omi: OmiData, q: { city: string; province: string; zone: string }): MarketReference | null;
```
Regole: `normalizeName(s)` (definita e testata in `market.ts`) = minuscolo, senza accenti, apostrofi e punteggiatura, spazi compressi. Al primo uso su un dato `OmiData` si costruisce un indice (in una `WeakMap`) con i nomi dei comuni normalizzati; comune = `normalizeName(city)` + sigla `province.toUpperCase()` (senza sigla, vale il nome solo se è univoco). La zona si abbina se tutte le parole (≥3 lettere) del nome più corto compaiono nel più lungo. Senza zona o senza abbinamento: intervallo del comune = mediana dei `min` e mediana dei `max` delle zone, per ogni stato presente. `label`: "zona Lambrate, Milano" oppure "comune di Milano".

- [ ] **Step 1:** Test falliti, con un `OmiData` scritto a mano (chiavi come nel CSV, es. `"Milano|MI"`, `"Forlì|FC"`) per Milano (MI): "Centro storico" vendita normale 6000–8000, "Lambrate" 3500–4500, "Periferia" 2000–3000, "Navigli" 4500–5500, affitto normale 15–20, 10–14, 7–9, 12–16:
```ts
test("zona trovata", () => {
  const m = lookupMarket(omi, { city: "Milano", province: "MI", zone: "Lambrate" });
  expect(m).toMatchObject({ precision: "zona", sale: { normale: { min: 3500, max: 4500 } } });
  expect(m!.label).toContain("Lambrate");
});
test("senza zona → mediana del comune", () => {
  const m = lookupMarket(omi, { city: "Milano", province: "MI", zone: "" });
  expect(m).toMatchObject({ precision: "comune", sale: { normale: { min: 4000, max: 5000 } } });
});
test("zona sconosciuta → comune", () =>
  expect(lookupMarket(omi, { city: "Milano", province: "MI", zone: "Zona Inesistente" })?.precision).toBe("comune"));
test("accenti e maiuscole", () => {
  expect(lookupMarket(omiForli, { city: "FORLÌ", province: "fc", zone: "" })).not.toBeNull();
});
test("comune assente → null", () =>
  expect(lookupMarket(omi, { city: "Atlantide", province: "XX", zone: "" })).toBeNull());
```
- [ ] **Step 2:** `npx jest src/lib/__tests__/market.test.ts` → FAIL. **Step 3:** Implementare. **Step 4:** PASS. **Step 5:** Commit.

---

### Task 6: Parametri fiscali e costi di acquisto

**Files:**
- Create: `src/lib/fiscal.ts`
- Test: `src/lib/__tests__/fiscal.test.ts`

**Interfaces:**
- Produces:
```ts
export type Param<T> = { value: T; source: string; verifiedAt: string | null };
export type FiscalTable = {
  registroPctPrimaCasa: Param<number>; registroPctSeconda: Param<number>; registroMinimo: Param<number>;
  ipotecariaCatastaleFisse: Param<number>;   // € totali
  agencyPct: Param<number>;                  // % del prezzo, IVA inclusa
  notaryEstimate: Param<number>;             // € forfait
  cedolareLongTermPct: Param<number>; cedolareShortTermPct: Param<number>;
};
export const FISCAL_DEFAULTS: FiscalTable;
export type Acquisition = { registro: number; ipotecariaCatastale: number; agency: number; notary: number; total: number; outlay: number };  // total = solo costi extra; outlay = prezzo + total
export function acquisitionCosts(i: { price: number; firstHome: boolean }, t: FiscalTable): Acquisition;
```
Scelta: l'imposta di registro si calcola sul **prezzo** (acquisto da privato, senza il "prezzo-valore"): sovrastima, e la UI lo dice.

- [ ] **Step 1:** Test falliti con una tabella di prova (registro 2 / 9, minimo 1000, ipotecaria+catastale 100, agenzia 3.66, notaio 2500, cedolare 21 / 21):
```ts
test("prima casa", () => expect(acquisitionCosts({ price: 200000, firstHome: true }, T))
  .toEqual({ registro: 4000, ipotecariaCatastale: 100, agency: 7320, notary: 2500, total: 13920, outlay: 213920 }));
test("seconda casa", () => expect(acquisitionCosts({ price: 200000, firstHome: false }, T).registro).toBe(18000));
test("minimo di registro", () => expect(acquisitionCosts({ price: 30000, firstHome: true }, T).registro).toBe(1000));
test("prezzo zero → tutti zero, nessun NaN", () => {
  const a = acquisitionCosts({ price: 0, firstHome: true }, T);
  expect(Object.values(a).every(Number.isFinite)).toBe(true);
});
test("ogni parametro ha una fonte", () => {
  for (const p of Object.values(FISCAL_DEFAULTS)) {
    expect(p.source.length).toBeGreaterThan(0);
    expect(p.verifiedAt === null || /^\d{4}-\d{2}-\d{2}$/.test(p.verifiedAt)).toBe(true);
  }
});
```
Con `price: 0` il minimo di registro non si applica (tutti i costi proporzionali a zero, `registro` 0).
- [ ] **Step 2:** FAIL. **Step 3:** Implementare `acquisitionCosts`.
- [ ] **Step 4:** Compilare `FISCAL_DEFAULTS` **cercando ogni valore sulle pagine ufficiali** (Agenzia delle Entrate, tabelle notarili pubblicate, ecc.) con `WebSearch`/`WebFetch`: `source` = URL, `verifiedAt` = data di oggi. Un valore non verificabile resta con `verifiedAt: null`. Riportare all'utente l'elenco di quelli non verificati.
- [ ] **Step 5:** PASS. Commit.

---

### Task 7: Costi di ristrutturazione e arredo

**Files:**
- Create: `src/lib/costs.ts`
- Modify: `src/lib/types.ts` (aggiungere `Usage`)
- Test: `src/lib/__tests__/costs.test.ts`

**Interfaces:**
- Produces:
```ts
export type Usage = "live" | "longTerm" | "students" | "airbnb";   // in types.ts
export type RenovationLevel = "nessuno" | "leggero" | "medio" | "pesante";
export type CostTable = {
  renovationPerSqm: { leggero: Param<number>; medio: Param<number>; pesante: Param<number> };
  furnishing: { studentRoomKit: Param<number> /* per camera */; airbnbPerSqm: Param<number> };
};
export const COST_DEFAULTS: CostTable;
export function renovationLevelFor(c: Condition | null): RenovationLevel;   // pronto→nessuno, abitabile→leggero, da_rinfrescare→medio, da_ristrutturare→pesante, null→nessuno
export function renovationCost(sqm: number, level: RenovationLevel, t: CostTable): number;
export function furnishingCost(usage: Usage, i: { sqm: number; bedrooms: number }, t: CostTable): number;  // live e longTerm = 0
```
- [ ] **Step 1:** Test falliti con tabella di prova (leggero 150, medio 400, pesante 900; kit studente 1200; Airbnb 300 al mq):
```ts
expect(renovationCost(80, "pesante", T)).toBe(72000);
expect(renovationCost(80, "nessuno", T)).toBe(0);
expect(renovationCost(0, "pesante", T)).toBe(0);
expect(renovationLevelFor("da_rinfrescare")).toBe("medio");
expect(renovationLevelFor(null)).toBe("nessuno");
expect(furnishingCost("students", { sqm: 100, bedrooms: 3 }, T)).toBe(3600);
expect(furnishingCost("students", { sqm: 30, bedrooms: 0 }, T)).toBe(1200);   // monolocale = 1 camera
expect(furnishingCost("airbnb", { sqm: 100, bedrooms: 3 }, T)).toBe(30000);
expect(furnishingCost("live", { sqm: 100, bedrooms: 3 }, T)).toBe(0);
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementare (camere studenti = `Math.max(1, bedrooms)`). **Step 4:** Compilare `COST_DEFAULTS` con valori e **fonti citate** (prezzari, guide di settore) come nel Task 6; non verificabile → `verifiedAt: null`. **Step 5:** PASS (compreso un test "ogni parametro ha una fonte" come nel Task 6). Commit.

---

### Task 8: Gli usi dell'immobile

**Files:**
- Create: `src/lib/strategies.ts`
- Test: `src/lib/__tests__/strategies.test.ts`

**Interfaces:**
- Consumes: `Usage`, `FiscalTable` (`cedolareLongTermPct`, `cedolareShortTermPct`).
- Produces:
```ts
export type Assumptions = {
  vacancyMonthsLongTerm: number; vacancyMonthsStudents: number;
  imuPctOfPriceYear: number; maintenancePctOfPriceYear: number;
  studentRoomFactor: number; studentUtilitiesPerRoomMonthly: number;
  airbnbNightlyRate: number | null;          // null = affitto lungo termine mensile / 10
  airbnbOccupancyPct: number; airbnbPlatformFeePct: number;
  airbnbCleaningPerStay: number; airbnbAvgStayNights: number; airbnbUtilitiesMonthly: number;
};
export const DEFAULT_ASSUMPTIONS: Assumptions;   // tutte "ipotesi", vedi tabella
export type StrategyInput = { price: number; sqm: number; bedrooms: number; firstHome: boolean; outlay: number; renovation: number; furnishing: number; condoMonthly: number; rentSqm: number; mortgageMonthly: number };
export type StrategyResult = { usage: Usage; monthlyIncome: number; monthlyCosts: number; annualTax: number; annualNet: number; netYieldPct: number; monthlyCashflow: number; warnings: string[] };
export function evaluateStrategy(usage: Usage, i: StrategyInput, a: Assumptions, f: FiscalTable): StrategyResult;
```
**Valori iniziali di `DEFAULT_ASSUMPTIONS` (ipotesi mie, modificabili in UI):** vacanza lungo termine 1 mese/anno, studenti 2; IMU 0,4% del prezzo/anno; manutenzione 0,5% del prezzo/anno; fattore camera studenti 1,3; utenze studenti 40 €/camera/mese; Airbnb: tariffa `null` (= affitto/10 a notte), occupazione 55%, commissione piattaforma 3%, pulizia 40 € a soggiorno, soggiorno medio 3 notti, utenze 150 €/mese.

**Formule** (mensili salvo dove detto; `rent = rentSqm × sqm`; `imu = price × imuPct/100/12`; `maint = price × maintPct/100/12`; `investment = outlay + renovation + furnishing`):
- **live:** reddito = `rent` (affitto risparmiato); costi = `condo + maint + (firstHome ? 0 : imu)`; tassa 0.
- **longTerm:** reddito = `rent − rent×vacancyMonths/12`; costi = `condo + imu + maint`; tassa annua = `cedolareLongTerm% × reddito×12`.
- **students:** camere = `max(1, bedrooms)`; lordo = `rent/camere × studentRoomFactor × camere`; reddito = lordo meno vacanza come sopra (mesi studenti); costi = `condo + imu + maint + camere × utenze`; tassa con cedolare lungo termine.
- **airbnb:** tariffa = `airbnbNightlyRate ?? rent/10`; reddito = `tariffa × 30 × occupazione%`; costi = `condo + imu + maint + utenze + reddito×commissione% + (30×occupazione%/soggiorno) × pulizia`; tassa = `cedolareShortTerm% × reddito×12`.
- Comuni: `annualNet = (reddito − costi)×12 − tassa`; `netYieldPct = investment > 0 ? annualNet/investment×100 : 0`; `monthlyCashflow = annualNet/12 − mortgageMonthly`.
- Avvertenze (testo libero, ma devono contenere): airbnb → "CIN" e "limiti del comune"; students → "università"; `rentSqm <= 0` → "nessun riferimento di affitto" e reddito 0.

- [ ] **Step 1:** Test falliti. Input: `{ price: 200000, sqm: 100, bedrooms: 3, firstHome: true, outlay: 220000, renovation: 0, furnishing: 20000, condoMonthly: 100, rentSqm: 10, mortgageMonthly: 900 }`, `DEFAULT_ASSUMPTIONS`, cedolare 21 / 21:
```ts
const r = (u) => evaluateStrategy(u, input, DEFAULT_ASSUMPTIONS, T);
expect(r("longTerm")).toMatchObject({ annualTax: 2310, annualNet: 5690 });
expect(r("longTerm").monthlyIncome).toBeCloseTo(916.67, 2);
expect(r("longTerm").monthlyCosts).toBeCloseTo(250, 2);
expect(r("longTerm").netYieldPct).toBeCloseTo(2.371, 3);
expect(r("longTerm").monthlyCashflow).toBeCloseTo(-425.83, 2);
expect(r("students")).toMatchObject({ annualTax: 2730, annualNet: 5830 });
expect(r("students").monthlyCosts).toBeCloseTo(370, 2);
expect(r("students").warnings.join(" ")).toMatch(/università/);
expect(r("airbnb")).toMatchObject({ monthlyIncome: 1650, annualTax: 4158, annualNet: 7608 });
expect(r("airbnb").monthlyCosts).toBeCloseTo(669.5, 2);
expect(r("airbnb").netYieldPct).toBeCloseTo(3.17, 2);
expect(r("airbnb").warnings.join(" ")).toMatch(/CIN/);
expect(r("live")).toMatchObject({ monthlyIncome: 1000, annualTax: 0, annualNet: 9800 });
expect(r("live").monthlyCosts).toBeCloseTo(183.33, 2);
expect(r("live").monthlyCashflow).toBeCloseTo(-83.33, 2);
test("monolocale = 1 camera per studenti", () =>
  expect(evaluateStrategy("students", { ...input, bedrooms: 0 }, DEFAULT_ASSUMPTIONS, T).monthlyIncome).toBeGreaterThan(0));
test("senza riferimento di affitto", () => {
  for (const u of ["live","longTerm","students","airbnb"] as const) {
    const x = evaluateStrategy(u, { ...input, rentSqm: 0, outlay: 0, renovation: 0, furnishing: 0 }, DEFAULT_ASSUMPTIONS, T);
    expect(x.monthlyIncome).toBe(0);
    expect(x.warnings.join(" ")).toMatch(/riferimento/);
    expect(Number.isFinite(x.netYieldPct)).toBe(true);
  }
});
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementare con le formule sopra. **Step 4:** PASS. **Step 5:** Commit.

---

### Task 9: Verdetto sul prezzo

**Files:**
- Create: `src/lib/verdict.ts`
- Test: `src/lib/__tests__/verdict.test.ts`

**Interfaces:**
- Consumes: `MarketReference`, `Condition`, `Range`, `OmiState`.
- Produces:
```ts
export type Verdict = { level: "sotto" | "in_linea" | "sopra"; gapPct: number; pricePerSqm: number; reference: Range & { mid: number; state: OmiState }; label: string };
export function omiStateFor(c: Condition | null): OmiState;   // pronto→ottimo, da_ristrutturare→scadente, altri e null→normale
export function buildVerdict(i: { price: number | null; sqm: number | null; condition: Condition | null }, m: MarketReference | null): Verdict | null;
```
Regole: stato OMI da `omiStateFor` con ripiego su `normale` se manca; `mid = (min+max)/2`; `gapPct = (€/mq − mid)/mid×100`; `sotto` se €/mq < min, `sopra` se > max, altrimenti `in_linea` (estremi inclusi). `null` se manca il riferimento di vendita o prezzo/metri quadri sono ≤ 0 o assenti.

- [ ] **Step 1:** Test falliti con `m.sale = { ottimo: 4500–6000, normale: 3500–4500, scadente: 2500–3300 }`, `sqm: 85`:
```ts
expect(buildVerdict({ price: 340000, sqm: 85, condition: "abitabile" }, m)).toMatchObject({ level: "in_linea", gapPct: 0, pricePerSqm: 4000 });
expect(buildVerdict({ price: 255000, sqm: 85, condition: "abitabile" }, m)).toMatchObject({ level: "sotto", gapPct: -25 });
expect(buildVerdict({ price: 425000, sqm: 85, condition: "abitabile" }, m)).toMatchObject({ level: "sopra", gapPct: 25 });
expect(buildVerdict({ price: 255000, sqm: 85, condition: "da_ristrutturare" }, m)!.reference.state).toBe("scadente");
expect(buildVerdict({ price: 297500, sqm: 85, condition: "abitabile" }, m)!.level).toBe("in_linea");   // 3500 = min, estremo incluso
expect(buildVerdict({ price: 0, sqm: 85, condition: null }, m)).toBeNull();
expect(buildVerdict({ price: null, sqm: 85, condition: null }, m)).toBeNull();
expect(buildVerdict({ price: 340000, sqm: 85, condition: null }, null)).toBeNull();
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementare. **Step 4:** PASS. **Step 5:** Commit.

---

### Task 10: `analyzeListing`, che mette insieme tutto

**Files:**
- Create: `src/lib/analysis.ts`
- Test: `src/lib/__tests__/analysis.test.ts`

**Interfaces:**
- Consumes: tutto dai Task 2–9 (`checkListing`, `lookupMarket`, `buildVerdict`, `acquisitionCosts`, `renovationLevelFor`, `renovationCost`, `furnishingCost`, `evaluateStrategy`, `monthlyPayment`).
- Produces:
```ts
export type AnalysisSettings = { firstHome: boolean; downPaymentPct: number; ratePct: number; years: number; manualRentSqm: number | null; renovationOverride: number | null; assumptions: Assumptions };
export const DEFAULT_SETTINGS: AnalysisSettings;   // firstHome true, anticipo 20, tasso 3.5 (ipotesi), 25 anni
export type Analysis =
  | { kind: "unsupported"; reason: Issue }
  | { kind: "ok"; listing: ListingData; market: MarketReference | null; verdict: Verdict | null; acquisition: Acquisition; renovation: number; mortgageMonthly: number; strategies: StrategyResult[]; totalToEnter: Record<Usage, number>; warnings: Issue[] };
export function analyzeListing(l: ListingData, s: AnalysisSettings, deps: { omi: OmiData; fiscal: FiscalTable; costs: CostTable }): Analysis;
```
Regole: se `checkListing` ha un blocco → `unsupported` con il primo. `rentSqm` = `manualRentSqm` oppure il punto medio di `market.rent.normale` (ripiego: il primo stato disponibile), altrimenti 0. `renovation` = `renovationOverride ?? renovationCost(sqm, renovationLevelFor(condition))`. Mutuo = `price × (1 − anticipo/100)`. `strategies` nell'ordine `live, longTerm, students, airbnb`, ciascuna con il proprio `furnishing`. `totalToEnter[u] = acquisition.outlay + renovation + furnishing(u)`.

- [ ] **Step 1:** Test falliti con un annuncio Milano (prezzo 200000, 100 mq, 3 camere, Lambrate), OMI di prova del Task 5, tabelle di prova dei Task 6–7:
```ts
const a = analyzeListing(listing, DEFAULT_SETTINGS, deps) as Extract<Analysis, { kind: "ok" }>;
expect(a.kind).toBe("ok");
expect(a.strategies.map((x) => x.usage)).toEqual(["live", "longTerm", "students", "airbnb"]);
expect(a.totalToEnter.airbnb).toBe(a.acquisition.outlay + a.renovation + 30000);
test("affitto → unsupported", () => expect(analyzeListing({ ...listing, contract: "rent" }, DEFAULT_SETTINGS, deps)).toEqual({ kind: "unsupported", reason: "not_a_sale" }));
test("prezzo mancante", () => expect(analyzeListing({ ...listing, price: null }, DEFAULT_SETTINGS, deps)).toEqual({ kind: "unsupported", reason: "price_missing" }));
test("comune assente dai dati", () => {
  const x = analyzeListing({ ...listing, city: "Atlantide", province: "XX" }, DEFAULT_SETTINGS, deps) as any;
  expect(x.market).toBeNull(); expect(x.verdict).toBeNull();
  expect(x.strategies.every((s: any) => s.monthlyIncome === 0)).toBe(true);
  expect(x.acquisition.total).toBeGreaterThan(0);      // i costi si vedono comunque
});
test("affitto a mano", () => {
  const x = analyzeListing({ ...listing, city: "Atlantide", province: "XX" }, { ...DEFAULT_SETTINGS, manualRentSqm: 10 }, deps) as any;
  expect(x.strategies.find((s: any) => s.usage === "longTerm").monthlyIncome).toBeGreaterThan(0);
});
test("anticipo 100% → rata 0", () =>
  expect((analyzeListing(listing, { ...DEFAULT_SETTINGS, downPaymentPct: 100 }, deps) as any).mortgageMonthly).toBe(0));
test("metri quadri assurdi → avviso", () =>
  expect((analyzeListing({ ...listing, sqm: 4200 }, DEFAULT_SETTINGS, deps) as any).warnings).toContain("sqm_implausible"));
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementare. **Step 4:** PASS; `npx tsc --noEmit`. **Step 5:** Commit.

---

### Task 11: Regole del contributo (3 gratis, poi un anno)

**Files:**
- Create: `src/lib/entitlement.ts`
- Test: `src/lib/__tests__/entitlement.test.ts`

**Interfaces:**
- Produces:
```ts
export const FREE_ANALYSES = 3;
export const ENTITLEMENT_DAYS = 365;
export type UsageState = { analyzedKeys: string[]; activeUntil: string | null };   // ISO; ultima scadenza nota da Play
export const emptyUsage: UsageState;
export function isActive(s: UsageState, now: Date): boolean;      // activeUntil nel futuro
export type Gate = { allowed: true; state: UsageState; freeLeft: number } | { allowed: false; state: UsageState; reason: "paywall" };
export function registerAnalysis(s: UsageState, listingKey: string, now: Date): Gate;
export function applyPurchase(s: UsageState, activeUntil: Date): UsageState;
```
`freeLeft` = analisi gratuite rimaste dopo questa (0 con abbonamento attivo non ha significato: restituire `Infinity` non serve, usare `0` e far decidere alla UI con `isActive`).

- [ ] **Step 1:** Test falliti (`now = new Date("2026-11-01")`):
```ts
let s = emptyUsage;
for (const [k, left] of [["a", 2], ["b", 1], ["c", 0]] as const) {
  const g = registerAnalysis(s, k, now); expect(g).toMatchObject({ allowed: true, freeLeft: left }); s = g.state;
}
expect(registerAnalysis(s, "d", now)).toMatchObject({ allowed: false, reason: "paywall" });
expect(registerAnalysis(s, "a", now).allowed).toBe(true);            // già analizzato: non conta
expect(registerAnalysis(s, "a", now).state.analyzedKeys).toHaveLength(3);
const paid = applyPurchase(s, new Date("2027-11-01"));
expect(isActive(paid, now)).toBe(true);
expect(registerAnalysis(paid, "d", now).allowed).toBe(true);
expect(registerAnalysis(paid, "d", new Date("2027-11-02")).allowed).toBe(false);   // scaduto
expect(isActive(emptyUsage, now)).toBe(false);
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementare (`registerAnalysis` non muta lo stato in ingresso; le chiavi non si duplicano). **Step 4:** PASS. **Step 5:** Commit.

---

### Task 12: Archivio e stato d'uso su disco

**Files:**
- Create: `src/lib/archive.ts`
- Test: `src/lib/__tests__/archive.test.ts`

**Interfaces:**
- Consumes: `ListingData`, `AnalysisSettings`, `UsageState`, `emptyUsage`.
- Produces:
```ts
export type SavedAnalysis = { id: string; savedAt: string; listing: ListingData; settings: AnalysisSettings };  // si salvano gli ingressi, il risultato si ricalcola
export function loadArchive(): Promise<SavedAnalysis[]>;         // più recente per primo
export function saveAnalysis(item: SavedAnalysis): Promise<void>; // stesso listing.listingKey → sostituisce
export function deleteAnalysis(id: string): Promise<void>;
export function loadUsage(): Promise<UsageState>;
export function saveUsage(s: UsageState): Promise<void>;
```
Chiavi AsyncStorage nuove: `affare_subito_v2_archive`, `affare_subito_v2_usage`. Le chiavi della v1 non si leggono né si cancellano.

- [ ] **Step 1:** Test falliti (mock AsyncStorage da `jest.setup.js`): salva e rileggi; salvare un secondo elemento con lo stesso `listingKey` lo sostituisce; ordine più recente prima; `deleteAnalysis`; JSON corrotto in archivio → `[]` e in usage → `emptyUsage`, senza eccezioni.
- [ ] **Step 2:** FAIL. **Step 3:** Implementare. **Step 4:** PASS. **Step 5:** Commit.

---

### Task 13: Adattatore Play Billing e sincronizzazione

**Files:**
- Create: `src/billing/billing.ts`, `src/billing/fakeBilling.ts`, `src/billing/playBilling.ts`, `src/lib/entitlementSync.ts`
- Modify: `package.json`, `app.json` (plugin della libreria scelta, se serve)
- Test: `src/lib/__tests__/entitlementSync.test.ts`

**Interfaces:**
- Consumes: `UsageState`, `applyPurchase`, `ENTITLEMENT_DAYS`.
- Produces:
```ts
export class BillingUnavailable extends Error {}
export const SKU_YEAR = "contributo_annuale";   // id prodotto da creare sulla Play Console (Task 19)
export interface Billing {
  getActiveUntil(): Promise<Date | null>;   // null = nessun acquisto attivo; BillingUnavailable se Play non risponde
  purchaseYear(): Promise<Date>;            // nuova scadenza
  restore(): Promise<Date | null>;
  localizedPrice(): Promise<string | null>; // es. "0,99 €", da Play
}
export function syncEntitlement(b: Billing, s: UsageState): Promise<UsageState>;
```
`syncEntitlement`: se `getActiveUntil()` dà una data → `activeUntil` = quella; se dà `null` → `activeUntil: null` (scaduto o rimborsato); se lancia `BillingUnavailable` → lo stato resta com'è (vale l'ultima scadenza nota fino alla sua data).

- [ ] **Step 1:** Test falliti con un `Billing` finto: data restituita → stato aggiornato; `null` → `activeUntil` azzerato; `BillingUnavailable` → stato identico; altri errori → si propagano.
- [ ] **Step 2:** FAIL. **Step 3:** Implementare `entitlementSync.ts` e `fakeBilling.ts` (scadenza in AsyncStorage, solo per debug). **Step 4:** PASS.
- [ ] **Step 5:** Scegliere la libreria per `playBilling.ts` tra `react-native-iap` e `expo-iap`, controllando sul loro repository la compatibilità con Expo 55 / React Native 0.83 e la manutenzione; scrivere la scelta nel messaggio di commit. Prodotto: abbonamento **prepagato** da 12 mesi (se la Play Console non lo consente, annuale a rinnovo automatico con scritta chiara). La scadenza si ricava così: acquisto attivo restituito da Play → `purchaseTime + ENTITLEMENT_DAYS`; nessun acquisto restituito → `null`. Non sono possibili test automatici: si verifica nel Task 19. Acquisto riconosciuto (acknowledge) subito dopo il pagamento.
- [ ] **Step 6:** `npx tsc --noEmit`; commit.

---

### Task 14: Ingresso con WebView e scala di ripieghi

**Files:**
- Create: `src/lib/listing/webviewMessage.ts`, `src/lib/listing/url.ts`, `src/components/ListingWebView.tsx`, `src/screens/InputScreen.tsx`, `src/app/AppRoot.tsx`
- Test: `src/lib/listing/__tests__/webviewMessage.test.ts`, `src/lib/listing/__tests__/url.test.ts`

**Interfaces:**
- Consumes: `readListing`, `ListingSource`, `checkListing`, `manualListing`.
- Produces: `parseWebViewMessage(raw: string): ListingSource | null` (messaggio con `{ url, nextData?: string, bodyText?: string, blocked?: boolean }`; `blocked` → `null`; con `nextData` → `{ kind: "nextData" }`; solo `bodyText` lungo → `{ kind: "text" }`; JSON rotto → `null`); `AppRoot` con un `Route` (`input | review | result | archive | compare | paywall`) e gestione del tasto indietro Android (`BackHandler`).

- [ ] **Step 1:** Test falliti. `parseWebViewMessage`: messaggio con `nextData` valido → `kind: "nextData"`; `blocked: true` → `null`; JSON rotto → `null`; né `nextData` né testo utile → `null`. `normalizeListingUrl` (copia di App.tsx:2732, `normalizeListingUrl(value: string): string | null`): `"esempio.it/annuncio/1"` → `"https://esempio.it/annuncio/1"`; `"  https://www.immobiliare.it/annunci/1/ "` → lo stesso senza spazi; `"ftp://x.it"` → `null`; `""` → `null`; `"non un link"` → `null`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementare. **Step 4:** PASS.
- [ ] **Step 5:** `ListingWebView` riprende la tecnica verificata nel Task 0 (stesse impostazioni WebView, script iniettato con attesa fino a 15 s; il messaggio di produzione è `{ url, nextData, bodyText, blocked }`, non quello dello spike). `InputScreen`: campo link (validato con `normalizeListingUrl`), pulsante "Analizza", WebView visibile durante il caricamento così l'utente può superare un controllo anti-bot. Scala: 1) `readListing` da WebView; 2) se `null` o con blocchi → "Non riesco a leggere questa pagina" con "Incolla il testo dell'annuncio" (poi `readListing` su testo); 3) se ancora con blocchi → mini-form (Task 15). Dopo 20 s senza messaggio → passa al passo 2 con lo stesso messaggio. Sempre visibile: "Inserisci i dati a mano".
- [ ] **Step 6:** Verifica sul telefono (`npm run android:debug:install`): annuncio leggibile → schermata di revisione; link inventato → messaggio e scala di ripieghi, nessuna schermata vuota; tasto indietro torna indietro. Commit.

---

### Task 15: Revisione dei dati e mini-form

**Files:**
- Create: `src/screens/ReviewScreen.tsx`, `src/components/ListingEditor.tsx`

- [ ] **Step 1:** `ListingEditor`: campi prezzo, metri quadri, camere, bagni, comune, provincia, zona, stato (quattro scelte), "è la tua prima casa?"; ogni modifica ricalcola `checkListing`. Il mini-form è lo stesso componente con solo prezzo, metri quadri, comune, stato.
- [ ] **Step 2:** `ReviewScreen`: mostra "Ho capito: <tipo> <mq> mq, <zona>, <prezzo>"; i blocchi (`not_a_sale`, `price_missing`, `sqm_missing`, `city_missing`) disattivano "Calcola" e spiegano perché in italiano semplice (`not_a_sale` = "Questo annuncio non è una vendita"); l'avviso `sqm_implausible` chiede conferma esplicita prima di proseguire.
- [ ] **Step 3:** "Calcola": `registerAnalysis(usage, listing.listingKey, now)` (Task 11) dopo `syncEntitlement` (Task 13); se `allowed: false` → rotta `paywall`; altrimenti `saveUsage(state)`, `saveAnalysis`, rotta `result`.
- [ ] **Step 4:** Verifica sul telefono: campi precompilati dall'annuncio; metri quadri 4200 → conferma richiesta; prezzo vuoto → "Calcola" spento con spiegazione; quarto annuncio nuovo → paywall; stesso annuncio di nuovo → risultato senza paywall. Commit.

---

### Task 16: Schermata del risultato e del contributo

**Files:**
- Create: `src/screens/ResultScreen.tsx`, `src/screens/PaywallScreen.tsx`, `src/components/StrategyCard.tsx`, `src/components/EstimateSlider.tsx`

- [ ] **Step 1:** Invocare `frontend-design:frontend-design` prima dello stile; partire dalla palette esistente (`#f5efe6` crema, accento `#9a3d14`).
- [ ] **Step 2:** `ResultScreen`: in alto il verdetto (`sotto / in linea / sopra`, percentuale, €/mq contro riferimento, etichetta di precisione "zona X" o "comune di Y", semestre OMI); poi "Quanto costa entrare" (prezzo, imposte, notaio, agenzia, ristrutturazione, arredo per uso); poi i quattro `StrategyCard` affiancabili con entrata, spese, tasse, resa netta, cashflow col mutuo e avvertenze; ogni cifra stimata ha l'etichetta "stima". `EstimateSlider` sulle ipotesi pertinenti a ciascun uso (studenti: fattore camera e vacanza; Airbnb: tariffa e occupazione; lungo termine: vacanza) e su ristrutturazione e affitto a mano; il risultato si ricalcola con `analyzeListing`. Senza riferimento di mercato: "Nessun riferimento di zona per questo comune" e campo per l'affitto al mq. In fondo: "Fonte: Agenzia Entrate - OMI", "Non è consulenza", e dove un parametro ha `verifiedAt: null`, "dato da verificare".
- [ ] **Step 3:** Se `freeLeft === 0` e il contributo non è attivo, sotto il verdetto: "Era la tua ultima analisi gratuita".
- [ ] **Step 4:** `PaywallScreen`: spiega in tre righe cosa si ottiene (analisi illimitate per 12 mesi), mostra il prezzo da `localizedPrice()` (ripiego "0,99 €"), pulsanti "Contribuisci" (`purchaseYear`), "Ripristina acquisto" (`restore`), "Non ora" (torna all'archivio); testo "I risultati già salvati restano consultabili". Dopo l'acquisto: `applyPurchase`, `saveUsage`, torna a `review` con il quarto annuncio.
- [ ] **Step 5:** Verifica sul telefono con `fakeBilling`: tutti i numeri del Task 8 si vedono, gli slider cambiano il verdetto/uso interessato, paywall al quarto annuncio, "Contribuisci" lo sblocca. Screenshot con `adb exec-out screencap -p`; **mostrarlo all'utente e chiedere conferma dello stile prima di proseguire.** Commit.

---

### Task 17: Archivio e confronto

**Files:**
- Create: `src/screens/ArchiveScreen.tsx`, `src/screens/CompareScreen.tsx`

- [ ] **Step 1:** `ArchiveScreen`: elenco più recente per primo (titolo, prezzo, etichetta del verdetto ricalcolata con `analyzeListing`), tocco → `result` **senza** passare dal conteggio; eliminazione con conferma; selezione di due elementi → `compare`. Funziona anche con contributo scaduto.
- [ ] **Step 2:** `CompareScreen`: due case affiancate: €/mq contro riferimento, costo per entrare, resa netta per uso; la migliore per riga in evidenza.
- [ ] **Step 3:** Verifica sul telefono: con 3 analisi esaurite e contributo non attivo, l'archivio si apre e si confronta; l'eliminazione non azzera le analisi gratuite già consumate. Commit.

---

### Task 18: Sostituire `App.tsx` e ripulire

**Files:**
- Modify: `App.tsx` (sostituito da una shell di poche righe che monta `AppRoot` dentro `SafeAreaProvider`), `package.json`, `package-lock.json`, `app.json`, `android/app/src/main/AndroidManifest.xml`
- Delete: nessun file dell'utente fuori da `src/`

- [ ] **Step 1:** Prima di sostituire `App.tsx`, `git tag pre-rewrite-v1` (locale) per ritrovare la v1.
- [ ] **Step 2:** `npm uninstall expo-speech expo-speech-recognition @react-native-ml-kit/text-recognition expo-image-picker`; togliere `"expo-speech-recognition"` da `plugins` in `app.json`. Mantenere `@react-native-community/slider` se `EstimateSlider` lo usa.
- [ ] **Step 3:** A mano nel manifest: togliere `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` e la `<intent>` con `android.speech.RecognitionService` e il `<package>` di Google Quick Search in `<queries>`; **non** toccare `build.gradle` né `gradle.properties`. Se la libreria di Play Billing richiede un permesso (`com.android.vending.BILLING`), tenerlo.
- [ ] **Step 4:** Verifica: `npx tsc --noEmit` e `npx jest` verdi; `grep -n "RECORD_AUDIO\|EXTERNAL_STORAGE\|RecognitionService" android/app/src/main/AndroidManifest.xml` senza risultati; `npm run android:debug:install` e giro completo sul telefono (link → revisione → risultato → archivio → confronto → paywall al quarto).
- [ ] **Step 5:** Commit per percorso.

---

### Task 19: Rilascio (parte con l'utente)

**Files:**
- Modify: `docs/index.html` (informativa privacy), `android/app/build.gradle` (`versionCode`, solo con l'accordo dell'utente)

- [ ] **Step 1:** Riscrivere `docs/index.html` mantenendo stile e struttura: l'app non invia l'annuncio a servizi AI; la WebView carica pagine di portali terzi; i dati restano sul telefono; gli acquisti sono gestiti da Google Play.
- [ ] **Step 2 (cancello licenza OMI):** controllare i termini correnti dell'Agenzia delle Entrate sul riuso dei dati OMI. Se non è chiaro che si possono ridistribuire in un'app, **fermarsi e riferire all'utente**; solo con via libera committare `src/data/omi.json` (togliendolo da `.git/info/exclude`) e verificare che l'attribuzione compaia nel risultato.
- [ ] **Step 3:** Verificare che ogni `Param` con `verifiedAt: null` in `FISCAL_DEFAULTS` e `COST_DEFAULTS` sia stato riportato all'utente.
- [ ] **Step 4 (serve l'utente):** sulla Play Console: profilo pagamenti, app, prodotto `contributo_annuale` da 0,99 € (prepagato 12 mesi, o rinnovo automatico se necessario), account tester con carta di prova. `npm run android:release:bundle` (serve `android/keystore.properties`), caricare l'AAB nel test interno, installare dal Play Store.
- [ ] **Step 5:** Provare con l'utente: tre analisi gratis, quarto bloccato, acquisto di prova, quarto sbloccato; reinstallazione e "Ripristina acquisto"; scadenza accelerata dei test Google: bloccato di nuovo. Aggiornare la scheda Play (testo, dichiarazioni sugli acquisti, `assets/store/`).
- [ ] **Step 6:** Commit; **chiedere all'utente** prima di pubblicare e prima di committare le modifiche Gradle e `assets/store/` che oggi non sono committate.

---

## Verifica finale della copertura dello spec

| Sezione dello spec | Task |
|---|---|
| Lettura del link con WebView, GATE | 0, 14 |
| Scala di ripieghi (link → testo → mini-form) | 3, 14, 15 |
| Parser, non AI; niente chiave | 2, 3 |
| Valore di mercato OMI, etichetta di precisione | 4, 5, 9, 16 |
| Parametri in tabelle con fonte | 6, 7, 8 |
| Costo per entrare (imposte, lavori, arredo) | 6, 7, 10, 16 |
| Quattro usi con ipotesi modificabili | 8, 10, 16 |
| Verdetto | 9, 16 |
| Contributo 3 gratis + 12 mesi, Play Billing | 11, 13, 15, 16, 19 |
| Archivio e confronto | 12, 17 |
| Pulizia moduli, permessi, `App.tsx` | 18 |
| Privacy, scheda Play, licenza OMI | 19 |
