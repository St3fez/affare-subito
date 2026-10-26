import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { formatCurrency, formatPercent } from "../lib/format";
import type { StrategyResult } from "../lib/strategies";
import type { Usage } from "../lib/types";
import { Divider, Row } from "../ui/components";
import { colors, space } from "../ui/theme";

const COPY: Record<Usage, { title: string; blurb: string }> = {
  live: { title: "Viverci", blurb: "Confronto con l'affitto che non paghi" },
  longTerm: { title: "Affitto a lungo termine", blurb: "Un inquilino, contratto lungo" },
  students: { title: "Stanze a studenti", blurb: "Più contratti, più gestione" },
  airbnb: { title: "Airbnb", blurb: "Affitti brevi, più incerto" },
};

/** Una voce dell'elenco degli usi: titolo e resa sempre visibili, i conti si aprono con un tocco. */
export function StrategyCard({
  result,
  totalToEnter,
  expanded,
  best,
  onToggle,
  children,
}: {
  result: StrategyResult;
  totalToEnter: number;
  expanded: boolean;
  best: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const copy = COPY[result.usage];
  const live = result.usage === "live";
  const hasIncome = result.monthlyIncome > 0;

  return (
    <View>
      <TouchableOpacity
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${copy.title}, resa netta ${hasIncome ? formatPercent(result.netYieldPct) : "non calcolabile"}`}
        style={styles.head}
      >
        <View style={styles.headText}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.blurb}>{copy.blurb}</Text>
          {best ? <Text style={styles.best}>Resa più alta</Text> : null}
        </View>
        <View style={styles.yieldBox}>
          <Text style={[styles.yield, result.netYieldPct < 0 && { color: colors.bad }]}>{hasIncome ? formatPercent(result.netYieldPct) : "—"}</Text>
          <Text style={styles.yieldLabel}>resa netta</Text>
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.body}>
          <Row label={live ? "Affitto che risparmi, al mese" : "Entrata al mese"} value={formatCurrency(result.monthlyIncome)} />
          <Row label="Spese al mese" value={formatCurrency(result.monthlyCosts)} note="Condominio, IMU, manutenzione e altro" />
          {live ? null : <Row label="Tasse all'anno" value={formatCurrency(result.annualTax)} note="Cedolare secca" />}
          <Row label="Guadagno netto all'anno" value={formatCurrency(result.annualNet)} tone={result.annualNet < 0 ? "bad" : undefined} />
          <Divider />
          <Row label="Costo totale per entrare" value={formatCurrency(totalToEnter)} note="Con lavori e arredo di questo uso" />
          <Row
            label="Dopo la rata del mutuo, al mese"
            value={formatCurrency(result.monthlyCashflow)}
            tone={result.monthlyCashflow < 0 ? "bad" : "good"}
          />
          {result.warnings.map((warning) => (
            <Text key={warning} style={styles.warning}>
              {warning}
            </Text>
          ))}
          {children ? <View style={styles.sliders}>{children}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md, paddingVertical: space.xs },
  headText: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  blurb: { fontSize: 13, color: colors.muted },
  best: { fontSize: 12, fontWeight: "600", color: colors.good, marginTop: 2 },
  yieldBox: { alignItems: "flex-end" },
  yield: { fontSize: 22, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] },
  yieldLabel: { fontSize: 12, color: colors.muted },
  body: { gap: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  warning: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  sliders: { gap: space.md, paddingTop: space.sm },
});
