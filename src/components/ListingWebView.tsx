import React from "react";
import { WebView } from "react-native-webview";

import { buildExtractionScript } from "../lib/listing/webviewMessage";

const INJECTED = buildExtractionScript();

/**
 * Apre l'annuncio come farebbe il browser, sul telefono dell'utente, e restituisce il riepilogo della pagina.
 * Deve restare visibile mentre carica: se compare una richiesta (cookie, controllo anti-robot) risponde l'utente.
 */
export function ListingWebView({ url, onMessage, onProblem }: { url: string; onMessage: (raw: string) => void; onProblem: (message: string) => void }) {
  return (
    <WebView
      source={{ uri: url }}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      injectedJavaScript={INJECTED}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
      onError={(event) => onProblem(event.nativeEvent.description || "La pagina non è raggiungibile.")}
      // I portali provano ad aprire la loro app con indirizzi intent:// o simili: si resta nella pagina web.
      onShouldStartLoadWithRequest={(request) => /^https?:\/\//i.test(request.url)}
    />
  );
}
