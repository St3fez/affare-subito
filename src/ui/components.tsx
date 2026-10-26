import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, space } from "./theme";

export function Screen({
  title,
  subtitle,
  onBack,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Indietro" style={styles.back} hitSlop={12}>
            <MaterialIcons name="arrow-back" size={24} color={colors.ink} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.button, variant === "primary" && styles.buttonPrimary, variant === "secondary" && styles.buttonSecondary, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, variant === "primary" ? styles.buttonTextPrimary : styles.buttonTextOther]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  suffix,
  autoCapitalize = "sentences",
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  suffix?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          accessibilityLabel={label}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "bad"; children: React.ReactNode }) {
  const palette =
    tone === "bad"
      ? { backgroundColor: colors.badSoft, borderColor: colors.bad }
      : tone === "warn"
        ? { backgroundColor: colors.warnSoft, borderColor: colors.warn }
        : { backgroundColor: colors.accentSoft, borderColor: colors.accent };
  return (
    <View style={[styles.notice, palette]}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  back: { marginRight: space.md },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: space.xs, lineHeight: 21 },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  footer: { padding: space.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg, gap: space.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.md },
  button: { minHeight: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  buttonTextPrimary: { color: colors.white },
  buttonTextOther: { color: colors.accent },
  field: { gap: space.xs },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.ink },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.white },
  input: { flex: 1, paddingHorizontal: space.md, paddingVertical: space.md, fontSize: 16, color: colors.ink },
  suffix: { paddingRight: space.md, color: colors.muted, fontSize: 15 },
  hint: { fontSize: 13, color: colors.muted },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 14, color: colors.ink },
  chipTextSelected: { color: colors.white, fontWeight: "600" },
  notice: { borderLeftWidth: 4, borderRadius: radius.sm, padding: space.md },
  noticeText: { fontSize: 15, color: colors.ink, lineHeight: 21 },
});

/** Una riga "voce … importo", per i costi e i risultati. */
export function Row({
  label,
  value,
  note,
  bold,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  bold?: boolean;
  tone?: "good" | "bad";
}) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.labelBox}>
        <Text style={[rowStyles.label, bold && rowStyles.bold]}>{label}</Text>
        {note ? <Text style={rowStyles.note}>{note}</Text> : null}
      </View>
      <Text
        style={[rowStyles.value, bold && rowStyles.bold, tone === "good" && { color: colors.good }, tone === "bad" && { color: colors.bad }]}
      >
        {value}
      </Text>
    </View>
  );
}

/** Filetto sottile per separare le sezioni di una stessa scheda. */
export function Divider() {
  return <View style={rowStyles.divider} />;
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space.md },
  labelBox: { flex: 1 },
  label: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  note: { fontSize: 12, color: colors.muted, marginTop: 1 },
  value: { fontSize: 15, color: colors.ink, fontVariant: ["tabular-nums"], textAlign: "right" },
  bold: { fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space.xs },
});
