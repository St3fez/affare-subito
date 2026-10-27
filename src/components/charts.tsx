import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TrendPoint } from "../lib/trend";
import { chart, colors, space } from "../ui/theme";

/** "2026-S1" → "1° sem. 2026". */
export function semesterLabel(semester: string): string {
  const [year, half] = semester.split("-S");
  return `${half}° sem. ${year}`;
}

const PLOT_HEIGHT = 120;
const Y_GUTTER = 72;
// Il bordo di 2px del colore della scheda stacca il segno dalla linea: il pallino pieno resta di 6px (10px quello scelto).
const MARKER = 10;
const SELECTED_MARKER = 14;

/**
 * Andamento nel tempo, un punto per semestre: linea di 2px, un segno per valore, i semestri mancanti lasciano un buco.
 * Si tocca un punto per leggerne il valore (all'inizio è selezionato l'ultimo). Le righe sottili sono il minimo e il massimo.
 */
export function LineChart({
  points,
  format,
  axisFormat,
  summary,
}: {
  points: TrendPoint[];
  format: (value: number) => string;
  /** Più corto di `format`: sta nella colonna a destra del grafico. */
  axisFormat: (value: number) => string;
  summary: string;
}) {
  const lastWithValue = points.map((p) => p.value !== null).lastIndexOf(true);
  const [selected, setSelected] = useState(lastWithValue);
  const [width, setWidth] = useState(0);

  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = max === min ? Math.max(1, max * 0.05) : (max - min) * 0.15;
  const low = min - pad;
  const high = max + pad;

  const plotWidth = Math.max(0, width - Y_GUTTER);
  const count = points.length;
  const x = (i: number) => (count === 1 ? plotWidth / 2 : SELECTED_MARKER / 2 + (i * (plotWidth - SELECTED_MARKER)) / (count - 1));
  const y = (v: number) => PLOT_HEIGHT - ((v - low) / (high - low)) * PLOT_HEIGHT;

  const current = points[selected] ?? points[lastWithValue];
  const slot = count > 0 ? plotWidth / count : 0;

  return (
    <View style={styles.lineRoot} accessible accessibilityLabel={summary}>
      <Text style={styles.readout}>
        {semesterLabel(current.semester)}: <Text style={styles.readoutValue}>{current.value === null ? "dato mancante" : format(current.value)}</Text>
      </Text>
      <View style={{ height: PLOT_HEIGHT }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <>
            {[max, min].map((value, index) => (
              <View key={index} style={[styles.gridLine, { top: y(value), width: plotWidth }]}>
                <Text style={[styles.gridLabel, { left: plotWidth + space.sm }]}>{axisFormat(value)}</Text>
              </View>
            ))}
            {points.slice(0, -1).map((point, i) => {
              const next = points[i + 1];
              if (point.value === null || next.value === null) return null;
              const x1 = x(i);
              const y1 = y(point.value);
              const dx = x(i + 1) - x1;
              const dy = y(next.value) - y1;
              const length = Math.hypot(dx, dy);
              return (
                <View
                  key={`segment-${point.semester}`}
                  style={[
                    styles.segment,
                    { left: x1 + dx / 2 - length / 2, top: y1 + dy / 2 - 1, width: length, transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] },
                  ]}
                />
              );
            })}
            {points.map((point, i) => {
              if (point.value === null) return null;
              const size = i === selected ? SELECTED_MARKER : MARKER;
              return (
                <View
                  key={`marker-${point.semester}`}
                  style={[styles.marker, { width: size, height: size, borderRadius: size / 2, left: x(i) - size / 2, top: y(point.value) - size / 2 }]}
                />
              );
            })}
            {points.map((point, i) => (
              <Pressable
                key={`touch-${point.semester}`}
                onPress={() => setSelected(i)}
                accessibilityRole="button"
                accessibilityLabel={`${semesterLabel(point.semester)}: ${point.value === null ? "dato mancante" : format(point.value)}`}
                style={[styles.touch, { left: x(i) - slot / 2, width: slot }]}
              />
            ))}
          </>
        ) : null}
      </View>
      <View style={styles.years}>
        {width > 0
          ? points.map((point, i) =>
              point.semester.endsWith("-S1") ? (
                <Text key={point.semester} style={[styles.year, { left: x(i) - 20 }]}>
                  {point.semester.slice(0, 4)}
                </Text>
              ) : null
            )
          : null}
      </View>
    </View>
  );
}

