/** Aggiunge `https://` se manca; `null` se non è un indirizzo http(s) valido. */
export function normalizeListingUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

const TRAILING_PUNCTUATION = /[.,;:!?)\]}>»”’'"]+$/;

/**
 * L'indirizzo dentro un testo: "Guarda questo annuncio: https://… su Immobiliare.it" (come lo manda Condividi) → solo l'indirizzo.
 * Vale il primo http(s). Senza, il testo è accettato solo se è tutto un indirizzo scritto senza protocollo ("esempio.it/annuncio/1").
 */
export function listingUrlFromText(text: string): string | null {
  const found = /https?:\/\/[^\s<>"“”«»]+/i.exec(text);
  if (found) return normalizeListingUrl(found[0].replace(TRAILING_PUNCTUATION, ""));
  const raw = text.trim();
  return /\s/.test(raw) ? null : normalizeListingUrl(raw);
}

/** "idealista.it/immobile/37025092": senza protocollo, www, parametri, ancora e barra finale. Serve a riconoscere lo stesso annuncio. */
export function canonicalListingUrl(value: string): string | null {
  const normalized = normalizeListingUrl(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}
