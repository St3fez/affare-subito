import type { ListingData } from "../types";
import { readListing, type ListingSource } from "./index";
import { canonicalListingUrl } from "./url";

const MIN_USEFUL_TEXT = 200;

/**
 * Script che gira dentro la pagina dell'annuncio. Appena c'è `__NEXT_DATA__` (o, per le pagine senza, a caricamento
 * finito più 1,5 s) manda all'app `{ url, nextData, bodyText, blocked, coords }`; in ogni caso entro 12 s (più 3 se deve rileggere il sorgente).
 * `coords` è la posizione dell'immobile, se la pagina la dice: nei dati strutturati (schema.org) oppure, per tecnocasa.it, nel sorgente
 * della pagina (la pagina già composta non la ha più: Vue sostituisce il suo componente della mappa).
 * Scritto in JavaScript semplice (ES5) per le WebView più vecchie.
 */
export function buildExtractionScript(): string {
  return `(function () {
  if (window.__affareSubitoExtract) return;
  window.__affareSubitoExtract = true;
  var start = Date.now();
  var sent = false;
  var settleAt = null;
  function findCoords(raw) {
    var lat = /latitude["']?\\s*[:=]\\s*["']?(-?\\d{1,3}\\.\\d+)/i.exec(raw);
    var lng = /longitude["']?\\s*[:=]\\s*["']?(-?\\d{1,3}\\.\\d+)/i.exec(raw);
    return lat && lng ? { lat: parseFloat(lat[1]), lng: parseFloat(lng[1]) } : null;
  }
  function structuredCoords() {
    var found = null;
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length && !found; i++) found = findCoords(scripts[i].textContent || "");
    return found;
  }
  function send() {
    if (sent) return;
    sent = true;
    var body = (document.body && document.body.innerText) || "";
    var nd = document.getElementById("__NEXT_DATA__");
    var head = document.title + " " + body.slice(0, 2000);
    function post(coords) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        url: location.href,
        nextData: nd && nd.textContent ? nd.textContent : null,
        bodyText: body.slice(0, 20000),
        blocked: body.length < 3000 && /datadome|captcha|robot|verifica che sei|access denied|accesso negato/i.test(head),
        coords: coords
      }));
    }
    var coords = structuredCoords();
    if (coords || !/(^|\\.)tecnocasa\\.it$/.test(location.hostname) || typeof fetch !== "function") { post(coords); return; }
    var posted = false;
    function finish(found) { if (posted) return; posted = true; post(found); }
    setTimeout(function () { finish(null); }, 3000);
    fetch(location.href, { credentials: "same-origin" })
      .then(function (r) { return r.text(); })
      .then(function (raw) { finish(findCoords(raw)); }, function () { finish(null); });
  }
  var timer = setInterval(function () {
    if (sent) { clearInterval(timer); return; }
    if (document.getElementById("__NEXT_DATA__")) { clearInterval(timer); send(); return; }
    if (document.readyState === "complete") {
      if (settleAt === null) settleAt = Date.now() + 1500;
      else if (Date.now() >= settleAt) { clearInterval(timer); send(); return; }
    }
    if (Date.now() - start > 12000) { clearInterval(timer); send(); }
  }, 400);
})();
true;`;
}

/** La pagina chiede un controllo anti-robot: l'utente deve avere il tempo di completarlo. */
export function isBlockedMessage(raw: string): boolean {
  try {
    const message = JSON.parse(raw);
    return !!message && typeof message === "object" && message.blocked === true;
  } catch {
    return false;
  }
}

/** Il messaggio della pagina come fonte da leggere; `null` se la pagina è bloccata o non ha nulla di utile. */
export function parseWebViewMessage(raw: string): ListingSource | null {
  let message: any;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!message || typeof message !== "object" || message.blocked === true) return null;

  const url = typeof message.url === "string" ? message.url : undefined;
  if (typeof message.nextData === "string" && message.nextData.length > 0) {
    return { kind: "nextData", json: message.nextData, url };
  }
  if (typeof message.bodyText === "string" && message.bodyText.trim().length >= MIN_USEFUL_TEXT) {
    return { kind: "text", text: message.bodyText, url };
  }
  return null;
}

/**
 * Dal messaggio della pagina all'annuncio: prima i dati strutturati, poi il testo della pagina.
 * Per le fonti di testo la chiave viene dall'indirizzo, così lo stesso annuncio non conta due volte.
 */
export function listingFromWebViewMessage(raw: string): ListingData | null {
  const listing = readMessage(raw);
  return listing ? withCoords(listing, raw) : null;
}

// Un'Italia con un po' di margine: serve a scartare coordinate senza senso (0,0, un altro paese, valori fuori scala).
const ITALY = { latMin: 35, latMax: 48, lngMin: 6, lngMax: 19 };

/** La posizione mandata dalla pagina, se è un punto in Italia; i dati strutturati dell'annuncio, se la hanno, vincono. */
function withCoords(listing: ListingData, raw: string): ListingData {
  if (listing.lat != null && listing.lng != null) return listing;
  let coords: any;
  try {
    coords = JSON.parse(raw).coords;
  } catch {
    return listing;
  }
  const lat = coords?.lat;
  const lng = coords?.lng;
  const inItaly = typeof lat === "number" && typeof lng === "number" && lat >= ITALY.latMin && lat <= ITALY.latMax && lng >= ITALY.lngMin && lng <= ITALY.lngMax;
  return inItaly ? { ...listing, lat, lng } : listing;
}

function readMessage(raw: string): ListingData | null {
  const source = parseWebViewMessage(raw);
  if (!source) return null;

  if (source.kind === "nextData") {
    const structured = readListing(source);
    if (structured) return structured;

    // Dati di Next.js in un formato che non conosciamo (per esempio casa.it): si ripiega sul testo della pagina.
    let fallback: ListingData | null = null;
    try {
      const message = JSON.parse(raw);
      if (typeof message.bodyText === "string" && message.bodyText.trim().length >= MIN_USEFUL_TEXT) {
        fallback = readListing({ kind: "text", text: message.bodyText, url: source.url });
      }
    } catch {
      return null;
    }
    return fallback ? withUrlKey(fallback) : null;
  }

  const fromText = readListing(source);
  return fromText ? withUrlKey(fromText) : null;
}

function withUrlKey(listing: ListingData): ListingData {
  const canonical = listing.url ? canonicalListingUrl(listing.url) : null;
  return canonical ? { ...listing, listingKey: `url:${canonical}` } : listing;
}