export type BarRow = { key: string; label: string; value: number | null; display: string; color?: string };

/** Barre orizzontali con etichetta e valore scritto; con valori negativi lo zero si sposta e quelle barre vanno a sinistra. */
export function BarList({ rows }: { rows: BarRow[] }) {
  const values = rows.map((r) => r.value).filter((v): v is number => v !== null);
  const positive = Math.max(0, ...values);
  const negative = Math.max(0, ...values.map((v) => -v));
  const total = positive + negative || 1;
  const zeroAt = negative / total;

  return (
    <View style={styles.barList}>
      {rows.map((row) => {
        const share = row.value === null ? 0 : Math.abs(row.value) / total;
        const left = row.value !== null && row.value < 0 ? zeroAt - share : zeroAt;
        const color = row.color ?? (row.value !== null && row.value < 0 ? chart.negative : chart.main);
        return (
          <View key={row.key} style={styles.barRow} accessible accessibilityLabel={`${row.label}: ${row.display}`}>
            <View style={styles.barText}>
              <Text style={styles.barLabel}>{row.label}</Text>
              <Text style={styles.barValue}>{row.display}</Text>
            </View>
            <View style={styles.barTrack}>
              {negative > 0 ? <View style={[styles.zeroLine, { left: `${zeroAt * 100}%` }]} /> : null}
              {share > 0 ? (
                <View style={[styles.bar, { left: `${left * 100}%`, width: `${Math.max(share * 100, 1)}%`, backgroundColor: color }]} />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export type SplitPart = { key: string; label: string; value: number; display: string; color: string };

/** Una barra divisa in parti (per esempio prezzo e costi in più), con la legenda che riporta importi e percentuali. */
export function SplitBar({ parts }: { parts: SplitPart[] }) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0) || 1;
  return (
    <View style={styles.split}>
      <View style={styles.splitTrack}>
        {parts.map((part, index) => (
          <View
            key={part.key}
            style={[
              styles.splitPart,
              {
                flex: Math.max(part.value, total * 0.01),
                backgroundColor: part.color,
                borderTopLeftRadius: index === 0 ? 4 : 0,
                borderBottomLeftRadius: index === 0 ? 4 : 0,
                borderTopRightRadius: index === parts.length - 1 ? 4 : 0,
                borderBottomRightRadius: index === parts.length - 1 ? 4 : 0,
              },
            ]}
          />
        ))}
      </View>
      {parts.map((part) => (
        <View key={part.key} style={styles.legendRow} accessible accessibilityLabel={`${part.label}: ${part.display}`}>
          <View style={[styles.legendDot, { backgroundColor: part.color }]} />
          <Text style={styles.legendLabel}>{part.label}</Text>
          <Text style={styles.legendValue}>
            {part.display} <Text style={styles.legendPct}>({Math.round((part.value / total) * 100)}%)</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lineRoot: { gap: space.sm },
  readout: { fontSize: 14, color: colors.muted },
  readoutValue: { fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] },
  gridLine: { position: "absolute", left: 0, height: 1, backgroundColor: chart.grid },
  gridLabel: { position: "absolute", top: -8, fontSize: 11, color: colors.muted, fontVariant: ["tabular-nums"] },
  segment: { position: "absolute", height: 2, backgroundColor: chart.main },
  marker: { position: "absolute", backgroundColor: chart.main, borderWidth: 2, borderColor: colors.card },
  touch: { position: "absolute", top: 0, bottom: 0 },
  years: { height: 16 },
  year: { position: "absolute", width: 40, textAlign: "center", fontSize: 11, color: colors.muted },
  barList: { gap: space.md },
  barRow: { gap: space.xs },
  barText: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  barLabel: { flex: 1, fontSize: 14, color: colors.ink },
  barValue: { fontSize: 14, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] },
  barTrack: { height: 10 },
  zeroLine: { position: "absolute", top: -2, bottom: -2, width: 1, backgroundColor: colors.muted },
  bar: { position: "absolute", top: 0, bottom: 0, borderRadius: 4 },
  split: { gap: space.sm },
  splitTrack: { flexDirection: "row", gap: 2, height: 14 },
  splitPart: { height: 14 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 14, color: colors.ink },
  legendValue: { fontSize: 14, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] },
  legendPct: { fontWeight: "400", color: colors.muted },
});
