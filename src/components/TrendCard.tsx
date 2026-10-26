import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatCurrency } from "../lib/format";
import { trendChange, type MarketTrend } from "../lib/trend";
import { Card, Chip } from "../ui/components";
import { colors, space } from "../ui/theme";
import { LineChart, semesterLabel } from "./charts";

type Kind = "sale" | "rent";

const FORMAT: Record<Kind, (value: number) => string> = {
  sale: (value) => `${formatCurrency(value)}/mq`,
  rent: (value) => `${value.toFixed(1).replace(".", ",")} €/mq al mese`,
};
const AXIS: Record<Kind, (value: number) => string> = {
  sale: (value) => formatCurrency(value),
  rent: (value) => `${value.toFixed(1).replace(".", ",")} €`,
};
const SUBJECT: Record<Kind, string> = { sale: "i prezzi di vendita", rent: "gli affitti" };

/** "Dal 1° sem. 2021 al 1° sem. 2026 gli affitti della zona sono saliti del 12%". */
function describeChange(kind: Kind, trend: MarketTrend, place: string): string | null {
  const change = trendChange(trend[kind]);
  if (!change) return null;
  const span = `Dal ${semesterLabel(change.from.semester)} al ${semesterLabel(change.to.semester)}`;
  const pct = Math.abs(Math.round(change.pct));
  if (pct === 0) return `${span} ${SUBJECT[kind]} ${place} sono rimasti stabili.`;
  return `${span} ${SUBJECT[kind]} ${place} sono ${change.pct > 0 ? "saliti" : "scesi"} del ${pct}%.`;
}

/** Come sono cambiati prezzi e affitti nelle zone usate per il confronto; si passa dagli uni agli altri con due pulsanti. */
export function TrendCard({ trend, initial, precision }: { trend: MarketTrend; initial: Kind; precision: "zona" | "comune" }) {
  const place = precision === "zona" ? "della zona" : "del comune";
  const available = (["sale", "rent"] as Kind[]).filter((kind) => trendChange(trend[kind]) !== null);
  const [kind, setKind] = useState<Kind>(available.includes(initial) ? initial : available[0] ?? initial);
  if (available.length === 0) return null;
  const sentence = describeChange(kind, trend, place);

  return (
    <Card>
      <Text style={styles.section}>Come sono cambiati i valori {place}</Text>
      {available.length > 1 ? (
        <View style={styles.chips}>
          <Chip label="Prezzi di vendita" selected={kind === "sale"} onPress={() => setKind("sale")} />
          <Chip label="Affitti" selected={kind === "rent"} onPress={() => setKind("rent")} />
        </View>
      ) : null}
      {sentence ? <Text style={styles.sentence}>{sentence}</Text> : null}
      <LineChart key={kind} points={trend[kind]} format={FORMAT[kind]} axisFormat={AXIS[kind]} summary={sentence ?? ""} />
      <Text style={styles.small}>
        Valore centrale delle quotazioni OMI, abitazioni in stato normale{precision === "comune" ? ", mediana delle zone del comune" : ""}. Tocca un
        punto per leggerne il valore.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 18, fontWeight: "700", color: colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  sentence: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  small: { fontSize: 12, color: colors.muted, lineHeight: 17 },
});
