import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { analysisDeps } from "../app/deps";
import { analyzeListing } from "../lib/analysis";
import type { SavedAnalysis } from "../lib/archive";
import { buildComparison, type ComparisonRow } from "../lib/compare";
import { formatCurrency, formatPercent } from "../lib/format";
import { Card, Divider, Screen } from "../ui/components";
import { colors, space } from "../ui/theme";

function show(value: number | null, kind: ComparisonRow["kind"]): string {
  if (value === null) return "—";
  if (kind === "currency") return formatCurrency(value);
  if (kind === "percent") return formatPercent(value);
  return `${value >= 0 ? "+" : "−"}${Math.abs(Math.round(value))}%`;
}

/** Due case affiancate; su ogni riga, in verde, quella che sta meglio. */
export function CompareScreen({ a, b, onBack }: { a: SavedAnalysis; b: SavedAnalysis; onBack: () => void }) {
  const rows = useMemo(
    () => buildComparison(analyzeListing(a.listing, a.settings, analysisDeps), analyzeListing(b.listing, b.settings, analysisDeps)),
    [a, b]
  );

  return (
    <Screen title="Confronto" subtitle="In verde la casa che sta meglio su quella riga." onBack={onBack}>
      <Card>
        <View style={styles.line}>
          <View style={styles.label} />
          {[a, b].map((item, index) => (
            <View key={item.id} style={styles.value}>
              <Text style={styles.heading} numberOfLines={1}>
                {item.listing.city || `Casa ${index === 0 ? "A" : "B"}`}
              </Text>
              <Text style={styles.subheading} numberOfLines={1}>
                {item.listing.sqm ? `${item.listing.sqm} m²` : ""}
              </Text>
            </View>
          ))}
        </View>
        <Divider />
        {rows.map((row) => (
          <View key={row.id} style={styles.line}>
            <Text style={[styles.label, styles.rowLabel]}>{row.label}</Text>
            <Text style={[styles.value, styles.number, row.better === "a" && styles.better]} numberOfLines={1} adjustsFontSizeToFit>
              {show(row.a, row.kind)}
            </Text>
            <Text style={[styles.value, styles.number, row.better === "b" && styles.better]} numberOfLines={1} adjustsFontSizeToFit>
              {show(row.b, row.kind)}
            </Text>
          </View>
        ))}
      </Card>
      <Text style={styles.note}>La resa netta si confronta solo se c'è un affitto di riferimento per la zona. I valori seguono le ipotesi di ciascuna analisi.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", paddingVertical: space.xs },
  label: { flex: 1 },
  rowLabel: { fontSize: 14, color: colors.ink, lineHeight: 19 },
  value: { flex: 1.1, textAlign: "right", alignItems: "flex-end" },
  heading: { fontSize: 15, fontWeight: "700", color: colors.ink, textAlign: "right" },
  subheading: { fontSize: 13, color: colors.muted, textAlign: "right" },
  number: { fontSize: 15, color: colors.ink, fontVariant: ["tabular-nums"] },
  better: { color: colors.good, fontWeight: "700" },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17, paddingHorizontal: space.xs },
});
