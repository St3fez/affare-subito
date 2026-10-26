import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatCurrency } from "../lib/format";
import type { Verdict } from "../lib/verdict";
import { colors, radius, space } from "../ui/theme";

const TONES = {
  sotto: colors.good,
  in_linea: colors.ink,
  sopra: colors.bad,
} as const;

const MARKER_WIDTH = 6;

/**
 * La posizione del prezzo al metro quadro dentro la forchetta di mercato della zona:
 * la fascia colorata è la forchetta OMI, il segno è l'annuncio.
 */
export function VerdictGauge({ verdict }: { verdict: Verdict }) {
  const { reference, pricePerSqm, level } = verdict;
  const color = TONES[level];
  const [trackWidth, setTrackWidth] = useState(0);
  const [labelWidth, setLabelWidth] = useState(0);

  // La scala lascia sempre un po' di spazio ai lati, così il segno cade dentro anche se il prezzo è lontano dalla forchetta.
  const low = Math.min(reference.min * 0.6, pricePerSqm * 0.9);
  const high = Math.max(reference.max * 1.4, pricePerSqm * 1.1);
  const at = (value: number) => Math.min(1, Math.max(0, (value - low) / (high - low)));

  const bandLeft = at(reference.min);
  const bandWidth = at(reference.max) - bandLeft;
  const marker = at(pricePerSqm);

  // L'etichetta sta centrata sopra il segno, ma non esce dalla barra.
  const labelLeft = Math.max(0, Math.min(trackWidth - labelWidth, marker * trackWidth - labelWidth / 2));

  return (
    <View style={styles.root} accessible accessibilityLabel={verdict.label}>
      <View style={styles.labelRow}>
        <Text
          style={[styles.markerLabel, { color, left: labelLeft, opacity: trackWidth > 0 && labelWidth > 0 ? 1 : 0 }]}
          onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}
        >
          {formatCurrency(pricePerSqm)}/mq
        </Text>
      </View>
      <View style={styles.track} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
        <View style={[styles.band, { left: `${bandLeft * 100}%`, width: `${bandWidth * 100}%` }]} />
        <View style={[styles.marker, { left: `${marker * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.scaleText}>
        La fascia colorata è il prezzo di mercato della zona: da {formatCurrency(reference.min)} a {formatCurrency(reference.max)} al mq.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm, paddingTop: space.xs },
  labelRow: { height: 32 },
  markerLabel: { position: "absolute", top: 0, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  track: { height: 14, borderRadius: radius.sm, backgroundColor: colors.line, justifyContent: "center" },
  band: { position: "absolute", top: 0, bottom: 0, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.sm },
  marker: { position: "absolute", top: -8, bottom: -8, width: MARKER_WIDTH, marginLeft: -MARKER_WIDTH / 2, borderRadius: MARKER_WIDTH / 2 },
  scaleText: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: space.xs },
});
