import Slider from "@react-native-community/slider";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, space } from "../ui/theme";

/** Un valore stimato che l'utente può spostare; il risultato si ricalcola quando lascia il cursore. */
export function EstimateSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onCommit: (value: number) => void;
}) {
  const [dragging, setDragging] = useState(value);
  useEffect(() => setDragging(value), [value]);

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.label}>
          {label} <Text style={styles.tag}>stima</Text>
        </Text>
        <Text style={styles.value}>{format(dragging)}</Text>
      </View>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={setDragging}
        onSlidingComplete={onCommit}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.line}
        thumbTintColor={colors.accent}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontSize: 14, color: colors.ink, flex: 1 },
  tag: { fontSize: 12, color: colors.muted },
  value: { fontSize: 14, fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"] },
});
