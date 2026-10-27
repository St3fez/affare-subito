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
