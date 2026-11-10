import { listingUrlFromText, normalizeListingUrl } from "./listing/url";

function queryValue(link: string, name: string): string | null {
  const match = link.match(new RegExp(`[?&]${name}=([^&]*)`));
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * Il link con cui l'app viene aperta → l'indirizzo dell'annuncio, solo se è http o https.
 * - `affaresubito://analizza?url=<indirizzo codificato>`: un indirizzo.
 * - `affaresubito://analizza?testo=<testo codificato>`: il testo che un'altra app manda con Condividi ("Guarda questo annuncio: https://…").
 */
export function listingUrlFromDeepLink(link: string): string | null {
  const shared = queryValue(link, "testo");
  if (shared) return listingUrlFromText(shared);

  const decoded = queryValue(link, "url");
  if (!decoded || !/^https?:\/\//i.test(decoded)) return null;
  return normalizeListingUrl(decoded);
}
