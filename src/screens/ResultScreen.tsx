import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { analysisDeps, getHistory } from "../app/deps";
import { BarList, SplitBar } from "../components/charts";
import { EstimateSlider } from "../components/EstimateSlider";
import { StrategyCard, USAGE_TITLES } from "../components/StrategyCard";
import { TrendCard } from "../components/TrendCard";
import { VerdictGauge } from "../components/VerdictGauge";
import { analyzeListing, type AnalysisSettings } from "../lib/analysis";
import type { SavedAnalysis } from "../lib/archive";
import { describeIssue, describeListing } from "../lib/draft";
import { formatCurrency, formatPercent } from "../lib/format";
import { staleDataWarning } from "../lib/staleness";
import { marketTrend } from "../lib/trend";
import { presentVerdict } from "../lib/verdictView";
import type { Assumptions } from "../lib/strategies";
import type { Usage } from "../lib/types";
import { Button, Card, Divider, Notice, Row, Screen } from "../ui/components";
import { chart, colors, space } from "../ui/theme";

export const TONE_COLOR = { good: colors.good, neutral: colors.ink, bad: colors.bad } as const;
export const CONDITION_NOTE = {
  pronto: "nuovo o ristrutturato",
  abitabile: "abitabile",
  da_rinfrescare: "da rinfrescare",
  da_ristrutturare: "da ristrutturare",
} as const;

const perSqm = (value: number) => `${value.toFixed(1).replace(".", ",")} €/mq`;
const decimal = (value: number, digits = 1) => value.toFixed(digits).replace(".", ",");

