import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, Linking, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getBilling, PurchaseCancelled } from "../billing";
import { DEFAULT_SETTINGS, type AnalysisSettings } from "../lib/analysis";
import { resetFakeBilling } from "../billing/fakeBilling";
import { clearAllData, loadArchive, loadUsage, saveAnalysis, saveUsage, type SavedAnalysis } from "../lib/archive";
import { listingUrlFromDeepLink } from "../lib/deepLink";
import { applyPurchase, emptyUsage, isActive, registerAnalysis, type UsageState } from "../lib/entitlement";
import { syncEntitlement } from "../lib/entitlementSync";
import { emptyManualListing } from "../lib/listing";
import type { ListingData } from "../lib/types";
import { InputScreen } from "../screens/InputScreen";
import { PaywallScreen } from "../screens/PaywallScreen";
import { ResultScreen } from "../screens/ResultScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { Card, Screen } from "../ui/components";

type Pending = { listing: ListingData; settings: AnalysisSettings };

type Route =
  | { name: "input" }
  | { name: "review"; listing: ListingData; manual: boolean }
  | { name: "result"; item: SavedAnalysis; lastFree: boolean }
  | { name: "paywall"; pending: Pending }
  | { name: "archive" };

export default function AppRoot() {
  const [stack, setStack] = useState<Route[]>([{ name: "input" }]);
  const [autoStart, setAutoStart] = useState<{ url: string; token: number } | undefined>();
  const [usage, setUsage] = useState<UsageState>(emptyUsage);
  const [archive, setArchive] = useState<SavedAnalysis[]>([]);
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState<string | null>(null);
  const [paywallError, setPaywallError] = useState<string | null>(null);
  const route = stack[stack.length - 1];

  const push = useCallback((next: Route) => setStack((s) => [...s, next]), []);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  /** Toglie le ultime `count` schermate e ne mette una nuova al loro posto. */
  const replaceTop = useCallback((count: number, next: Route) => setStack((s) => [...s.slice(0, Math.max(1, s.length - count)), next]), []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [stack.length, pop]);

  // Un link `affaresubito://analizza?url=…` apre l'app e parte con quell'annuncio.
  useEffect(() => {
    const open = (link: string | null) => {
      // Solo nelle build di prova (stessa variabile del billing finto): `affaresubito://reset` azzera archivio e contributo.
      if (process.env.EXPO_PUBLIC_FAKE_BILLING === "1" && link?.startsWith("affaresubito://reset")) {
        Promise.all([clearAllData(), resetFakeBilling()]).then(() => {
          setUsage(emptyUsage);
          setArchive([]);
          setStack([{ name: "input" }]);
        });
        return;
      }
      const url = link ? listingUrlFromDeepLink(link) : null;
      if (url) {
        setStack([{ name: "input" }]);
        setAutoStart({ url, token: Date.now() });
      }
    };
    Linking.getInitialURL().then(open);
    const subscription = Linking.addEventListener("url", (event) => open(event.url));
    return () => subscription.remove();
  }, []);

  // All'avvio: archivio e stato d'uso dal telefono, poi la scadenza del contributo come la riporta Google Play.
  useEffect(() => {
    (async () => {
      const [savedUsage, savedArchive] = await Promise.all([loadUsage(), loadArchive()]);
      setArchive(savedArchive);
      setUsage(savedUsage);
      try {
        const synced = await syncEntitlement(getBilling(), savedUsage);
        if (synced.activeUntil !== savedUsage.activeUntil) {
          setUsage(synced);
          await saveUsage(synced);
        }
      } catch {
        // Play non risponde: vale l'ultima scadenza nota.
      }
    })();
  }, []);

  // Il prezzo del contributo come lo scrive Google Play, quando si apre la schermata del contributo.
  const onPaywall = route.name === "paywall";
  useEffect(() => {
    if (!onPaywall) return;
    setPaywallError(null);
    getBilling()
      .localizedPrice()
      .then(setPrice)
      .catch(() => setPrice(null));
  }, [onPaywall]);

  /** Registra l'analisi (se il contributo lo consente), la salva e mostra il risultato al posto delle `replaceCount` schermate in cima. */
  const runAnalysis = useCallback(
    async (current: UsageState, pending: Pending, replaceCount: number) => {
      const now = new Date();
      const gate = registerAnalysis(current, pending.listing.listingKey, now);
      if (!gate.allowed) {
        setUsage(current);
        await saveUsage(current);
        if (replaceCount === 1) push({ name: "paywall", pending });
        return false;
      }
      const item: SavedAnalysis = { id: String(now.getTime()), savedAt: now.toISOString(), listing: pending.listing, settings: pending.settings };
      await saveUsage(gate.state);
      await saveAnalysis(item);
      setUsage(gate.state);
      setArchive(await loadArchive());
      const consumedLastFree = !current.analyzedKeys.includes(pending.listing.listingKey) && gate.freeLeft === 0 && !isActive(gate.state, now);
      replaceTop(replaceCount, { name: "result", item, lastFree: consumedLastFree });
      return true;
    },
    [push, replaceTop]
  );

  const calculate = useCallback(
    async (listing: ListingData, settings: AnalysisSettings) => {
      setBusy(true);
      try {
        let current = usage;
        try {
          current = await syncEntitlement(getBilling(), usage);
        } catch {
          // Play non risponde: si usa lo stato che c'è.
        }
        await runAnalysis(current, { listing, settings }, 1);
      } finally {
        setBusy(false);
      }
    },
    [usage, runAnalysis]
  );

  const finishPurchase = useCallback(
    async (until: Date, pending: Pending) => {
      const next = applyPurchase(usage, until);
      await saveUsage(next);
      setUsage(next);
      await runAnalysis(next, pending, 2); // via il contributo e la revisione, dentro il risultato
    },
    [usage, runAnalysis]
  );

  const purchase = useCallback(
    async (pending: Pending) => {
      setBusy(true);
      setPaywallError(null);
      try {
        await finishPurchase(await getBilling().purchaseYear(), pending);
      } catch (error) {
        if (!(error instanceof PurchaseCancelled)) {
          setPaywallError(error instanceof Error ? error.message : "Il pagamento non è andato a buon fine. Riprova.");
        }
      } finally {
        setBusy(false);
      }
    },
    [finishPurchase]
  );

  const restore = useCallback(
    async (pending: Pending) => {
      setBusy(true);
      setPaywallError(null);
      try {
        const until = await getBilling().restore();
        if (until) await finishPurchase(until, pending);
        else setPaywallError("Non trovo acquisti da ripristinare con questo account Google.");
      } catch (error) {
        setPaywallError(error instanceof Error ? error.message : "Non riesco a controllare gli acquisti. Riprova.");
      } finally {
        setBusy(false);
      }
    },
    [finishPurchase]
  );

  /** Gli slider cambiano le ipotesi: il risultato si ricalcola nella schermata e la voce dell'archivio le tiene. */
  const saveSettings = useCallback(async (item: SavedAnalysis, settings: AnalysisSettings) => {
    await saveAnalysis({ ...item, settings });
    setArchive(await loadArchive());
  }, []);

  const openManual = () =>
    push({ name: "review", listing: emptyManualListing(`${Date.now()}${Math.random().toString(36).slice(2, 6)}`), manual: true });

  let screen: React.ReactNode;
  switch (route.name) {
    case "input":
      screen = (
        <InputScreen
          autoStart={autoStart}
          onAutoStartHandled={() => setAutoStart(undefined)}
          archiveCount={archive.length}
          onListing={(listing) => push({ name: "review", listing, manual: false })}
          onManual={openManual}
          onArchive={() => push({ name: "archive" })}
        />
      );
      break;
    case "review":
      screen = (
        <ReviewScreen
          initial={route.listing}
          settings={DEFAULT_SETTINGS}
          manual={route.manual}
          busy={busy}
          onBack={pop}
          onCalculate={calculate}
        />
      );
      break;
    case "result":
      screen = (
        <ResultScreen
          key={route.item.id}
          item={route.item}
          lastFree={route.lastFree}
          onSettingsChange={(settings) => saveSettings(route.item, settings)}
          onBack={pop}
        />
      );
      break;
    case "paywall":
      screen = (
        <PaywallScreen
          price={price}
          busy={busy}
          error={paywallError}
          onPurchase={() => purchase(route.pending)}
          onRestore={() => restore(route.pending)}
          onClose={pop}
        />
      );
      break;
    case "archive":
      // Segnaposto: l'archivio e il confronto arrivano con il Task 17.
      screen = (
        <Screen title="Archivio" onBack={pop}>
          <Card>
            <Text>{archive.length} analisi salvate</Text>
          </Card>
        </Screen>
      );
      break;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen}
    </SafeAreaProvider>
  );
}
