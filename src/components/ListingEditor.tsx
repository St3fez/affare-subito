import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import type { ListingDraft } from "../lib/draft";
import type { Condition } from "../lib/types";
import { Chip, LabeledInput } from "../ui/components";
import { colors, space } from "../ui/theme";

const CONDITIONS: Array<{ value: Condition | null; label: string }> = [
  { value: "pronto", label: "Nuovo o ristrutturato" },
  { value: "abitabile", label: "Abitabile" },
  { value: "da_rinfrescare", label: "Da rinfrescare" },
  { value: "da_ristrutturare", label: "Da ristrutturare" },
  { value: null, label: "Non lo so" },
];

/** I campi che servono ai calcoli, uguali per l'annuncio letto e per l'inserimento a mano. */
export function ListingEditor({
  draft,
  onChange,
  firstHome,
  onFirstHomeChange,
}: {
  draft: ListingDraft;
  onChange: (draft: ListingDraft) => void;
  firstHome: boolean;
  onFirstHomeChange: (value: boolean) => void;
}) {
  const set = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) => onChange({ ...draft, [key]: value });

  const rent = draft.contract === "rent";

  return (
    <View style={styles.root}>
      <Text style={styles.label}>È in vendita o in affitto?</Text>
      <View style={styles.chips}>
        <Chip label="Vendita" selected={!rent} onPress={() => set("contract", "sale")} />
        <Chip label="Affitto" selected={rent} onPress={() => set("contract", "rent")} />
      </View>
      <LabeledInput
        label={rent ? "Canone al mese" : "Prezzo richiesto"}
        value={draft.price}
        onChangeText={(v) => set("price", v)}
        keyboardType="numeric"
        suffix="€"
      />
      <LabeledInput label="Metri quadri" value={draft.sqm} onChangeText={(v) => set("sqm", v)} keyboardType="numeric" suffix="m²" />
      <LabeledInput label="Comune" value={draft.city} onChangeText={(v) => set("city", v)} autoCapitalize="words" />
      <LabeledInput
        label="Provincia (sigla)"
        value={draft.province}
        onChangeText={(v) => set("province", v.slice(0, 2))}
        autoCapitalize="characters"
        hint="Per esempio MI. Serve a trovare i valori di mercato del comune giusto."
      />
      <LabeledInput
        label="Zona o quartiere (facoltativo)"
        value={draft.zone}
        onChangeText={(v) => set("zone", v)}
        autoCapitalize="words"
        hint="Se la conosci, il confronto con il mercato è più preciso."
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <LabeledInput label="Camere da letto" value={draft.bedrooms} onChangeText={(v) => set("bedrooms", v)} keyboardType="numeric" />
        </View>
        <View style={styles.half}>
          <LabeledInput label="Bagni" value={draft.bathrooms} onChangeText={(v) => set("bathrooms", v)} keyboardType="numeric" />
        </View>
      </View>

      <Text style={styles.label}>In che stato è?</Text>
      <View style={styles.chips}>
        {CONDITIONS.map((option) => (
          <Chip key={option.label} label={option.label} selected={draft.condition === option.value} onPress={() => set("condition", option.value)} />
        ))}
      </View>

      {rent ? null : (
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.label}>È la tua prima casa?</Text>
            <Text style={styles.hint}>Cambia le imposte di acquisto.</Text>
          </View>
          <Switch
            value={firstHome}
            onValueChange={onFirstHomeChange}
            trackColor={{ true: colors.accent, false: colors.line }}
            accessibilityLabel="È la tua prima casa?"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  row: { flexDirection: "row", gap: space.md },
  half: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  hint: { fontSize: 13, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  switchText: { flex: 1 },
});
