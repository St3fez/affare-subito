import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ListingWebView } from "../components/ListingWebView";
import { readListing } from "../lib/listing";
import { normalizeListingUrl } from "../lib/listing/url";
import { listingFromWebViewMessage } from "../lib/listing/webviewMessage";
import type { ListingData } from "../lib/types";
import { Button, Card, LabeledInput, Notice, Screen } from "../ui/components";
import { colors, radius, space } from "../ui/theme";

const LOAD_TIMEOUT_MS = 20000;
const JUNK_TIMEOUT_MS = 6000;

type Phase = "idle" | "loading" | "failed" | "paste";

/**
 * Ingresso: il link dell'annuncio. Scala di ripieghi, ognuno più semplice del precedente:
 * pagina letta nella WebView → testo incollato → dati a mano (sempre disponibili in fondo).
 */
export function InputScreen({
  onListing,
  onManual,
  onArchive,
  archiveCount,
  autoStart,
  onAutoStartHandled,
}: {
  onListing: (listing: ListingData) => void;
  onManual: () => void;
  onArchive: () => void;
  archiveCount: number;
  /** Indirizzo arrivato da un link dell'app: parte da solo. `token` distingue due aperture dello stesso indirizzo. */
  autoStart?: { url: string; token: number };
  onAutoStartHandled?: () => void;
}) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeUrl, setActiveUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [attempt, setAttempt] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const junkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    junkTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const fail = useCallback(
    (reason: string) => {
      clearTimers();
      setMessage(reason);
      setPhase("failed");
    },
    [clearTimers]
  );

  const start = useCallback(
    (raw: string) => {
      const normalized = normalizeListingUrl(raw);
      if (!normalized) {
        setMessage("Questo non sembra un indirizzo web. Incolla il link dell'annuncio.");
        return;
      }
      clearTimers();
      setMessage(null);
      setUrl(normalized);
      setActiveUrl(normalized);
      setAttempt((n) => n + 1);
      setPhase("loading");
      timers.current.push(
        setTimeout(() => fail("La pagina ci mette troppo ad aprirsi, oppure non contiene un annuncio che riesco a leggere."), LOAD_TIMEOUT_MS)
      );
    },
    [clearTimers, fail]
  );

  useEffect(() => {
    if (!autoStart) return;
    start(autoStart.url);
    onAutoStartHandled?.(); // il link si usa una volta sola: tornando indietro non deve ripartire
    // Si riparte solo quando arriva un nuovo link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart?.token]);

  const handleMessage = useCallback(
    (raw: string) => {
      const listing = listingFromWebViewMessage(raw);
      if (listing) {
        clearTimers();
        onListing(listing);
        return;
      }
      // Una pagina senza annuncio (per esempio un passaggio intermedio): si aspetta ancora un po', poi si ripiega.
      if (!junkTimer.current) {
        junkTimer.current = setTimeout(() => fail("Non trovo un annuncio in questa pagina."), JUNK_TIMEOUT_MS);
        timers.current.push(junkTimer.current);
      }
    },
    [clearTimers, fail, onListing]
  );

  const readPasted = () => {
    const listing = readListing({ kind: "text", text: pasted });
    if (listing) {
      onListing(listing);
    } else {
      setMessage("Nel testo non trovo né il prezzo, né i metri quadri, né il comune. Incolla più parti dell'annuncio, oppure inserisci i dati a mano.");
    }
  };

  return (
    <Screen
      title="Affare Subito"
      subtitle="Incolla il link di un annuncio e ti dico se è un affare."
      footer={
        <>
          <Button label="Inserisci i dati a mano" variant="secondary" onPress={onManual} />
          <Button label={archiveCount > 0 ? `Archivio (${archiveCount})` : "Archivio"} variant="ghost" onPress={onArchive} />
        </>
      }
    >
      {phase === "paste" ? (
        <Card>
          <Text style={styles.cardTitle}>Incolla il testo dell'annuncio</Text>
          <Text style={styles.muted}>Copia dalla pagina o dall'app del portale il titolo, il prezzo, i metri quadri e la descrizione.</Text>
          <TextInput
            style={styles.paste}
            value={pasted}
            onChangeText={setPasted}
            multiline
            textAlignVertical="top"
            placeholder="Trilocale in vendita a Milano, 85 m², 340.000 €…"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Testo dell'annuncio"
          />
          {message ? <Notice tone="warn">{message}</Notice> : null}
          <Button label="Leggi il testo" onPress={readPasted} disabled={pasted.trim().length === 0} />
          <Button label="Torna al link" variant="ghost" onPress={() => { setMessage(null); setPhase("idle"); }} />
        </Card>
      ) : (
        <Card>
          <LabeledInput
            label="Link dell'annuncio"
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.immobiliare.it/annunci/…"
            keyboardType="url"
            autoCapitalize="none"
          />
          <Button label="Analizza" onPress={() => start(url)} disabled={phase === "loading" || url.trim().length === 0} />
          <Text style={styles.muted}>Funziona meglio con immobiliare.it. Con gli altri portali può servire incollare il testo.</Text>
        </Card>
      )}

      {phase === "idle" && message ? <Notice tone="warn">{message}</Notice> : null}

      {phase === "loading" ? (
        <Card>
          <Text style={styles.cardTitle}>Sto aprendo l'annuncio…</Text>
          <Text style={styles.muted}>Se la pagina chiede qualcosa (cookie o un controllo anti-robot), rispondi come faresti nel browser.</Text>
          <View style={styles.web}>
            <ListingWebView
              key={attempt}
              url={activeUrl}
              onMessage={handleMessage}
              onProblem={(reason) => fail(reason)}
            />
          </View>
          <Button label="Annulla" variant="ghost" onPress={() => { clearTimers(); setPhase("idle"); }} />
        </Card>
      ) : null}

      {phase === "failed" ? (
        <Card>
          <Notice tone="warn">{message ?? "Non riesco a leggere questa pagina."}</Notice>
          <Text style={styles.muted}>Puoi incollare il testo dell'annuncio, oppure scrivere tu i pochi dati che servono.</Text>
          <Button label="Incolla il testo dell'annuncio" onPress={() => { setMessage(null); setPhase("paste"); }} />
          <Button label="Riprova con il link" variant="ghost" onPress={() => start(url)} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  web: { height: 420, borderRadius: radius.sm, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  paste: {
    minHeight: 170,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    padding: space.md,
    fontSize: 15,
    color: colors.ink,
  },
});
