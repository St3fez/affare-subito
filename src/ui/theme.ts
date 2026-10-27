// Palette partita da quella della v1 (crema e rosso mattone), con tre toni per il verdetto.
export const colors = {
  bg: "#f5efe6",
  card: "#fffaf2",
  ink: "#1e1f1c",
  muted: "#5d6158",
  line: "#d8cfbf",
  accent: "#9a3d14",
  accentSoft: "#f5dfd4",
  white: "#ffffff",
  good: "#2f7d4f",
  goodSoft: "#e3f1e8",
  warn: "#a86a00",
  warnSoft: "#fbefd5",
  bad: "#b3382c",
  badSoft: "#f8e1de",
};

// Colori dei grafici, provati con il validatore di palette sullo sfondo delle schede (#fffaf2): contrasto almeno 3:1 e
// distinguibili anche con daltonismo. `second` affianca `main` quando servono due serie; `negative` è per i valori sotto zero.
export const chart = {
  main: "#9a3d14",
  second: "#b07a12",
  negative: "#8b8579",
  grid: "#e6dccb",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 8, md: 14, lg: 20 };
