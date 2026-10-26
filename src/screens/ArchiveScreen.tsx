import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { analysisDeps } from "../app/deps";
import { analyzeListing } from "../lib/analysis";
import type { SavedAnalysis } from "../lib/archive";
import { describeListing } from "../lib/draft";
import { Button, Card, Screen } from "../ui/components";
import { colors, space } from "../ui/theme";

const VERDICT_TEXT = { sotto: "Sotto il mercato", in_linea: "In linea con il mercato", sopra: "Sopra il mercato" } as const;
const VERDICT_COLOR = { sotto: colors.good, in_linea: colors.ink, sopra: colors.bad } as const;

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

  const analyses = useMemo(() => items.map((item) => analyzeListing(item.listing, item.settings, analysisDeps)), [items]);

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
      subtitle={selecting ? "Scegli due case da confrontare." : "Le analisi che hai già fatto."}
      onBack={onBack}
      footer={
        items.length === 0 ? undefined : selecting ? (
          <>
            <Button label="Confronta" onPress={startCompare} disabled={selected.length !== 2} />
            <Button label="Annulla" variant="ghost" onPress={() => { setSelecting(false); setSelected([]); }} />
          </>
        ) : (
          <Button label="Confronta due case" variant="secondary" onPress={() => setSelecting(true)} disabled={items.length < 2} />
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
          const analysis = analyses[index];
          const verdict = analysis.kind === "ok" ? analysis.verdict : null;
          const isSelected = selected.includes(item.id);
          return (
            <Card key={item.id}>
              <TouchableOpacity
                onPress={() => (selecting ? toggle(item.id) : onOpen(item))}
                accessibilityRole="button"
                accessibilityLabel={item.listing.title || describeListing(item.listing)}
                accessibilityState={selecting ? { selected: isSelected } : undefined}
                style={styles.row}
              >
                {selecting ? (
                  <MaterialIcons name={isSelected ? "check-circle" : "radio-button-unchecked"} size={26} color={isSelected ? colors.accent : colors.muted} />
                ) : null}
                <View style={styles.text}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.listing.title || "Immobile"}
                  </Text>
                  <Text style={styles.muted}>{describeListing(item.listing)}</Text>
                  <Text style={[styles.verdict, { color: verdict ? VERDICT_COLOR[verdict.level] : colors.muted }]}>
                    {analysis.kind === "unsupported" ? "Non analizzabile" : verdict ? VERDICT_TEXT[verdict.level] : "Senza confronto di zona"}
                  </Text>
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
  text: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  verdict: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  date: { fontSize: 12, color: colors.muted },
});
