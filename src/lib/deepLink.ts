import { normalizeListingUrl } from "./listing/url";

/** `affaresubito://analizza?url=<indirizzo codificato>` → l'indirizzo dell'annuncio, solo se è http o https. */
export function listingUrlFromDeepLink(link: string): string | null {
  const match = link.match(/[?&]url=([^&]*)/);
  if (!match || !match[1]) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  if (!/^https?:\/\//i.test(decoded)) return null;
  return normalizeListingUrl(decoded);
}
