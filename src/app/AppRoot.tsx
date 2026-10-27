import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getBilling, PurchaseCancelled } from "../billing";
import { DEFAULT_SETTINGS, type AnalysisSettings } from "../lib/analysis";
import { resetFakeBilling } from "../billing/fakeBilling";
import { clearAllData, deleteAnalysis, loadArchive, loadUsage, saveAnalysis, saveUsage, type SavedAnalysis } from "../lib/archive";
import { listingUrlFromDeepLink } from "../lib/deepLink";
import { applyPurchase, emptyUsage, isActive, mergeActiveUntil, registerAnalysis, type UsageState } from "../lib/entitlement";
import { syncEntitlement } from "../lib/entitlementSync";
import { emptyManualListing } from "../lib/listing";
import type { ListingData } from "../lib/types";
import { ArchiveScreen } from "../screens/ArchiveScreen";
import { CompareScreen } from "../screens/CompareScreen";
import { InputScreen } from "../screens/InputScreen";
import { PaywallScreen } from "../screens/PaywallScreen";
import { RentResultScreen } from "../screens/RentResultScreen";
import { ResultScreen } from "../screens/ResultScreen";
import { ReviewScreen } from "../screens/ReviewScreen";

type Pending = { listing: ListingData; settings: AnalysisSettings };

type Route =
  | { name: "input" }
  | { name: "review"; listing: ListingData; manual: boolean }
  | { name: "result"; item: SavedAnalysis; lastFree: boolean }
  | { name: "paywall"; pending: Pending }
  | { name: "archive" }
  | { name: "compare"; a: SavedAnalysis; b: SavedAnalysis };

export default function AppRoot() {
  const [stack, setStack] = useState<Route[]>([{ name: "input" }]);
  const [autoStart, setAutoStart] = useState<{ url: string; token: number } | undefined>();
  // Lo stato d'uso sta in un riferimento: chi lo legge dopo un'attesa (sincronizzazione con Google Play, pagamento) vede sempre
  // l'ultimo valore, e le scritture su disco si accodano per non sorpassarsi.
  const usageRef = useRef<UsageState>(emptyUsage);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const [archive, setArchive] = useState<SavedAnalysis[]>([]);
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState<string | null>(null);
  const [paywallError, setPaywallError] = useState<string | null>(null);
  const route = stack[stack.length - 1];

  const commitUsage = useCallback((next: UsageState) => {
    usageRef.current = next;
    writeQueue.current = writeQueue.current.then(() => saveUsage(next)).catch(() => undefined);
    return writeQueue.current;
  }, []);

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
        writeQueue.current.then(() => Promise.all([clearAllData(), resetFakeBilling()])).then(() => {
          usageRef.current = emptyUsage;
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
      usageRef.current = savedUsage;
      try {
        const synced = await syncEntitlement(getBilling(), savedUsage);
        // Solo la scadenza, sul valore di adesso: nel frattempo l'utente può aver fatto un'analisi.
        const merged = mergeActiveUntil(usageRef.current, synced);
        if (merged.activeUntil !== usageRef.current.activeUntil) commitUsage(merged);
      } catch {
        // Play non risponde: vale l'ultima scadenza nota.
      }
    })();
  }, [commitUsage]);

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
        commitUsage(current);
        if (replaceCount === 1) push({ name: "paywall", pending });
        return false;
      }
      const item: SavedAnalysis = { id: String(now.getTime()), savedAt: now.toISOString(), listing: pending.listing, settings: pending.settings };
      commitUsage(gate.state);
      await saveAnalysis(item);
      setArchive(await loadArchive());
      const consumedLastFree = !current.analyzedKeys.includes(pending.listing.listingKey) && gate.freeLeft === 0 && !isActive(gate.state, now);
      replaceTop(replaceCount, { name: "result", item, lastFree: consumedLastFree });
      return true;
    },
    [commitUsage, push, replaceTop]
  );

  const calculate = useCallback(
    async (listing: ListingData, settings: AnalysisSettings) => {
      setBusy(true);
      try {
        let current = usageRef.current;
        try {
          current = mergeActiveUntil(usageRef.current, await syncEntitlement(getBilling(), current));
        } catch {
          // Play non risponde: si usa lo stato che c'è.
        }
        await runAnalysis(current, { listing, settings }, 1);
      } finally {
        setBusy(false);
      }
    },
    [runAnalysis]
  );

  const finishPurchase = useCallback(
    async (until: Date, pending: Pending) => {
      const next = applyPurchase(usageRef.current, until);
      commitUsage(next);
      await runAnalysis(next, pending, 2); // via il contributo e la revisione, dentro il risultato
    },
    [commitUsage, runAnalysis]
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
      screen =
        route.item.listing.contract === "rent" ? (
          <RentResultScreen key={route.item.id} item={route.item} lastFree={route.lastFree} onBack={pop} />
        ) : (
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
      screen = (
        <ArchiveScreen
          items={archive}
          onOpen={(item) => push({ name: "result", item, lastFree: false })}
          onDelete={async (id) => {
            await deleteAnalysis(id);
            setArchive(await loadArchive());
          }}
          onCompare={(a, b) => push({ name: "compare", a, b })}
          onBack={pop}
        />
      );
      break;
    case "compare":
      screen = <CompareScreen a={route.a} b={route.b} onBack={pop} />;
      break;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen}
    </SafeAreaProvider>
  );
}
