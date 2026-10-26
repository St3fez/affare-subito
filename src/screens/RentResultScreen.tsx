import React, { useMemo } from "react";
import { StyleSheet, Text } from "react-native";

import { analysisDeps, getHistory } from "../app/deps";
import { BarList } from "../components/charts";
import { TrendCard } from "../components/TrendCard";
import { VerdictGauge } from "../components/VerdictGauge";
import type { SavedAnalysis } from "../lib/archive";
import { describeIssue, describeListing } from "../lib/draft";
import { formatCurrency } from "../lib/format";
import { analyzeRental } from "../lib/rent";
import { staleDataWarning } from "../lib/staleness";
import { marketTrend } from "../lib/trend";
import { presentVerdict } from "../lib/verdictView";
import { Button, Card, Divider, Notice, Row, Screen } from "../ui/components";
import { chart, colors, space } from "../ui/theme";
import { CONDITION_NOTE, TONE_COLOR } from "./ResultScreen";

/** Il risultato per chi cerca casa in affitto: il canone è giusto, come vanno gli affitti in zona, e se comprare costerebbe meno. */
export function RentResultScreen({ item, lastFree, onBack }: { item: SavedAnalysis; lastFree: boolean; onBack: () => void }) {
  const analysis = useMemo(() => analyzeRental(item.listing, item.settings, analysisDeps), [item.listing, item.settings]);

  if (analysis.kind === "unsupported") {
    return (
      <Screen title="Non posso analizzarlo" onBack={onBack}>
        <Notice tone="bad">{describeIssue(analysis.reason)}</Notice>
        <Button label="Torna indietro" variant="secondary" onPress={onBack} />
      </Screen>
    );
  }

  const { verdict, market, fairRent, buy, listing, warnings } = analysis;
  const settings = item.settings;
  const rent = listing.price ?? 0;
  const staleWarning = market ? staleDataWarning(market.semester, new Date()) : null;
  const scope = market ? { precision: market.precision, zoneCount: market.zoneCodes.length } : undefined;
  const view = verdict ? presentVerdict(verdict, staleWarning, market?.semester, scope) : null;
  const history = getHistory();
  const trend = market && history ? marketTrend(history, market.istat, market.zoneCodes) : null;

  return (
    <Screen title={listing.title || "Affitto"} subtitle={describeListing(listing)} onBack={onBack}>
      {staleWarning ? <Notice tone="warn">{staleWarning}</Notice> : null}
      {warnings.includes("looks_like_sale") ? <Notice tone="warn">{describeIssue("looks_like_sale")}</Notice> : null}

      {verdict && view ? (
        <Card>
          <Text style={[styles.verdict, { color: TONE_COLOR[view.tone] }]}>{view.headline}</Text>
          <Text style={styles.muted}>{view.detail}</Text>
          <VerdictGauge
            verdict={verdict}
            neutral={view.tone === "neutral"}
            place={market?.precision === "zona" ? "della zona" : "del comune"}
            label={`${view.headline}. ${view.detail}`}
          />
          {fairRent ? (
            <Text style={styles.fair}>
              Per {listing.sqm} m² {market?.precision === "zona" ? "in questa zona" : "nel comune"} un canone tipico va da {formatCurrency(fairRent.min)} a{" "}
              {formatCurrency(fairRent.max)} al mese.
            </Text>
          ) : null}
          <Text style={styles.small}>
            {market?.label} · valori OMI {market?.semester} per immobili {CONDITION_NOTE[listing.condition ?? "abitabile"]}
          </Text>
        </Card>
      ) : (
        <Notice tone="warn">
          {market
            ? "Per questo immobile non ho una fascia di canoni con cui confrontarlo."
            : "Non ho i valori di mercato di questo comune, quindi non posso dire se il canone è giusto."}
        </Notice>
      )}

      {lastFree ? <Notice>Era la tua ultima analisi gratuita. Per analizzarne altre serve un contributo da 0,99 € che vale un anno.</Notice> : null}

      {trend && market ? <TrendCard trend={trend} initial="rent" precision={market.precision} /> : null}

      {buy ? (
        <Card>
          <Text style={styles.section}>E se comprassi?</Text>
          <Text style={styles.muted}>
            Una casa così, {market?.precision === "zona" ? "nella stessa zona" : "al valore medio del comune"}, costa circa {formatCurrency(buy.price)}.
          </Text>
          <BarList
            rows={[
              { key: "rent", label: "Canone di questa casa", value: rent, display: `${formatCurrency(rent)} al mese`, color: chart.main },
              {
                key: "mortgage",
                label: "Rata per comprarne una simile",
                value: buy.mortgageMonthly,
                display: `${formatCurrency(buy.mortgageMonthly)} al mese`,
                color: chart.second,
              },
            ]}
          />
          <Divider />
          <Row label="Prezzo stimato" value={formatCurrency(buy.price)} note="Valore medio di zona per i metri quadri" />
          <Row
            label="Soldi da avere subito"
            value={formatCurrency(buy.upfront)}
            note={`Anticipo del ${settings.downPaymentPct}%, più imposte da prima casa, notaio e agenzia`}
            bold
          />
          <Text style={styles.small}>
            Mutuo al {String(settings.ratePct).replace(".", ",")}% per {settings.years} anni. La rata non comprende condominio, manutenzione e
            assicurazione; in cambio, alla fine la casa è tua.
          </Text>
        </Card>
      ) : null}

      <Text style={styles.footnote}>
        Valori di mercato: Fonte Agenzia Entrate - OMI{market ? `, ${market.semester}` : ""}. Le quotazioni OMI sono indicative e non sostituiscono una
        stima. Non è una consulenza finanziaria, fiscale o legale.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  verdict: { fontSize: 24, fontWeight: "700" },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  fair: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  small: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  section: { fontSize: 18, fontWeight: "700", color: colors.ink },
  footnote: { fontSize: 12, color: colors.muted, lineHeight: 17, paddingHorizontal: space.xs },
});
