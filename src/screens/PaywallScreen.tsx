import React from "react";
import { StyleSheet, Text } from "react-native";

import { Button, Card, Notice, Screen } from "../ui/components";
import { colors, space } from "../ui/theme";

/** Si apre al quarto annuncio nuovo. Dice prezzo, durata e cosa si ottiene prima di chiedere di pagare. */
export function PaywallScreen({
  price,
  busy,
  error,
  onPurchase,
  onRestore,
  onClose,
}: {
  /** Come lo scrive Google Play, per esempio "0,99 €"; null finché non è noto. */
  price: string | null;
  busy: boolean;
  error: string | null;
  onPurchase: () => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  const shownPrice = price ?? "0,99 €";
  return (
    <Screen
      title="Hai usato le 3 analisi gratuite"
      subtitle="Per analizzare altri annunci serve un contributo."
      onBack={onClose}
      footer={
        <>
          <Button label={busy ? "Un momento…" : `Contribuisci con ${shownPrice}`} onPress={onPurchase} disabled={busy} />
          <Button label="Ripristina un acquisto già fatto" variant="secondary" onPress={onRestore} disabled={busy} />
          <Button label="Non ora" variant="ghost" onPress={onClose} disabled={busy} />
        </>
      }
    >
      <Card>
        <Text style={styles.price}>{shownPrice}</Text>
        {/* Task 19: quando il prodotto su Play è definito (prepagato o a rinnovo), qui va detto se si rinnova. */}
        <Text style={styles.body}>Valido 12 mesi.</Text>
        <Text style={styles.item}>Analisi senza limiti per un anno.</Text>
        <Text style={styles.item}>Le analisi già fatte restano sempre consultabili, anche senza contributo.</Text>
        <Text style={styles.item}>Il pagamento passa da Google Play: non serve un account.</Text>
      </Card>
      {error ? <Notice tone="warn">{error}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  price: { fontSize: 32, fontWeight: "700", color: colors.ink },
  body: { fontSize: 16, color: colors.ink, lineHeight: 23 },
  item: { fontSize: 15, color: colors.muted, lineHeight: 22, paddingLeft: space.sm },
});
