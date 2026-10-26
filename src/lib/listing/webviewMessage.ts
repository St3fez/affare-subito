import type { ListingData } from "../types";
import { readListing, type ListingSource } from "./index";
import { canonicalListingUrl } from "./url";

const MIN_USEFUL_TEXT = 200;

/**
 * Script che gira dentro la pagina dell'annuncio. Appena c'è `__NEXT_DATA__` (o, per le pagine senza, a caricamento
 * finito più 1,5 s) manda all'app `{ url, nextData, bodyText, blocked }`; in ogni caso entro 12 s.
 * Scritto in JavaScript semplice (ES5) per le WebView più vecchie.
 */
export function buildExtractionScript(): string {
  return `(function () {
  if (window.__affareSubitoExtract) return;
  window.__affareSubitoExtract = true;
  var start = Date.now();
  var sent = false;
  var settleAt = null;
  function send() {
    if (sent) return;
    sent = true;
    var body = (document.body && document.body.innerText) || "";
    var nd = document.getElementById("__NEXT_DATA__");
    var head = document.title + " " + body.slice(0, 2000);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      url: location.href,
      nextData: nd && nd.textContent ? nd.textContent : null,
      bodyText: body.slice(0, 20000),
      blocked: body.length < 3000 && /datadome|captcha|robot|verifica che sei|access denied|accesso negato/i.test(head)
    }));
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
