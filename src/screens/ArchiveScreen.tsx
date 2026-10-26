import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { analysisDeps } from "../app/deps";
import { analyzeListing } from "../lib/analysis";
import type { SavedAnalysis } from "../lib/archive";
import { describeListing } from "../lib/draft";
import { analyzeRental } from "../lib/rent";
import { staleDataWarning } from "../lib/staleness";
import { presentVerdict, type VerdictView } from "../lib/verdictView";
import { Button, Card, Screen } from "../ui/components";
import { colors, space } from "../ui/theme";

const TONE_COLOR = { good: colors.good, neutral: colors.ink, bad: colors.bad } as const;

const isRental = (item: SavedAnalysis) => item.listing.contract === "rent";

/** Lo stesso titolo della schermata del risultato (neutro se i valori sono vecchi o la zona non è stata riconosciuta). */
function summarize(item: SavedAnalysis): { supported: boolean; view: VerdictView | null } {
  const analysis = isRental(item) ? analyzeRental(item.listing, item.settings, analysisDeps) : analyzeListing(item.listing, item.settings, analysisDeps);
  if (analysis.kind !== "ok") return { supported: false, view: null };
  const { verdict, market } = analysis;
  if (!verdict || !market) return { supported: true, view: null };
  const scope = { precision: market.precision, zoneCount: market.zoneCodes.length };
  return { supported: true, view: presentVerdict(verdict, staleDataWarning(market.semester, new Date()), market.semester, scope) };
}

/** Le analisi già fatte, sempre consultabili (anche senza contributo); se ne possono confrontare due. */
export function ArchiveScreen({
  items,
  onOpen,
  onDelete,
  onCompare,
  onBack,
}: {
  items: SavedAnalysis[];
  onOpen: (item: SavedAnalysis) => void;
  onDelete: (id: string) => void;
  onCompare: (a: SavedAnalysis, b: SavedAnalysis) => void;
  onBack: () => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const summaries = useMemo(() => items.map(summarize), [items]);
  // Il confronto mette a fianco prezzi, costi e rese: vale solo tra case in vendita.
  const forSale = items.filter((item) => !isRental(item)).length;

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length < 2 ? [...current, id] : current));

  const confirmDelete = (item: SavedAnalysis) =>
    Alert.alert("Eliminare questa analisi?", item.listing.title || describeListing(item.listing), [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: () => onDelete(item.id) },
    ]);

  const startCompare = () => {
    const [a, b] = selected.map((id) => items.find((item) => item.id === id));
    if (a && b) {
      setSelecting(false);
      setSelected([]);
      onCompare(a, b);
    }
  };

  return (
    <Screen
      title="Archivio"
      subtitle={selecting ? "Scegli due case in vendita da confrontare." : "Le analisi che hai già fatto."}
      onBack={onBack}
      footer={
        items.length === 0 ? undefined : selecting ? (
          <>
            <Button label="Confronta" onPress={startCompare} disabled={selected.length !== 2} />
            <Button label="Annulla" variant="ghost" onPress={() => { setSelecting(false); setSelected([]); }} />
          </>
        ) : (
          <Button label="Confronta due case" variant="secondary" onPress={() => setSelecting(true)} disabled={forSale < 2} />
        )
      }
    >
      {items.length === 0 ? (
        <Card>
          <Text style={styles.title}>Non hai ancora analizzato nessun annuncio</Text>
          <Text style={styles.muted}>Torna indietro e incolla il link di un annuncio: qui troverai le analisi, anche per confrontarle.</Text>
        </Card>
      ) : (
        items.map((item, index) => {
          const { supported, view } = summaries[index];
          const isSelected = selected.includes(item.id);
          const selectable = !isRental(item);
          return (
            <Card key={item.id}>
              <TouchableOpacity
                onPress={() => (selecting ? selectable && toggle(item.id) : onOpen(item))}
                disabled={selecting && !selectable}
                accessibilityRole="button"
                accessibilityLabel={item.listing.title || describeListing(item.listing)}
                accessibilityState={selecting ? { selected: isSelected, disabled: !selectable } : undefined}
                style={[styles.row, selecting && !selectable && styles.dimmed]}
              >
                {selecting && selectable ? (
                  <MaterialIcons name={isSelected ? "check-circle" : "radio-button-unchecked"} size={26} color={isSelected ? colors.accent : colors.muted} />
                ) : null}
                <View style={styles.text}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.listing.title || "Immobile"}
                  </Text>
                  <Text style={styles.muted}>{describeListing(item.listing)}</Text>
                  <Text style={[styles.verdict, { color: view ? TONE_COLOR[view.tone] : colors.muted }]}>
                    {!supported ? "Non analizzabile" : view ? view.headline : "Senza confronto di zona"}
                  </Text>
                  {selecting && !selectable ? <Text style={styles.date}>Gli affitti non si confrontano con le case in vendita</Text> : null}
                  <Text style={styles.date}>{new Date(item.savedAt).toLocaleDateString("it-IT")}</Text>
                </View>
              </TouchableOpacity>
              {selecting ? null : <Button label="Elimina" variant="ghost" onPress={() => confirmDelete(item)} />}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  dimmed: { opacity: 0.55 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  verdict: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  date: { fontSize: 12, color: colors.muted },
});
