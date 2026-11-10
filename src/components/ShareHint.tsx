import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";

import { colors, radius, space } from "../ui/theme";

/**
 * Promemoria sempre in vista nella schermata iniziale: il modo più comodo di usare l'app è "Condividi" dal portale.
 * L'icona pulsa e dondola piano per attirare l'occhio; se il telefono chiede meno animazioni resta ferma.
 */
export function ShareHint() {
  const beat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled || reduce) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(beat, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(beat, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.delay(500),
          ])
        );
        loop.start();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [beat]);

  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const nudge = beat.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  return (
    <View style={styles.box} accessible accessibilityRole="text">
      <Animated.View style={[styles.icon, { transform: [{ translateX: nudge }, { scale }] }]}>
        <MaterialIcons name="share" size={26} color={colors.white} />
      </Animated.View>
      <View style={styles.text}>
        <Text style={styles.title}>Il modo più veloce: condividi l'annuncio</Text>
        <Text style={styles.body}>
          Apri l'annuncio su immobiliare.it, casa.it, idealista.it o tecnocasa.it, tocca l'icona Condividi e scegli{" "}
          <Text style={styles.bold}>Affare Subito</Text>: l'analisi parte da sola.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  bold: { fontWeight: "700" },
});
