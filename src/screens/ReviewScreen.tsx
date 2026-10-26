import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { ListingEditor } from "../components/ListingEditor";
import type { AnalysisSettings } from "../lib/analysis";
import { applyDraft, describeIssue, describeListing, draftFromListing } from "../lib/draft";
import { checkListing } from "../lib/listing";
import type { ListingData } from "../lib/types";
import { Button, Card, Notice, Screen } from "../ui/components";
import { colors, space } from "../ui/theme";

/** Revisione dei dati letti dall'annuncio, o inserimento a mano dei pochi dati che servono. */
export function ReviewScreen({
  initial,
  settings,
  manual,
  busy,
  onBack,
  onCalculate,
}: {
  initial: ListingData;
  settings: AnalysisSettings;
  manual: boolean;
  busy: boolean;
  onBack: () => void;
  onCalculate: (listing: ListingData, settings: AnalysisSettings) => void;
}) {
  const [draft, setDraft] = useState(() => draftFromListing(initial));
  const [firstHome, setFirstHome] = useState(settings.firstHome);
  const [confirmedSqm, setConfirmedSqm] = useState(false);

  // Se i metri quadri cambiano, la conferma data prima non vale più.
  useEffect(() => setConfirmedSqm(false), [draft.sqm]);

  const applied = useMemo(() => applyDraft(initial, draft), [initial, draft]);
  const { blocking, warnings } = useMemo(() => checkListing(applied), [applied]);
  const needsSqmConfirmation = warnings.includes("sqm_implausible");
  const canCalculate = blocking.length === 0 && (!needsSqmConfirmation || confirmedSqm) && !busy;

  return (
    <Screen
      title={manual ? "Inserisci i dati" : "Rivedi i dati"}
      subtitle={manual ? "Bastano pochi dati: prezzo, metri quadri e comune." : `Ho capito: ${describeListing(applied)}. Correggi quello che non torna.`}
      onBack={onBack}
      footer={<Button label={busy ? "Calcolo…" : "Calcola"} onPress={() => onCalculate(applied, { ...settings, firstHome })} disabled={!canCalculate} />}
    >
      {blocking.length > 0 ? (
        <Notice tone={blocking.includes("not_a_sale") ? "bad" : manual ? "info" : "warn"}>{blocking.map(describeIssue).join(" ")}</Notice>
      ) : null}

      {needsSqmConfirmation ? (
        <Card>
          <Notice tone="warn">{describeIssue("sqm_implausible")}</Notice>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>Confermo: sono {applied.sqm} m²</Text>
            <Switch
              value={confirmedSqm}
              onValueChange={setConfirmedSqm}
              trackColor={{ true: colors.accent, false: colors.line }}
              accessibilityLabel="Confermo i metri quadri"
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <ListingEditor draft={draft} onChange={setDraft} firstHome={firstHome} onFirstHomeChange={setFirstHome} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  confirmRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  confirmText: { flex: 1, fontSize: 15, color: colors.ink },
});