/** Il risultato dell'analisi: verdetto sul prezzo, costo per entrare e i quattro usi, con le ipotesi da ritoccare. */
export function ResultScreen({
  item,
  lastFree,
  onSettingsChange,
  onBack,
}: {
  item: SavedAnalysis;
  lastFree: boolean;
  onSettingsChange: (settings: AnalysisSettings) => void;
  onBack: () => void;
}) {
  const [settings, setSettings] = useState(item.settings);
  const [open, setOpen] = useState<Usage | null>(null);
  const analysis = useMemo(() => analyzeListing(item.listing, settings, analysisDeps), [item.listing, settings]);

  const update = (patch: Partial<AnalysisSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    onSettingsChange(next);
  };
  const updateAssumptions = (patch: Partial<Assumptions>) => update({ assumptions: { ...settings.assumptions, ...patch } });

  if (analysis.kind === "unsupported") {
    return (
      <Screen title="Non posso analizzarlo" onBack={onBack}>
        <Notice tone="bad">{describeIssue(analysis.reason)}</Notice>
        <Button label="Torna indietro" variant="secondary" onPress={onBack} />
      </Screen>
    );
  }

  const { verdict, market, acquisition, strategies, totalToEnter, listing } = analysis;
  const a = settings.assumptions;
  const bestUsage = strategies.filter((s) => s.monthlyIncome > 0).sort((x, y) => y.netYieldPct - x.netYieldPct)[0]?.usage;
  const nightlyDefault = Math.round(analysis.rentSqm * (listing.sqm ?? 0) / 10);
  const renovationMax = Math.max(100000, Math.round((analysis.renovation * 3) / 1000) * 1000);

  const unverified = [
    ["la provvigione dell'agenzia", analysisDeps.fiscal.agencyPct],
    ["l'onorario del notaio", analysisDeps.fiscal.notaryEstimate],
    ["il costo dei lavori", analysisDeps.costs.renovationPerSqm.medio],
    ["il costo dell'arredo", analysisDeps.costs.furnishing.airbnbPerSqm],
  ].filter(([, param]) => (param as { verifiedAt: string | null }).verifiedAt === null).map(([label]) => label as string);

  const sliders: Record<Usage, React.ReactNode> = {
    live: null,
    longTerm: (
      <EstimateSlider
        label="Mesi senza inquilino all'anno"
        value={a.vacancyMonthsLongTerm}
        min={0}
        max={4}
        step={0.5}
        format={(v) => decimal(v)}
        onCommit={(v) => updateAssumptions({ vacancyMonthsLongTerm: v })}
      />
    ),
    students: (
      <>
        <EstimateSlider
          label="Canone delle stanze rispetto all'intera casa"
          value={a.studentRoomFactor}
          min={1}
          max={1.8}
          step={0.05}
          format={(v) => `×${decimal(v, 2)}`}
          onCommit={(v) => updateAssumptions({ studentRoomFactor: v })}
        />
        <EstimateSlider
          label="Mesi con stanze vuote all'anno"
          value={a.vacancyMonthsStudents}
          min={0}
          max={6}
          step={0.5}
          format={(v) => decimal(v)}
          onCommit={(v) => updateAssumptions({ vacancyMonthsStudents: v })}
        />
      </>
    ),
    airbnb: (
      <>
        <EstimateSlider
          label="Prezzo per notte"
          value={a.airbnbNightlyRate ?? Math.min(400, Math.max(20, nightlyDefault))}
          min={20}
          max={400}
          step={5}
          format={(v) => formatCurrency(v)}
          onCommit={(v) => updateAssumptions({ airbnbNightlyRate: v })}
        />
        <EstimateSlider
          label="Notti occupate"
          value={a.airbnbOccupancyPct}
          min={20}
          max={90}
          step={5}
          format={(v) => `${v}%`}
          onCommit={(v) => updateAssumptions({ airbnbOccupancyPct: v })}
        />
      </>
    ),
  };

  const staleWarning = market ? staleDataWarning(market.semester, new Date()) : null;
  const scope = market ? { precision: market.precision, zoneCount: market.zoneCodes.length } : undefined;
  const view = verdict ? presentVerdict(verdict, staleWarning, market?.semester, scope) : null;
  const history = getHistory();
  const trend = market && history ? marketTrend(history, market.istat, market.zoneCodes) : null;
  const price = listing.price ?? 0;
  const extras = Math.max(0, totalToEnter.live - price);

  return (
    <Screen title={listing.title || "Risultato"} subtitle={describeListing(listing)} onBack={onBack}>
      {staleWarning ? <Notice tone="warn">{staleWarning}</Notice> : null}
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
          <Text style={styles.small}>
            {market?.label} · valori OMI {market?.semester} per immobili {CONDITION_NOTE[listing.condition ?? "abitabile"]}
          </Text>
        </Card>
      ) : (
        <Notice tone="warn">
          {market
            ? "Per questo immobile non ho una fascia di prezzo con cui confrontarlo."
            : "Non ho i valori di mercato di questo comune, quindi non posso dire se il prezzo è buono."}{" "}
          I costi si vedono lo stesso. Per i redditi, inserisci tu l'affitto al mq nelle ipotesi in fondo.
        </Notice>
      )}

      {lastFree ? <Notice>Era la tua ultima analisi gratuita. Per analizzarne altre serve un contributo da 0,99 € che vale un anno.</Notice> : null}

      {trend && market ? <TrendCard trend={trend} initial="sale" precision={market.precision} /> : null}

      <Card>
        <Text style={styles.section}>Quanto costa entrare</Text>
        <SplitBar
          parts={[
            { key: "price", label: "Prezzo", value: price, display: formatCurrency(price), color: chart.main },
            { key: "extras", label: "Costi in più", value: extras, display: formatCurrency(extras), color: chart.second },
          ]}
        />
        <Divider />
        <Row label="Prezzo richiesto" value={formatCurrency(price)} />
        <Row label="Imposta di registro" value={formatCurrency(acquisition.registro)} note="Calcolata sul prezzo: è una stima per eccesso" />
        <Row label="Imposte ipotecaria e catastale" value={formatCurrency(acquisition.ipotecariaCatastale)} />
        <Row label="Notaio" value={formatCurrency(acquisition.notary)} note="Stima" />
        <Row label="Agenzia" value={formatCurrency(acquisition.agency)} note="Stima, IVA compresa" />
        <Row
          label="Lavori"
          value={formatCurrency(analysis.renovation)}
          note={settings.renovationOverride != null ? "Inseriti da te" : listing.condition ? `Stima, immobile ${CONDITION_NOTE[listing.condition]}` : "Stato non indicato: nessun lavoro stimato"}
        />
        <Divider />
        <Row label="Totale, senza arredo" value={formatCurrency(totalToEnter.live)} bold />
        {listing.condoMonthly == null ? <Text style={styles.small}>Spese condominiali non indicate: non sono incluse nei conti.</Text> : null}
      </Card>

      <Card>
        <Text style={styles.section}>Come potresti usarla</Text>
        <BarList
          rows={strategies.map((strategy) => {
            const value = strategy.monthlyIncome > 0 ? strategy.netYieldPct : null;
            return { key: strategy.usage, label: USAGE_TITLES[strategy.usage], value, display: value === null ? "—" : formatPercent(value) };
          })}
        />
        <Text style={styles.small}>Resa netta all'anno. Tocca un uso qui sotto per vedere i conti.</Text>
        <Divider />
        {strategies.map((strategy, index) => (
          <View key={strategy.usage} style={styles.strategy}>
            {index > 0 ? <Divider /> : null}
            <StrategyCard
              result={strategy}
              totalToEnter={totalToEnter[strategy.usage]}
              expanded={open === strategy.usage}
              best={strategy.usage === bestUsage}
              secondHomeTax={settings.firstHome && strategy.usage !== "live"}
              onToggle={() => setOpen(open === strategy.usage ? null : strategy.usage)}
            >
              {sliders[strategy.usage]}
            </StrategyCard>
          </View>
        ))}
        <Text style={styles.small}>Resa netta = guadagno annuo dopo spese e tasse, diviso per il costo totale per entrare.</Text>
      </Card>

      <Card>
        <Text style={styles.section}>Mutuo e altre ipotesi</Text>
        <Row label="Rata del mutuo" value={`${formatCurrency(analysis.mortgageMonthly)} al mese`} bold />
        <EstimateSlider label="Anticipo" value={settings.downPaymentPct} min={0} max={100} step={5} format={(v) => `${v}%`} onCommit={(v) => update({ downPaymentPct: v })} />
        <EstimateSlider label="Tasso del mutuo" value={settings.ratePct} min={0.5} max={8} step={0.1} format={(v) => `${decimal(v)}%`} onCommit={(v) => update({ ratePct: v })} />
        <EstimateSlider label="Durata del mutuo" value={settings.years} min={5} max={30} step={1} format={(v) => `${v} anni`} onCommit={(v) => update({ years: v })} />
        <EstimateSlider
          label="Lavori"
          value={Math.min(renovationMax, analysis.renovation)}
          min={0}
          max={renovationMax}
          step={1000}
          format={(v) => formatCurrency(v)}
          onCommit={(v) => update({ renovationOverride: v })}
        />
        <EstimateSlider
          label={market ? "Affitto di zona al mq" : "Affitto al mq (nessun dato di zona)"}
          value={Math.min(60, analysis.rentSqm)}
          min={0}
          max={60}
          step={0.5}
          format={perSqm}
          onCommit={(v) => update({ manualRentSqm: v > 0 ? v : null })}
        />
      </Card>

      <Text style={styles.footnote}>
        Valori di mercato: Fonte Agenzia Entrate - OMI{market ? `, ${market.semester}` : ""}. Le cifre segnate «stima» non hanno una tariffa ufficiale: sono valori tipici che puoi modificare.
        {unverified.length > 0 ? ` Da verificare con un preventivo: ${unverified.join(", ")}.` : ""} Non è una consulenza finanziaria, fiscale o legale.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  verdict: { fontSize: 24, fontWeight: "700" },
  muted: { fontSize: 14, color: colors.muted },
  small: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  section: { fontSize: 18, fontWeight: "700", color: colors.ink },
  strategy: { gap: space.xs },
  footnote: { fontSize: 12, color: colors.muted, lineHeight: 17, paddingHorizontal: space.xs },
});
