import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

type Goal = "flip" | "rent";
type PropertyCondition = "pronto" | "abitabile" | "da_rinfrescare" | "da_ristrutturare";
type RenovationLevel = "nessuno" | "leggero" | "medio" | "pesante" | "personalizzato";
type ScoreColor = "verde" | "giallo" | "rosso";
type Screen =
  | "home"
  | "manualForm"
  | "aiInput"
  | "aiReview"
  | "result"
  | "archive"
  | "settings"
  | "detail"
  | "compare";
type MainTab = "home" | "analyze" | "archive" | "settings";
type AppLanguage = "it" | "en" | "de" | "fr" | "es";
type TranslationFn = (text: string) => string;

type InvestorSettings = {
  minFlipMarginPct: number;
  minRentYieldPct: number;
  maxBudget: number;
  defaultUnexpectedPct: number;
  lightRenovationPerSqm: number;
  mediumRenovationPerSqm: number;
  heavyRenovationPerSqm: number;
  defaultAgencyPct: number;
  defaultTaxesAndNotary: number;
  defaultAreaPricePerSqm: number;
  defaultMortgageYears: number;
  defaultDownPaymentPct: number;
  defaultFixedRatePct: number;
  defaultVariableRatePct: number;
};

type AISettings = {
  apiKey: string;
  model: string;
};

type BillingSettings = {
  isProUnlocked: boolean;
  stripeCheckoutUrl: string;
};

type PropertyForm = {
  id: string;
  title: string;
  city: string;
  province: string;
  country: string;
  zone: string;
  askingPrice: string;
  sqm: string;
  bedrooms: string;
  bathrooms: string;
  propertyType: string;
  floor: string;
  hasElevator: boolean;
  hasCellar: boolean;
  hasGarage: boolean;
  hasGarden: boolean;
  condition: PropertyCondition;
  goal: Goal;
  resalePrice: string;
  monthlyRent: string;
  renovationLevel: RenovationLevel;
  renovationCost: string;
  unexpectedPct: string;
  taxesAndNotary: string;
  agencyFee: string;
  furnitureCost: string;
  otherCosts: string;
  areaAveragePricePerSqm: string;
  estimatedMarketValue: string;
  mortgageDownPaymentPct: string;
  mortgageYears: string;
  fixedMortgageRate: string;
  variableMortgageRate: string;
  notes: string;
};

type AnalysisResult = {
  totalInvestment: number;
  renovationCost: number;
  accessoryCosts: number;
  grossMargin: number;
  grossMarginPct: number;
  annualRent: number;
  grossYieldPct: number;
  netYieldPct: number;
  score: number;
  color: ScoreColor;
  summary: string;
};

type SavedAnalysis = {
  id: string;
  createdAt: string;
  form: PropertyForm;
  result: AnalysisResult;
};

type SavedMemorySnapshot = {
  askingPrice: number;
  sqm: number;
  pricePerSqm: number;
  areaBenchmarkPerSqm: number;
  totalInvestment: number;
  performanceValue: number;
  downPaymentPct: number;
  downPaymentAmount: number;
  fixedRatePct: number;
  variableRatePct: number;
  fixedMonthlyPayment: number;
  variableMonthlyPayment: number;
};

type ValidationReport = {
  errors: string[];
  warnings: string[];
};

type PickedImage = {
  uri: string;
  base64: string;
  mimeType: string;
  fileName: string;
};

type ExtractionMeta = {
  source: "local_text" | "local_image" | "ai_text" | "ai_image";
  confidence: number;
  note: string;
  rawText: string;
};

type DevOcrRegressionExpectation = Partial<
  Pick<PropertyForm, "askingPrice" | "city" | "zone" | "sqm" | "bathrooms" | "monthlyRent" | "floor" | "propertyType" | "hasElevator" | "hasGarage">
>;

type DevOcrRegressionCase = {
  id: string;
  label: string;
  ocrText: string;
  imageFileName?: string;
  expected: DevOcrRegressionExpectation;
};

type AIExtractionPayload = {
  title: string;
  city: string;
  country: string;
  zone: string;
  askingPrice: number;
  sqm: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  floor: string;
  hasElevator: "yes" | "no" | "unknown";
  hasCellar: "yes" | "no" | "unknown";
  hasGarage: "yes" | "no" | "unknown";
  hasGarden: "yes" | "no" | "unknown";
  condition: PropertyCondition | "unknown";
  goal: Goal | "unknown";
  resalePrice: number;
  monthlyRent: number;
  renovationLevel: RenovationLevel | "unknown";
  renovationCost: number;
  notes: string;
  rawText: string;
  confidence: number;
  reasoningNotes: string;
};

type MoneyCandidate = {
  value: number;
  index: number;
  context: string;
};

type LocalLinkExtraction = {
  url: string;
  text: string;
  note: string;
  confidence: number;
};

type AnalysisSupport = {
  comparableCount: number;
  areaBenchmarkLabel: string;
  suggestedAreaPricePerSqm: number;
  effectiveAreaPricePerSqm: number;
  suggestedEstimatedMarketValue: number;
  effectiveEstimatedMarketValue: number;
  priceGapPct: number;
  suggestedRenovationCost: number;
  suggestedResalePrice: number;
  suggestedMonthlyRent: number;
  suggestedAgencyFee: number;
  suggestedTaxesAndNotary: number;
  suggestedUnexpectedPct: number;
  suggestedUnexpectedValue: number;
  suggestedAccessoryCosts: number;
  downPaymentAmount: number;
  effectiveDownPaymentPct: number;
  effectiveMortgageYears: number;
  effectiveFixedRate: number;
  effectiveVariableRate: number;
  mortgagePrincipal: number;
  fixedMonthlyPayment: number;
  variableMonthlyPayment: number;
  fixedTotalInterest: number;
  variableTotalInterest: number;
};

type VerifiedMarketData = {
  canonicalCity: string;
  countryCode: string;
  countryName: string;
  priceCityCentrePerSqm: number | null;
  priceOutsideCentrePerSqm: number | null;
  mortgageFixedPct: number | null;
  mortgageVariablePct: number | null;
  renovationLightPerSqm: number | null;
  renovationMediumPerSqm: number | null;
  renovationHeavyPerSqm: number | null;
  transferCostPct: number | null;
  areaSourceUrl: string;
  ratesSourceUrl: string;
  transferCostSourceUrl: string;
  areaUpdatedAt: string;
  ratesUpdatedAt: string;
  transferCostUpdatedAt: string;
};

type CoachMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type DraftPayload = {
  form: PropertyForm;
  aiText: string;
  extractionMeta: ExtractionMeta | null;
  updatedAt: string;
  verifiedMarketData?: VerifiedMarketData | null;
};

type VoiceGuideStepId =
  | "province"
  | "city"
  | "zone"
  | "askingPrice"
  | "sqm"
  | "goal"
  | "goalValue"
  | "condition"
  | "propertyType"
  | "bedrooms"
  | "bathrooms"
  | "floor"
  | "hasElevator"
  | "hasCellar"
  | "hasGarage"
  | "hasGarden";
type AcquisitionMode = "voice-guide" | "free-dictation" | "paste-text" | "screenshot";

const STORAGE_KEYS = {
  analyses: "affare_subito_analyses",
  settings: "affare_subito_settings",
  aiSettings: "affare_subito_ai_settings",
  billing: "affare_subito_billing",
  draft: "affare_subito_draft",
  language: "affare_subito_language",
  debugBootScreen: "affare_subito_debug_boot_screen",
};

const AI_ENDPOINT = "https://api.openai.com/v1/responses";

const defaultSettings: InvestorSettings = {
  minFlipMarginPct: 20,
  minRentYieldPct: 6,
  maxBudget: 250000,
  defaultUnexpectedPct: 10,
  lightRenovationPerSqm: 0,
  mediumRenovationPerSqm: 0,
  heavyRenovationPerSqm: 0,
  defaultAgencyPct: 3,
  defaultTaxesAndNotary: 0,
  defaultAreaPricePerSqm: 0,
  defaultMortgageYears: 25,
  defaultDownPaymentPct: 20,
  defaultFixedRatePct: 0,
  defaultVariableRatePct: 0,
};

const defaultAISettings: AISettings = {
  apiKey: "",
  model: "gpt-4.1-mini",
};

const defaultBillingSettings: BillingSettings = {
  isProUnlocked: false,
  stripeCheckoutUrl: "",
};

const FREE_PLAN_MAX_ANALYSES = 2;
const COMPARE_CARD_PALETTE = [
  { backgroundColor: "#eef6ff", borderColor: "#bfd7f6", accentColor: "#1f4b8f", textColor: "#17365d" },
  { backgroundColor: "#fff3eb", borderColor: "#efc4a5", accentColor: "#b55d24", textColor: "#6b3e11" },
  { backgroundColor: "#eef9f1", borderColor: "#bfdcc7", accentColor: "#2f855a", textColor: "#1f5b40" },
  { backgroundColor: "#fff8e8", borderColor: "#e6cf95", accentColor: "#a36a00", textColor: "#6d4a00" },
  { backgroundColor: "#fff0f1", borderColor: "#f1c3c8", accentColor: "#b8324b", textColor: "#742032" },
] as const;

const PREFILL_PLACEHOLDER_COLOR = "#b9b2a8";
const DESCRIPTION_COACH_WELCOME =
  "Assistente descrizione gratis attivo. Scrivi cosa vuoi valorizzare e ti guido passo-passo.";

const VOICE_GUIDE_STEPS: VoiceGuideStepId[] = [
  "province",
  "city",
  "zone",
  "askingPrice",
  "sqm",
  "goal",
  "goalValue",
  "condition",
  "propertyType",
  "bedrooms",
  "bathrooms",
  "floor",
  "hasElevator",
  "hasCellar",
  "hasGarage",
  "hasGarden",
];

const SUPPORTED_LANGUAGES: AppLanguage[] = ["it", "en", "de", "fr", "es"];

const VOICE_NOISE_WORDS = [
  "eh",
  "em",
  "mmm",
  "uh",
  "ah",
  "okay",
  "ok",
  "pronto",
  "ciao",
];

const VOICE_CONTEXT_STRINGS = [
  "provincia",
  "comune",
  "citta",
  "quartiere",
  "zona",
  "prezzo",
  "metri quadri",
  "affitto",
  "rivendita",
  "monolocale",
  "bilocale",
  "trilocale",
  "pronto",
  "abitabile",
  "rinfrescare",
  "ristrutturare",
  "camere",
  "bagni",
  "si",
  "no",
  "ascensore",
  "cantina",
  "garage",
  "giardino",
  "salta",
];

const UI_TEXT: Record<AppLanguage, Record<string, string>> = {
  it: {
    homeTab: "Home",
    analyzeTab: "Analisi",
    archiveTab: "Archivio",
    settingsTab: "Config",
    settingsTitle: "Impostazioni",
    settingsSubtitle: "Parametri investitore e integrazione API AI reale.",
    languageTitle: "Lingua app",
    investorParams: "Parametri investitore",
    manualTitle: "Nuova analisi",
    manualSubtitle: "Compilazione guidata con controlli live e preview economica.",
    aiInputTitle: "Importa annuncio",
    aiInputSubtitle: "Usa parser locale da testo, guida descrizione gratis o OCR da screenshot.",
    assistedCompilation: "Compilazione assistita",
    updateLocalData: "Aggiorna dati locali verificati",
    updatingLocalData: "Aggiornamento dati locali...",
    noVerifiedData: "Nessun dato locale verificato caricato: i prefill restano vuoti o da archivio interno.",
    autosaveActive: "Autosave attivo",
    fillFromText: "Compila dal testo",
    ocrScreenshot: "OCR screenshot",
    calculate: "Calcola convenienza",
    saveAnalysis: "Salva analisi",
  },
  en: {
    homeTab: "Home",
    analyzeTab: "Analysis",
    archiveTab: "Archive",
    settingsTab: "Settings",
    settingsTitle: "Settings",
    settingsSubtitle: "Investor parameters and real AI API integration.",
    languageTitle: "App language",
    investorParams: "Investor parameters",
    manualTitle: "New analysis",
    manualSubtitle: "Guided form with live checks and financial preview.",
    aiInputTitle: "Import listing",
    aiInputSubtitle: "Use local text parser, free AI writing guide, or screenshot OCR.",
    assistedCompilation: "Assisted input",
    updateLocalData: "Refresh verified local data",
    updatingLocalData: "Refreshing local data...",
    noVerifiedData: "No verified local data loaded: prefills stay empty or use your internal archive.",
    autosaveActive: "Autosave enabled",
    fillFromText: "Fill from text",
    ocrScreenshot: "Screenshot OCR",
    calculate: "Calculate profitability",
    saveAnalysis: "Save analysis",
  },
  de: {
    homeTab: "Start",
    analyzeTab: "Analyse",
    archiveTab: "Archiv",
    settingsTab: "Optionen",
    settingsTitle: "Einstellungen",
    settingsSubtitle: "Investor-Parameter und reale KI-API-Integration.",
    languageTitle: "App-Sprache",
    investorParams: "Investor-Parameter",
    manualTitle: "Neue Analyse",
    manualSubtitle: "Gefuehrtes Formular mit Live-Pruefungen und Finanzvorschau.",
    aiInputTitle: "Inserat importieren",
    aiInputSubtitle: "Lokalen Textparser, kostenlose KI-Hilfe oder Screenshot-OCR nutzen.",
    assistedCompilation: "Assistentenmodus",
    updateLocalData: "Verifizierte lokale Daten aktualisieren",
    updatingLocalData: "Lokale Daten werden aktualisiert...",
    noVerifiedData: "Keine verifizierten lokalen Daten geladen: Prefills bleiben leer oder nutzen das interne Archiv.",
    autosaveActive: "Autosave aktiv",
    fillFromText: "Aus Text fuellen",
    ocrScreenshot: "Screenshot-OCR",
    calculate: "Wirtschaftlichkeit berechnen",
    saveAnalysis: "Analyse speichern",
  },
  fr: {
    homeTab: "Accueil",
    analyzeTab: "Analyse",
    archiveTab: "Archive",
    settingsTab: "Reglages",
    settingsTitle: "Parametres",
    settingsSubtitle: "Parametres investisseur et integration API IA reelle.",
    languageTitle: "Langue de l'app",
    investorParams: "Parametres investisseur",
    manualTitle: "Nouvelle analyse",
    manualSubtitle: "Saisie guidee avec controles en direct et apercu financier.",
    aiInputTitle: "Importer l'annonce",
    aiInputSubtitle: "Utilisez le parseur local, l'aide IA gratuite ou l'OCR screenshot.",
    assistedCompilation: "Saisie assistee",
    updateLocalData: "Mettre a jour les donnees locales verifiees",
    updatingLocalData: "Mise a jour des donnees locales...",
    noVerifiedData: "Aucune donnee locale verifiee chargee : prefills vides ou archive interne.",
    autosaveActive: "Autosave actif",
    fillFromText: "Remplir depuis texte",
    ocrScreenshot: "OCR screenshot",
    calculate: "Calculer la rentabilite",
    saveAnalysis: "Enregistrer l'analyse",
  },
  es: {
    homeTab: "Inicio",
    analyzeTab: "Analisis",
    archiveTab: "Archivo",
    settingsTab: "Ajustes",
    settingsTitle: "Ajustes",
    settingsSubtitle: "Parametros del inversor e integracion real de API IA.",
    languageTitle: "Idioma de la app",
    investorParams: "Parametros del inversor",
    manualTitle: "Nuevo analisis",
    manualSubtitle: "Formulario guiado con controles en vivo y vista financiera.",
    aiInputTitle: "Importar anuncio",
    aiInputSubtitle: "Usa parser local de texto, guia IA gratis u OCR de captura.",
    assistedCompilation: "Carga asistida",
    updateLocalData: "Actualizar datos locales verificados",
    updatingLocalData: "Actualizando datos locales...",
    noVerifiedData: "Sin datos locales verificados: prefills vacios o archivo interno.",
    autosaveActive: "Autosave activo",
    fillFromText: "Completar desde texto",
    ocrScreenshot: "OCR captura",
    calculate: "Calcular conveniencia",
    saveAnalysis: "Guardar analisis",
  },
};

const INLINE_TRANSLATIONS: Record<Exclude<AppLanguage, "it">, Record<string, string>> = {
  en: {
    "← Indietro": "← Back",
    Controlli: "Checks",
    "Nessun blocco: i dati sono coerenti per un primo calcolo.": "No blockers: data is consistent for an initial estimate.",
    "Controlli live": "Live checks",
    "Anagrafica immobile": "Property details",
    "Titolo immobile": "Property title",
    "Citta'": "City",
    Paese: "Country",
    "Zona / quartiere": "Area / district",
    "Italia, Germania, Francia...": "Italy, Germany, France...",
    Tipologia: "Property type",
    "bilocale, trilocale, loft...": "two-room, three-room, loft...",
    "Metri quadri": "Square meters",
    Piano: "Floor",
    "Usa 0 per piano terra e -1 per seminterrato.": "Use 0 for ground floor and -1 for basement.",
    Ascensore: "Elevator",
    "Stato immobile": "Property condition",
    Pronto: "Ready",
    Abitabile: "Livable",
    "Da rinfrescare": "Needs refreshing",
    "Da ristrutturare": "To renovate",
    "Scenario d'investimento": "Investment scenario",
    "Prezzo richiesto (€)": "Asking price (€)",
    Obiettivo: "Goal",
    Rivendita: "Resale",
    Affitto: "Rent",
    "Prezzo rivendita stimato (€)": "Estimated resale price (€)",
    "Canone mensile stimato (€)": "Estimated monthly rent (€)",
    "Livello lavori": "Renovation level",
    Nessuno: "None",
    Leggero: "Light",
    Medio: "Medium",
    Pesante: "Heavy",
    Personalizzato: "Custom",
    "Costo lavori personalizzato (€)": "Custom renovation cost (€)",
    "Benchmark area e mutuo": "Area benchmark and mortgage",
    "Prezzo medio zona (€/mq)": "Average area price (€/sqm)",
    "Valore medio stimato immobile (€)": "Estimated average property value (€)",
    "Delta rispetto al richiesto": "Delta vs asking price",
    "Anticipo mutuo (%)": "Mortgage down payment (%)",
    "Durata mutuo (anni)": "Mortgage duration (years)",
    "Tasso fisso (%)": "Fixed rate (%)",
    "Tasso variabile (%)": "Variable rate (%)",
    "Costi accessori e note": "Additional costs and notes",
    "Imprevisti (%)": "Contingency (%)",
    "Imposte e notaio (€)": "Taxes and notary (€)",
    "Commissione agenzia (€)": "Agency fee (€)",
    "Arredo (€)": "Furniture (€)",
    "Altri costi (€)": "Other costs (€)",
    Note: "Notes",
    "Appunti, ipotesi, criticita', timing...": "Notes, assumptions, risks, timing...",
    "Dashboard investitore": "Investor dashboard",
    "Vista rapida, archivio e flussi di acquisizione.": "Quick overview, archive and intake flows.",
    "Analizza immobili, pulisci i dati e confronta le opportunita'.": "Analyze properties, clean data, and compare opportunities.",
    "Parser locale piu' robusto, revisione AI/OCR e criteri piu' severi prima del calcolo.": "More robust local parser, AI/OCR review and stricter checks before calculation.",
    "Nuova analisi manuale": "New manual analysis",
    "Parser AI / OCR": "AI / OCR parser",
    Analisi: "Analyses",
    "Budget max": "Max budget",
    "Margine min": "Min margin",
    "Rendimento min": "Min yield",
    "Distribuzione archivio": "Archive distribution",
    Verdi: "Green",
    Gialli: "Yellow",
    Rossi: "Red",
    "Miglior immobile salvato": "Best saved property",
    "Immobile senza titolo": "Untitled property",
    "Apri dettaglio": "Open details",
    "Archivio ancora vuoto": "Archive still empty",
    "Dopo il primo salvataggio vedrai trend, confronti e benchmark interni.": "After the first save you'll see trends, comparisons, and internal benchmarks.",
    "Metodo di acquisizione": "Acquisition method",
    Manuale: "Manual",
    "AI / OCR": "AI / OCR",
    "Usa il microfono per una compilazione guidata a domande oppure incolla un annuncio/OCR e auto-compila.": "Use the microphone for guided Q&A input, or paste listing/OCR text for auto-fill.",
    "Copia/incolla qui annuncio o appunti (poi premi Compila dal testo)": "Paste listing or notes here (then tap Fill from text)",
    Assistente: "Assistant",
    Tu: "You",
    Salta: "Skip",
    Continua: "Continue",
    "Stato integrazione AI": "AI integration status",
    "La chiave serve solo per estrazione AI remota/OCR e viene salvata localmente via AsyncStorage.": "The key is only used for remote AI/OCR extraction and is stored locally via AsyncStorage.",
    "Annuncio testuale": "Text listing",
    "Guida descrizione AI (gratis)": "AI description guide (free)",
    "Nessuna API key: risposte locali guidate e bozza pronta da inserire.": "No API key: guided local replies and ready-to-insert draft.",
    "AI gratis": "Free AI",
    Invia: "Send",
    "Inserisci bozza": "Insert draft",
    "Parser locale avanzato": "Advanced local parser",
    "OCR da screenshot": "Screenshot OCR",
    "Seleziona uno screenshot e lascia all'AI OCR + parsing.": "Select a screenshot and let AI run OCR + parsing.",
    "Pronto per l'estrazione.": "Ready for extraction.",
    "Seleziona screenshot": "Select screenshot",
    "Revisione estrazione": "Extraction review",
    "Controlla i campi estratti e chiudi gli ultimi buchi.": "Review extracted fields and close remaining gaps.",
    "Esito estrazione": "Extraction result",
    Fonte: "Source",
    "Affidabilita' stimata": "Estimated reliability",
    "Prossima domanda": "Next question",
    "Risultato analisi": "Analysis result",
    "Score, numeri chiave e confronto con il tuo archivio.": "Score, key metrics, and comparison with your archive.",
    "Budget delta": "Budget delta",
    "oltre limite": "over limit",
    "entro limite": "within limit",
    Immobile: "Property",
    "Tipologia non indicata": "Type not specified",
    "Numeri chiave": "Key figures",
    "Investimento totale": "Total investment",
    "Costo lavori": "Renovation cost",
    "Costi accessori": "Additional costs",
    "Prezzo al mq": "Price per sqm",
    "Margine lordo": "Gross margin",
    "Margine %": "Margin %",
    "Prezzo rivendita auto-stimato": "Auto-estimated resale price",
    "Canone annuo": "Annual rent",
    "Rendimento lordo": "Gross yield",
    "Rendimento netto stimato": "Estimated net yield",
    "Canone mensile auto-stimato": "Auto-estimated monthly rent",
    "Benchmark zona": "Area benchmark",
    "Valore medio stimato": "Estimated average value",
    "Delta vs richiesto": "Delta vs asking",
    Fonti: "Sources",
    "Capitale mutuo stimato": "Estimated mortgage principal",
    "Rata fisso": "Fixed payment",
    "Rata variabile": "Variable payment",
    "Confronto rapido archivio": "Quick archive comparison",
    "Migliore salvato": "Best saved",
    "Apri confronto immobili": "Open property comparison",
    "Torna ai dati": "Back to data",
    "Archivio immobili": "Property archive",
    "Cronologia analisi, benchmark e accesso ai confronti.": "Analysis history, benchmarks and comparison access.",
    "Confronta immobili": "Compare properties",
    "Nuova analisi": "New analysis",
    "Archivio vuoto": "Empty archive",
    "Salva almeno un'analisi per visualizzare storico e confronti.": "Save at least one analysis to view history and comparisons.",
    "Salvato il": "Saved on",
    "Dettaglio analisi": "Analysis details",
    "Contesto, outcome e confronto col resto del portafoglio.": "Context, outcome and portfolio comparison.",
    "Prezzo richiesto": "Asking price",
    MQ: "SQM",
    Esito: "Outcome",
    "Confronta con archivio": "Compare with archive",
    "Elimina analisi": "Delete analysis",
    "Confronto immobili": "Property comparison",
    "Serve almeno una seconda analisi salvata.": "At least one more saved analysis is needed.",
    "Salva almeno due immobili per vedere il confronto.": "Save at least two properties to view comparison.",
    "Metriche native senza librerie extra per ranking e benchmark.": "Native metrics without extra libraries for ranking and benchmarks.",
    "Miglior score": "Best score",
    "Investimento min": "Min investment",
    Immobili: "Properties",
    "Top perf.": "Top perf.",
    "Score comparato": "Score comparison",
    "Margine / rendimento": "Margin / yield",
    "Nessun preset statico: usa \"Aggiorna dati locali verificati\" nella scheda immobile per prezzi/tassi da fonti web.": "No static preset: use \"Refresh verified local data\" in the property form for web-based prices/rates.",
    "Margine minimo rivendita (%)": "Minimum resale margin (%)",
    "Rendimento minimo affitto (%)": "Minimum rental yield (%)",
    "Budget massimo (€)": "Max budget (€)",
    "Budget rapido a scorrimento": "Quick budget slider",
    "Soglia rispetto alla bozza corrente": "Threshold vs current draft",
    "Benchmark area fallback €/mq": "Fallback area benchmark €/sqm",
    "Imprevisti standard (%)": "Default contingency (%)",
    "Lavori leggeri €/mq": "Light works €/sqm",
    "Lavori medi €/mq": "Medium works €/sqm",
    "Lavori pesanti €/mq": "Heavy works €/sqm",
    "Commissione agenzia standard (%)": "Default agency fee (%)",
    "Imposte e notaio standard (€)": "Default taxes and notary (€)",
    "Anticipo mutuo default (%)": "Default down payment (%)",
    "Durata mutuo default (anni)": "Default mortgage duration (years)",
    "Tasso fisso default (%)": "Default fixed rate (%)",
    "Tasso variabile default (%)": "Default variable rate (%)",
    "AI reale": "Real AI",
    "L'app usa l'endpoint ufficiale Responses API con input testuale e immagine base64.": "The app uses the official Responses API endpoint with text input and base64 image.",
    "Rispondi alla domanda (oppure scrivi \"salta\")": "Answer the question (or type \"skip\")",
    "Dettatura attiva...": "Dictation active...",
    "Tocca il microfono per dettare la risposta": "Tap the microphone to dictate your answer",
    "Detta risposta": "Dictate answer",
    "Interrompi dettatura": "Stop dictation",
    "Annuncio mancante": "Listing missing",
    "Incolla prima il testo dell'annuncio.": "Paste the listing text first.",
    "Messaggio mancante": "Message missing",
    "Scrivi una richiesta per la guida descrizione.": "Write a request for the description guide.",
    "Risposta mancante": "Answer missing",
    "Inserisci o detta una risposta prima di continuare.": "Type or dictate an answer before continuing.",
    "Citta' mancante": "City missing",
    "Inserisci almeno la citta' per scaricare dati locali verificati.": "Enter at least the city to fetch verified local data.",
    "Dati locali non disponibili": "Local data unavailable",
    "Permesso negato": "Permission denied",
    "Serve accesso alle immagini per leggere uno screenshot.": "Image access is required to read a screenshot.",
    "Immagine non leggibile": "Unreadable image",
    "Seleziona un'immagine valida.": "Select a valid image.",
    "API key mancante": "API key missing",
    "Inserisci una chiave API nelle impostazioni AI.": "Enter an API key in AI settings.",
    "Screenshot mancante": "Screenshot missing",
    "Seleziona prima uno screenshot.": "Select a screenshot first.",
    "Estrazione AI fallita": "AI extraction failed",
    "Correggi i blocchi": "Fix blocking issues",
    "Nessun prezzo locale verificato disponibile: inserisci un benchmark manuale.": "No verified local price available: enter a manual benchmark.",
    "Inserisci mq e benchmark area per ottenere una stima guidata.": "Enter sqm and area benchmark to get a guided estimate.",
    "Nessun tasso fisso verificato disponibile: inserisci un valore.": "No verified fixed rate available: enter a value.",
    "Nessun tasso variabile verificato disponibile: inserisci un valore.": "No verified variable rate available: enter a value.",
    "Nessuna fonte verificata per costi ristrutturazione locali: inserisci un costo personalizzato o valori €/mq nelle impostazioni.": "No verified source for local renovation costs: enter a custom cost or €/sqm values in settings.",
    "Inserisci un prezzo richiesto valido.": "Enter a valid asking price.",
    "Prezzo richiesto fuori range realistico.": "Asking price outside realistic range.",
    "Inserisci i metri quadri.": "Enter square meters.",
    "Metri quadri fuori range realistico (15-1000).": "Square meters outside realistic range (15-1000).",
    "Citta' mancante: usero' benchmark fallback €/mq.": "City missing: fallback €/sqm benchmark will be used.",
    "Paese mancante: i tassi mutuo ufficiali potrebbero non essere aggiornabili.": "Country missing: official mortgage rates might not be refreshable.",
    "Tipologia non specificata: utile per confronto e archivio.": "Type not specified: useful for comparison and archive.",
    "Zona/quartiere mancante: riduce la qualita' del confronto.": "Area/district missing: reduces comparison quality.",
    "Il piano deve essere numerico (es. 0, 1, 2, -1).": "Floor must be numeric (e.g. 0, 1, 2, -1).",
    "Con lavori personalizzati devi indicare un costo lavori.": "With custom works you must enter renovation cost.",
    "Condizione e livello lavori sono incoerenti: controlla i lavori.": "Condition and renovation level are inconsistent: check renovation settings.",
    "Imprevisti fuori range: usa un valore tra 0 e 40.": "Contingency out of range: use a value between 0 and 40.",
    "Costi accessori negativi non ammessi.": "Negative additional costs are not allowed.",
    "Il prezzo di rivendita non supera il prezzo richiesto.": "Resale price does not exceed asking price.",
    "Canone mensile fuori range tipico: ricontrolla l'importo.": "Monthly rent outside common range: re-check the amount.",
    "Aggiungi un titolo: nell'archivio migliora molto la leggibilita'.": "Add a title: it greatly improves archive readability.",
    "L'investimento totale supera il budget massimo impostato.": "Total investment exceeds configured max budget.",
    "Prezzo al metro quadro fuori range tipico: verifica i dati inseriti.": "Price per square meter outside common range: verify entered data.",
    "Con le ipotesi attuali il margine e' negativo.": "With current assumptions the margin is negative.",
    "Con le ipotesi attuali il rendimento netto e' negativo.": "With current assumptions net yield is negative.",
    "Qual e' il prezzo richiesto effettivo?": "What is the actual asking price?",
    "Quanti metri quadri reali ha l'immobile?": "How many real square meters does the property have?",
    "In quale citta' si trova l'immobile?": "In which city is the property located?",
    "Qual e' la zona o il quartiere preciso?": "What is the exact area or district?",
    "Che tipologia e'? Monolocale, bilocale, trilocale o altro?": "What type is it? Studio, two-room, three-room or other?",
    "Puoi inserire un prezzo rivendita manuale oppure usare la stima automatica.": "You can enter a manual resale price or use automatic estimate.",
    "Puoi inserire un canone manuale oppure usare la stima automatica.": "You can enter a manual rent or use automatic estimate.",
    "Qual e' il costo lavori personalizzato?": "What is the custom renovation cost?",
    "I dati base ci sono: ora chiudi le incongruenze piu' importanti.": "Base data is there: now resolve the most relevant inconsistencies.",
    "Dati coerenti: puoi calcolare e confrontare con l'archivio.": "Data is consistent: you can calculate and compare with archive.",
    "fallback configurato nelle impostazioni": "fallback configured in settings",
    "nessun benchmark interno": "no internal benchmark",
    "Fonte locale": "Local source",
    Prezzi: "Prices",
    Tassi: "Rates",
    "data n/d": "date n/a",
    "ultimo disponibile": "latest available",
    "Permesso microfono negato": "Microphone permission denied",
    "Abilita il microfono per usare l'assistente vocale.": "Enable microphone access to use voice assistant.",
    "Microfono non disponibile": "Microphone unavailable",
    "Analisi salvata": "Analysis saved",
    "L'immobile e' stato archiviato.": "The property has been saved to archive.",
    "Confronto non disponibile": "Comparison unavailable",
    "Salva almeno due immobili per confrontarli.": "Save at least two properties to compare them.",
    Investimento: "Investment",
    "Prezzo/mq": "Price/sqm",
    "Rendimento netto": "Net yield",
    Lavori: "Renovation",
    "Incolla qui un annuncio o una tua descrizione operativa...": "Paste a listing or your operational description here...",
    'Es: "genera bozza", "come valorizzo la zona?"': 'e.g. "generate draft", "how can I highlight the area?"',
    "Analisi AI in corso...": "AI analysis in progress...",
    "Estrai con AI vera": "Extract with real AI",
    "OCR AI in corso...": "AI OCR in progress...",
    "Leggi screenshot con OCR + AI": "Read screenshot with OCR + AI",
    Interessante: "Interesting",
    "Da verificare": "To verify",
    "Poco conveniente": "Low convenience",
    "In quale comune si trova l'immobile?": "Which municipality is the property located in?",
    "In quale paese si trova l'immobile?": "Which country is the property located in?",
    "Qual e' la zona o il quartiere?": "What is the area or district?",
    "Qual e' il prezzo richiesto in euro?": "What is the asking price in euros?",
    "Quanti metri quadri ha l'immobile?": "How many square meters does the property have?",
    "Vuoi simulare rivendita o affitto?": "Do you want to simulate resale or rental?",
    "Quale canone mensile ipotizzi in euro?": "What monthly rent do you estimate in euros?",
    "Quale prezzo di rivendita ipotizzi in euro?": "What resale price do you estimate in euros?",
    "Com'e' lo stato dell'immobile? Pronto, abitabile, da rinfrescare o da ristrutturare?": "What is the property condition? Ready, livable, needs refreshing, or to renovate?",
    "Qual e' la tipologia? Es. bilocale, trilocale, loft.": "What is the property type? E.g. two-room, three-room, loft.",
    "A che piano si trova? Usa numero, 0 piano terra, -1 seminterrato.": "Which floor is it on? Use number: 0 ground floor, -1 basement.",
    "C'e' ascensore? Rispondi si o no.": "Is there an elevator? Answer yes or no.",
    "Assistente vocale fermato. Puoi riattivarlo dal pulsante microfono.": "Voice assistant stopped. You can restart it from the microphone button.",
    "Percorso guidato completato. Controlla i campi in basso e modifica dove serve.": "Guided flow completed. Review the fields below and edit where needed.",
    "Scheda precompilata. Verifica i dati nelle sezioni sotto e correggi solo dove serve.": "Form prefilled. Check data in sections below and adjust only where needed.",
    "Inserisci il prossimo dato.": "Enter the next value.",
    "Bozza inserita nel campo annuncio testuale. Puoi modificarla liberamente prima del parser.": "Draft inserted into the text listing field. You can edit it freely before parsing.",
    "Assistente descrizione gratis attivo. Scrivi cosa vuoi valorizzare e ti guido passo-passo.": "Free description assistant active. Write what you want to highlight and I'll guide you step by step.",
    "Parser locale avanzato: buono per bozza, meno affidabile dell'AI su annunci sporchi.": "Advanced local parser: good for a draft, less reliable than AI on noisy listings.",
    "Estrazione AI completata.": "AI extraction completed.",
  },
  de: {
    "← Indietro": " Zuruck",
    "Controlli": "Schecks",
    "Nessun blocco: i dati sono coerenti per un primo calcolo.": "Keine Blockaden: Die Daten sind fur eine erste Schatzung konsistent.",
    "Controlli live": "Live-Checks",
    "Anagrafica immobile": "Details zur Immobilie",
    "Titolo immobile": "Eigentumstitel",
    "Citta'": "Stadt",
    "Paese": "Land",
    "Zona / quartiere": "Gebiet/Bezirk",
    "Italia, Germania, Francia...": "Italien, Deutschland, Frankreich...",
    "Tipologia": "Immobilientyp",
    "bilocale, trilocale, loft...": "Zweizimmerwohnung, Dreizimmerwohnung, Dachgeschoss...",
    "Metri quadri": "Quadratmeter",
    "Piano": "Boden",
    "Usa 0 per piano terra e -1 per seminterrato.": "Verwenden Sie 0 fur Erdgeschoss und -1 fur Keller.",
    "Ascensore": "Aufzug",
    "Stato immobile": "Zustand der Immobilie",
    "Pronto": "Bereit",
    "Abitabile": "Lebenswertig",
    "Da rinfrescare": "Braucht eine Erfrischung",
    "Da ristrutturare": "Zum Renovieren",
    "Scenario d'investimento": "Investitionsszenario",
    "Prezzo richiesto (€)": "Angebotspreis ()",
    "Obiettivo": "Ziel",
    "Rivendita": "Wiederverkauf",
    "Affitto": "Mieten",
    "Prezzo rivendita stimato (€)": "Geschatzter Wiederverkaufspreis ()",
    "Canone mensile stimato (€)": "Geschatzte monatliche Miete ()",
    "Livello lavori": "Renovierungsniveau",
    "Nessuno": "Keiner",
    "Leggero": "Licht",
    "Medio": "Medium",
    "Pesante": "Schwer",
    "Personalizzato": "Brauch",
    "Costo lavori personalizzato (€)": "Individuelle Renovierungskosten ()",
    "Benchmark area e mutuo": "Flachenbenchmark und Hypothek",
    "Prezzo medio zona (€/mq)": "Durchschnittlicher Flachenpreis (/qm)",
    "Valore medio stimato immobile (€)": "Geschatzter durchschnittlicher Immobilienwert ()",
    "Delta rispetto al richiesto": "Delta vs. Angebotspreis",
    "Anticipo mutuo (%)": "Hypothekenanzahlung (%)",
    "Durata mutuo (anni)": "Hypothekenlaufzeit (Jahre)",
    "Tasso fisso (%)": "Festzins (%)",
    "Tasso variabile (%)": "Variabler Zinssatz (%)",
    "Costi accessori e note": "Zusatzliche Kosten und Hinweise",
    "Imprevisti (%)": "Eventualverbindlichkeit (%)",
    "Imposte e notaio (€)": "Steuern und Notar ()",
    "Commissione agenzia (€)": "Vermittlungsgebuhr ()",
    "Arredo (€)": "Mobel ()",
    "Altri costi (€)": "Sonstige Kosten ()",
    "Note": "Notizen",
    "Appunti, ipotesi, criticita', timing...": "Hinweise, Annahmen, Risiken, Timing...",
    "Dashboard investitore": "Investoren-Dashboard",
    "Vista rapida, archivio e flussi di acquisizione.": "Schneller Uberblick, Archivierung und Aufnahmestrome.",
    "Analizza immobili, pulisci i dati e confronta le opportunita'.": "Analysieren Sie Immobilien, bereinigen Sie Daten und vergleichen Sie Moglichkeiten.",
    "Parser locale piu' robusto, revisione AI/OCR e criteri piu' severi prima del calcolo.": "Robusterer lokaler Parser, AI/OCR-Uberprufung und strengere Prufungen vor der Berechnung.",
    "Nuova analisi manuale": "Neue manuelle Analyse",
    "Parser AI / OCR": "KI/OCR-Parser",
    "Analisi": "Analysen",
    "Budget max": "Maximales Budget",
    "Margine min": "Min. Marge",
    "Rendimento min": "Mindestertrag",
    "Distribuzione archivio": "Archivverteilung",
    "Verdi": "Grun",
    "Gialli": "Gelb",
    "Rossi": "Rot",
    "Miglior immobile salvato": "Beste gerettete Immobilie",
    "Immobile senza titolo": "Eigentum ohne Titel",
    "Apri dettaglio": "Details offnen",
    "Archivio ancora vuoto": "Archiv noch leer",
    "Dopo il primo salvataggio vedrai trend, confronti e benchmark interni.": "Nach dem ersten Speichern sehen Sie Trends, Vergleiche und interne Benchmarks.",
    "Metodo di acquisizione": "Erwerbsmethode",
    "Manuale": "Handbuch",
    "AI / OCR": "AI / OCR",
    "Usa il microfono per una compilazione guidata a domande oppure incolla un annuncio/OCR e auto-compila.": "Verwenden Sie das Mikrofon fur die gefuhrte Frage-und-Antwort-Eingabe oder fugen Sie Listen-/OCR-Text zum automatischen Ausfullen ein.",
    "Copia/incolla qui annuncio o appunti (poi premi Compila dal testo)": "Eintrag oder Notizen hier einfugen (tippen Sie dann auf Aus Text fullen)",
    "Assistente": "Assistent",
    "Tu": "Du",
    "Salta": "Uberspringen",
    "Continua": "Weitermachen",
    "Stato integrazione AI": "AI-Integrationsstatus",
    "La chiave serve solo per estrazione AI remota/OCR e viene salvata localmente via AsyncStorage.": "Der Schlussel wird nur fur die Remote-KI/OCR-Extraktion verwendet und lokal uber AsyncStorage gespeichert.",
    "Annuncio testuale": "Textauflistung",
    "Guida descrizione AI (gratis)": "Leitfaden zur KI-Beschreibung (kostenlos)",
    "Nessuna API key: risposte locali guidate e bozza pronta da inserire.": "Kein API-Schlussel: gefuhrte lokale Antworten und sofort einfugbarer Entwurf.",
    "AI gratis": "Kostenlose KI",
    "Invia": "Schicken",
    "Inserisci bozza": "Entwurf einfugen",
    "Parser locale avanzato": "Erweiterter lokaler Parser",
    "OCR da screenshot": "Screenshot-OCR",
    "Seleziona uno screenshot e lascia all'AI OCR + parsing.": "Wahlen Sie einen Screenshot aus und lassen Sie die KI OCR + Parsing ausfuhren.",
    "Pronto per l'estrazione.": "Bereit zur Extraktion.",
    "Seleziona screenshot": "Screenshot auswahlen",
    "Revisione estrazione": "Uberprufung der Extraktion",
    "Controlla i campi estratti e chiudi gli ultimi buchi.": "Uberprufen Sie extrahierte Felder und schlieen Sie verbleibende Lucken.",
    "Esito estrazione": "Extraktionsergebnis",
    "Fonte": "Quelle",
    "Affidabilita' stimata": "Geschatzte Zuverlassigkeit",
    "Prossima domanda": "Nachste Frage",
    "Risultato analisi": "Analyseergebnis",
    "Score, numeri chiave e confronto con il tuo archivio.": "Bewertung, Schlusselkennzahlen und Vergleich mit Ihrem Archiv.",
    "Budget delta": "Budgetdelta",
    "oltre limite": "uber Grenze",
    "entro limite": "im Rahmen",
    "Immobile": "Eigentum",
    "Tipologia non indicata": "Typ nicht angegeben",
    "Numeri chiave": "Kennzahlen",
    "Investimento totale": "Gesamtinvestition",
    "Costo lavori": "Renovierungskosten",
    "Costi accessori": "Zusatzliche Kosten",
    "Prezzo al mq": "Preis pro qm",
    "Margine lordo": "Bruttomarge",
    "Margine %": "Marge %",
    "Prezzo rivendita auto-stimato": "Automatisch geschatzter Wiederverkaufspreis",
    "Canone annuo": "Jahresmiete",
    "Rendimento lordo": "Bruttorendite",
    "Rendimento netto stimato": "Geschatzte Nettorendite",
    "Canone mensile auto-stimato": "Automatisch geschatzte monatliche Miete",
    "Benchmark zona": "Flachenbenchmark",
    "Valore medio stimato": "Geschatzter Durchschnittswert",
    "Delta vs richiesto": "Delta vs. Fragen",
    "Fonti": "Quellen",
    "Capitale mutuo stimato": "Geschatzter Hypothekenbetrag",
    "Rata fisso": "Feste Zahlung",
    "Rata variabile": "Variable Bezahlung",
    "Confronto rapido archivio": "Schneller Archivvergleich",
    "Migliore salvato": "Am besten gespeichert",
    "Apri confronto immobili": "Immobilienvergleich offnen",
    "Torna ai dati": "Zuruck zu den Daten",
    "Archivio immobili": "Immobilienarchiv",
    "Cronologia analisi, benchmark e accesso ai confronti.": "Analyseverlauf, Benchmarks und Vergleichszugriff.",
    "Confronta immobili": "Vergleichen Sie Eigenschaften",
    "Nuova analisi": "Neue Analyse",
    "Archivio vuoto": "Leeres Archiv",
    "Salva almeno un'analisi per visualizzare storico e confronti.": "Speichern Sie mindestens eine Analyse, um den Verlauf und Vergleiche anzuzeigen.",
    "Salvato il": "Gespeichert am",
    "Dettaglio analisi": "Analysedetails",
    "Contesto, outcome e confronto col resto del portafoglio.": "Kontext-, Ergebnis- und Portfoliovergleich.",
    "Prezzo richiesto": "Preisvorstellung",
    "MQ": "MQ",
    "Esito": "Ergebnis",
    "Confronta con archivio": "Mit Archiv vergleichen",
    "Elimina analisi": "Analyse loschen",
    "Confronto immobili": "Immobilienvergleich",
    "Serve almeno una seconda analisi salvata.": "Es ist mindestens eine weitere gespeicherte Analyse erforderlich.",
    "Salva almeno due immobili per vedere il confronto.": "Speichern Sie mindestens zwei Eigenschaften, um den Vergleich anzuzeigen.",
    "Metriche native senza librerie extra per ranking e benchmark.": "Native Metriken ohne zusatzliche Bibliotheken fur Rankings und Benchmarks.",
    "Miglior score": "Bestes Ergebnis",
    "Investimento min": "Minimale Investition",
    "Immobili": "Eigenschaften",
    "Top perf.": "Top-Leistung.",
    "Score comparato": "Punktevergleich",
    "Margine / rendimento": "Marge/Rendite",
    "Margine minimo rivendita (%)": "Mindest-Wiederverkaufsmarge (%)",
    "Rendimento minimo affitto (%)": "Mindestmietrendite (%)",
    "Budget massimo (€)": "Maximales Budget ()",
    "Budget rapido a scorrimento": "Schneller Budget-Schieberegler",
    "Soglia rispetto alla bozza corrente": "Schwellenwert im Vergleich zum aktuellen Entwurf",
    "Benchmark area fallback €/mq": "Ruckfallflachenrichtwert /qm",
    "Imprevisti standard (%)": "Standardkontingenz (%)",
    "Lavori leggeri €/mq": "Lichtarbeiten /qm",
    "Lavori medi €/mq": "Mittlere Arbeiten /qm",
    "Lavori pesanti €/mq": "Schwere Arbeiten /qm",
    "Commissione agenzia standard (%)": "Standard-Agenturgebuhr (%)",
    "Imposte e notaio standard (€)": "Verzugssteuer und Notar ()",
    "Anticipo mutuo default (%)": "Standardanzahlung (%)",
    "Durata mutuo default (anni)": "Standardhypothekenlaufzeit (Jahre)",
    "Tasso fisso default (%)": "Standard-Festsatz (%)",
    "Tasso variabile default (%)": "Standardvariabler Zinssatz (%)",
    "AI reale": "Echte KI",
    "L'app usa l'endpoint ufficiale Responses API con input testuale e immagine base64.": "Die App verwendet den offiziellen Responses-API-Endpunkt mit Texteingabe und Base64-Bild.",
    "Dettatura attiva...": "Diktat aktiv...",
    "Tocca il microfono per dettare la risposta": "Tippen Sie auf das Mikrofon, um Ihre Antwort zu diktieren",
    "Detta risposta": "Antwort diktieren",
    "Interrompi dettatura": "Stoppen Sie das Diktat",
    "Annuncio mancante": "Eintrag fehlt",
    "Incolla prima il testo dell'annuncio.": "Fugen Sie zuerst den Listentext ein.",
    "Messaggio mancante": "Nachricht fehlt",
    "Scrivi una richiesta per la guida descrizione.": "Schreiben Sie eine Anfrage fur den Beschreibungsleitfaden.",
    "Risposta mancante": "Antwort fehlt",
    "Inserisci o detta una risposta prima di continuare.": "Geben Sie eine Antwort ein oder diktieren Sie sie, bevor Sie fortfahren.",
    "Citta' mancante": "Stadt fehlt",
    "Inserisci almeno la citta' per scaricare dati locali verificati.": "Geben Sie mindestens die Stadt ein, um verifizierte lokale Daten abzurufen.",
    "Dati locali non disponibili": "Lokale Daten nicht verfugbar",
    "Permesso negato": "Zugriff verweigert",
    "Serve accesso alle immagini per leggere uno screenshot.": "Zum Lesen eines Screenshots ist ein Bildzugriff erforderlich.",
    "Immagine non leggibile": "Unlesbares Bild",
    "Seleziona un'immagine valida.": "Wahlen Sie ein gultiges Bild aus.",
    "API key mancante": "API-Schlussel fehlt",
    "Inserisci una chiave API nelle impostazioni AI.": "Geben Sie in den AI-Einstellungen einen API-Schlussel ein.",
    "Screenshot mancante": "Screenshot fehlt",
    "Seleziona prima uno screenshot.": "Wahlen Sie zunachst einen Screenshot aus.",
    "Estrazione AI fallita": "Die KI-Extraktion ist fehlgeschlagen",
    "Correggi i blocchi": "Blockierungsprobleme beheben",
    "Nessun prezzo locale verificato disponibile: inserisci un benchmark manuale.": "Kein verifizierter lokaler Preis verfugbar: Geben Sie einen manuellen Benchmark ein.",
    "Inserisci mq e benchmark area per ottenere una stima guidata.": "Geben Sie Quadratmeter und Flachenbenchmark ein, um eine gefuhrte Schatzung zu erhalten.",
    "Nessun tasso fisso verificato disponibile: inserisci un valore.": "Kein verifizierter Festpreis verfugbar: Geben Sie einen Wert ein.",
    "Nessun tasso variabile verificato disponibile: inserisci un valore.": "Kein verifizierter variabler Zinssatz verfugbar: Geben Sie einen Wert ein.",
    "Nessuna fonte verificata per costi ristrutturazione locali: inserisci un costo personalizzato o valori €/mq nelle impostazioni.": "Keine verifizierte Quelle fur lokale Renovierungskosten: Geben Sie in den Einstellungen benutzerdefinierte Kosten oder /m2-Werte ein.",
    "Inserisci un prezzo richiesto valido.": "Geben Sie einen gultigen Angebotspreis ein.",
    "Prezzo richiesto fuori range realistico.": "Preisvorstellung liegt auerhalb des realistischen Bereichs.",
    "Inserisci i metri quadri.": "Geben Sie Quadratmeter ein.",
    "Metri quadri fuori range realistico (15-1000).": "Quadratmeter auerhalb des realistischen Bereichs (15-1000).",
    "Citta' mancante: usero' benchmark fallback €/mq.": "Stadt fehlt: Ersatz-Euro/m2-Benchmark wird verwendet.",
    "Paese mancante: i tassi mutuo ufficiali potrebbero non essere aggiornabili.": "Land fehlt: Offizielle Hypothekenzinsen sind moglicherweise nicht aktualisierbar.",
    "Tipologia non specificata: utile per confronto e archivio.": "Typ nicht angegeben: nutzlich fur Vergleich und Archivierung.",
    "Zona/quartiere mancante: riduce la qualita' del confronto.": "Gebiet/Bezirk fehlt: Reduziert die Vergleichsqualitat.",
    "Il piano deve essere numerico (es. 0, 1, 2, -1).": "Die Etage muss numerisch sein (z. B. 0, 1, 2, -1).",
    "Con lavori personalizzati devi indicare un costo lavori.": "Bei Sonderanfertigungen mussen Sie die Renovierungskosten eingeben.",
    "Condizione e livello lavori sono incoerenti: controlla i lavori.": "Zustand und Renovierungsgrad stimmen nicht uberein: Renovierungseinstellungen uberprufen.",
    "Imprevisti fuori range: usa un valore tra 0 e 40.": "Kontingenz auerhalb des zulassigen Bereichs: Verwenden Sie einen Wert zwischen 0 und 40.",
    "Costi accessori negativi non ammessi.": "Negative Zusatzkosten sind nicht zulassig.",
    "Il prezzo di rivendita non supera il prezzo richiesto.": "Der Wiederverkaufspreis ubersteigt nicht den Angebotspreis.",
    "Canone mensile fuori range tipico: ricontrolla l'importo.": "Monatsmiete auerhalb des ublichen Rahmens: Uberprufen Sie den Betrag erneut.",
    "Aggiungi un titolo: nell'archivio migliora molto la leggibilita'.": "Fugen Sie einen Titel hinzu: Dies verbessert die Lesbarkeit des Archivs erheblich.",
    "L'investimento totale supera il budget massimo impostato.": "Die Gesamtinvestition ubersteigt das konfigurierte maximale Budget.",
    "Prezzo al metro quadro fuori range tipico: verifica i dati inseriti.": "Preis pro Quadratmeter auerhalb des ublichen Bereichs: Uberprufen Sie die eingegebenen Daten.",
    "Con le ipotesi attuali il margine e' negativo.": "Unter aktuellen Annahmen ist die Marge negativ.",
    "Con le ipotesi attuali il rendimento netto e' negativo.": "Unter aktuellen Annahmen ist die Nettorendite negativ.",
    "Qual e' il prezzo richiesto effettivo?": "Wie hoch ist der tatsachliche Angebotspreis?",
    "Quanti metri quadri reali ha l'immobile?": "Wie viele Quadratmeter hat die Immobilie tatsachlich?",
    "In quale citta' si trova l'immobile?": "In welcher Stadt befindet sich die Immobilie?",
    "Qual e' la zona o il quartiere preciso?": "Was ist das genaue Gebiet bzw. der Bezirk?",
    "Che tipologia e'? Monolocale, bilocale, trilocale o altro?": "Um welchen Typ handelt es sich? Studio, Zweizimmer, Dreizimmer oder anders?",
    "Puoi inserire un prezzo rivendita manuale oppure usare la stima automatica.": "Sie konnen einen manuellen Wiederverkaufspreis eingeben oder eine automatische Schatzung verwenden.",
    "Puoi inserire un canone manuale oppure usare la stima automatica.": "Sie konnen eine manuelle Miete eingeben oder eine automatische Schatzung verwenden.",
    "Qual e' il costo lavori personalizzato?": "Wie hoch sind die Kosten fur eine individuelle Renovierung?",
    "I dati base ci sono: ora chiudi le incongruenze piu' importanti.": "Die Basisdaten sind vorhanden: Beheben Sie jetzt die relevantesten Inkonsistenzen.",
    "Dati coerenti: puoi calcolare e confrontare con l'archivio.": "Die Daten sind konsistent: Sie konnen sie berechnen und mit dem Archiv vergleichen.",
    "fallback configurato nelle impostazioni": "Fallback in den Einstellungen konfiguriert",
    "nessun benchmark interno": "kein interner Benchmark",
    "Fonte locale": "Lokale Quelle",
    "Prezzi": "Preise",
    "Tassi": "Preise",
    "data n/d": "Datum k.A",
    "ultimo disponibile": "neueste verfugbar",
    "Permesso microfono negato": "Mikrofonberechtigung verweigert",
    "Abilita il microfono per usare l'assistente vocale.": "Aktivieren Sie den Mikrofonzugriff, um den Sprachassistenten zu verwenden.",
    "Microfono non disponibile": "Mikrofon nicht verfugbar",
    "Analisi salvata": "Analyse gespeichert",
    "L'immobile e' stato archiviato.": "Die Eigenschaft wurde im Archiv gespeichert.",
    "Confronto non disponibile": "Vergleich nicht verfugbar",
    "Salva almeno due immobili per confrontarli.": "Speichern Sie mindestens zwei Eigenschaften, um sie vergleichen zu konnen.",
    "Investimento": "Investition",
    "Prezzo/mq": "Preis/qm",
    "Rendimento netto": "Nettorendite",
    "Lavori": "Renovierung",
    "Incolla qui un annuncio o una tua descrizione operativa...": "Fugen Sie hier eine Auflistung oder Ihre Betriebsbeschreibung ein...",
    "Analisi AI in corso...": "KI-Analyse lauft...",
    "Estrai con AI vera": "Extrahieren Sie mit echter KI",
    "OCR AI in corso...": "KI-OCR lauft...",
    "Leggi screenshot con OCR + AI": "Screenshot mit OCR + AI lesen",
    "Interessante": "Interessant",
    "Da verificare": "Zur Verifizierung",
    "Poco conveniente": "Geringe Bequemlichkeit",
    "In quale comune si trova l'immobile?": "In welcher Gemeinde liegt die Immobilie?",
    "In quale paese si trova l'immobile?": "In welchem Land befindet sich die Immobilie?",
    "Qual e' la zona o il quartiere?": "Was ist das Gebiet oder der Bezirk?",
    "Qual e' il prezzo richiesto in euro?": "Wie hoch ist der Angebotspreis in Euro?",
    "Quanti metri quadri ha l'immobile?": "Wie viele Quadratmeter hat die Immobilie?",
    "Vuoi simulare rivendita o affitto?": "Mochten Sie einen Weiterverkauf oder eine Vermietung simulieren?",
    "Quale canone mensile ipotizzi in euro?": "Welche monatliche Miete in Euro schatzen Sie?",
    "Quale prezzo di rivendita ipotizzi in euro?": "Welchen Wiederverkaufspreis schatzen Sie in Euro?",
    "Com'e' lo stato dell'immobile? Pronto, abitabile, da rinfrescare o da ristrutturare?": "Wie ist der Zustand der Immobilie? Ready, livable, needs refreshing, or to renovate?",
    "Qual e' la tipologia? Es. bilocale, trilocale, loft.": "Was ist der Immobilientyp? Z.B. Zweizimmerwohnung, Dreizimmerwohnung, Dachboden.",
    "A che piano si trova? Usa numero, 0 piano terra, -1 seminterrato.": "Auf welcher Etage ist es? Nutzungsnummer: 0 Erdgeschoss, -1 Keller.",
    "C'e' ascensore? Rispondi si o no.": "Gibt es einen Aufzug? Antworten Sie mit Ja oder Nein.",
    "Assistente vocale fermato. Puoi riattivarlo dal pulsante microfono.": "Sprachassistent gestoppt. Sie konnen es uber die Mikrofontaste neu starten.",
    "Percorso guidato completato. Controlla i campi in basso e modifica dove serve.": "Gefuhrter Fluss abgeschlossen. Uberprufen Sie die Felder unten und bearbeiten Sie sie bei Bedarf.",
    "Scheda precompilata. Verifica i dati nelle sezioni sotto e correggi solo dove serve.": "Formular vorausgefullt. Uberprufen Sie die Daten in den folgenden Abschnitten und passen Sie sie nur bei Bedarf an.",
    "Inserisci il prossimo dato.": "Geben Sie den nachsten Wert ein.",
    "Bozza inserita nel campo annuncio testuale. Puoi modificarla liberamente prima del parser.": "Entwurf in das Textlistenfeld eingefugt. Sie konnen es vor dem Parsen frei bearbeiten.",
    "Assistente descrizione gratis attivo. Scrivi cosa vuoi valorizzare e ti guido passo-passo.": "Kostenloser Beschreibungsassistent aktiv. Schreiben Sie, was Sie hervorheben mochten, und ich begleite Sie Schritt fur Schritt.",
    "Parser locale avanzato: buono per bozza, meno affidabile dell'AI su annunci sporchi.": "Erweiterter lokaler Parser: gut fur einen Entwurf, weniger zuverlassig als KI bei verrauschten Eintragen.",
    "Estrazione AI completata.": "KI-Extraktion abgeschlossen.",
    "API key": "API key",
  },
  fr: {
    "← Indietro": " Retour",
    "Controlli": "Cheques",
    "Nessun blocco: i dati sono coerenti per un primo calcolo.": "Pas de bloqueurs : les donnees sont coherentes pour une premiere estimation.",
    "Controlli live": "Verifications en direct",
    "Anagrafica immobile": "Details de la propriete",
    "Titolo immobile": "Titre de propriete",
    "Citta'": "Ville",
    "Paese": "Pays",
    "Zona / quartiere": "Zone / district",
    "Italia, Germania, Francia...": "Italie, Allemagne, France...",
    "Tipologia": "Type de propriete",
    "bilocale, trilocale, loft...": "deux pieces, trois pieces, loft...",
    "Metri quadri": "Metres carres",
    "Piano": "Sol",
    "Usa 0 per piano terra e -1 per seminterrato.": "Utilisez 0 pour le rez-de-chaussee et -1 pour le sous-sol.",
    "Ascensore": "Ascenseur",
    "Stato immobile": "Etat de la propriete",
    "Pronto": "Pret",
    "Abitabile": "Habitable",
    "Da rinfrescare": "A besoin d'etre rafraichi",
    "Da ristrutturare": "A renover",
    "Scenario d'investimento": "Scenario d'investissement",
    "Prezzo richiesto (€)": "Prix demande ()",
    "Obiettivo": "But",
    "Rivendita": "Revente",
    "Affitto": "Louer",
    "Prezzo rivendita stimato (€)": "Prix de revente estime ()",
    "Canone mensile stimato (€)": "Loyer mensuel estime ()",
    "Livello lavori": "Niveau de renovation",
    "Nessuno": "Aucun",
    "Leggero": "Lumiere",
    "Medio": "Moyen",
    "Pesante": "Lourd",
    "Personalizzato": "Coutume",
    "Costo lavori personalizzato (€)": "Cout de renovation sur mesure ()",
    "Benchmark area e mutuo": "Repere de superficie et hypotheque",
    "Prezzo medio zona (€/mq)": "Prix moyen surface (/m2)",
    "Valore medio stimato immobile (€)": "Valeur moyenne estimee du bien ()",
    "Delta rispetto al richiesto": "Delta par rapport au prix demande",
    "Anticipo mutuo (%)": "Mise de fonds hypothecaire (%)",
    "Durata mutuo (anni)": "Duree du pret hypothecaire (annees)",
    "Tasso fisso (%)": "Taux fixe (%)",
    "Tasso variabile (%)": "Taux variable (%)",
    "Costi accessori e note": "Couts et notes supplementaires",
    "Imprevisti (%)": "Contingence (%)",
    "Imposte e notaio (€)": "Taxes et notaire ()",
    "Commissione agenzia (€)": "Frais d'agence ()",
    "Arredo (€)": "Meubles ()",
    "Altri costi (€)": "Autres frais ()",
    "Note": "Remarques",
    "Appunti, ipotesi, criticita', timing...": "Notes, hypotheses, risques, timing...",
    "Dashboard investitore": "Tableau de bord des investisseurs",
    "Vista rapida, archivio e flussi di acquisizione.": "Apercu rapide, flux darchives et dadmission.",
    "Analizza immobili, pulisci i dati e confronta le opportunita'.": "Analysez les proprietes, nettoyez les donnees et comparez les opportunites.",
    "Parser locale piu' robusto, revisione AI/OCR e criteri piu' severi prima del calcolo.": "Analyseur local plus robuste, examen AI/OCR et controles plus stricts avant calcul.",
    "Nuova analisi manuale": "Nouvelle analyse manuelle",
    "Parser AI / OCR": "Analyseur IA/OCR",
    "Analisi": "Analyses",
    "Budget max": "Budget maximum",
    "Margine min": "Marge minimale",
    "Rendimento min": "Rendement minimum",
    "Distribuzione archivio": "Distribution des archives",
    "Verdi": "Vert",
    "Gialli": "Jaune",
    "Rossi": "Rouge",
    "Miglior immobile salvato": "Bien le mieux sauvegarde",
    "Immobile senza titolo": "Propriete sans titre",
    "Apri dettaglio": "Ouvrir les details",
    "Archivio ancora vuoto": "Archive toujours vide",
    "Dopo il primo salvataggio vedrai trend, confronti e benchmark interni.": "Apres la premiere sauvegarde, vous verrez des tendances, des comparaisons et des references internes.",
    "Metodo di acquisizione": "Methode d'acquisition",
    "Manuale": "Manuel",
    "AI / OCR": "AI / OCR",
    "Usa il microfono per una compilazione guidata a domande oppure incolla un annuncio/OCR e auto-compila.": "Utilisez le microphone pour une saisie guidee des questions et reponses, ou collez le texte de la liste/OCR pour le remplissage automatique.",
    "Copia/incolla qui annuncio o appunti (poi premi Compila dal testo)": "Collez la liste ou les notes ici (puis appuyez sur Remplir a partir du texte)",
    "Assistente": "Assistant",
    "Tu": "Toi",
    "Salta": "Sauter",
    "Continua": "Continuer",
    "Stato integrazione AI": "Statut d'integration de l'IA",
    "La chiave serve solo per estrazione AI remota/OCR e viene salvata localmente via AsyncStorage.": "La cle n'est utilisee que pour l'extraction AI/OCR a distance et est stockee localement via AsyncStorage.",
    "Annuncio testuale": "Liste de texte",
    "Guida descrizione AI (gratis)": "Guide de description de l'IA (gratuit)",
    "Nessuna API key: risposte locali guidate e bozza pronta da inserire.": "Pas de cle API : reponses locales guidees et brouillon pret a inserer.",
    "AI gratis": "IA gratuite",
    "Invia": "Envoyer",
    "Inserisci bozza": "Inserer un brouillon",
    "Parser locale avanzato": "Analyseur local avance",
    "OCR da screenshot": "Capture d'ecran ROC",
    "Seleziona uno screenshot e lascia all'AI OCR + parsing.": "Selectionnez une capture d'ecran et laissez l'IA executer l'analyse OCR +.",
    "Pronto per l'estrazione.": "Pret pour l'extraction.",
    "Seleziona screenshot": "Selectionnez une capture d'ecran",
    "Revisione estrazione": "Examen des extractions",
    "Controlla i campi estratti e chiudi gli ultimi buchi.": "Examinez les champs extraits et comblez les lacunes restantes.",
    "Esito estrazione": "Resultat de l'extraction",
    "Fonte": "Source",
    "Affidabilita' stimata": "Fiabilite estimee",
    "Prossima domanda": "Question suivante",
    "Risultato analisi": "Resultat de l'analyse",
    "Score, numeri chiave e confronto con il tuo archivio.": "Score, indicateurs cles et comparaison avec vos archives.",
    "Budget delta": "Delta budgetaire",
    "oltre limite": "au-dela de la limite",
    "entro limite": "dans la limite",
    "Immobile": "Propriete",
    "Tipologia non indicata": "Type non precise",
    "Numeri chiave": "Chiffres cles",
    "Investimento totale": "Investissement total",
    "Costo lavori": "Cout de renovation",
    "Costi accessori": "Frais supplementaires",
    "Prezzo al mq": "Prix au m2",
    "Margine lordo": "Marge brute",
    "Margine %": "Marge %",
    "Prezzo rivendita auto-stimato": "Prix de revente auto-estime",
    "Canone annuo": "Loyer annuel",
    "Rendimento lordo": "Rendement brut",
    "Rendimento netto stimato": "Rendement net estime",
    "Canone mensile auto-stimato": "Loyer mensuel auto-estime",
    "Benchmark zona": "Reference de zone",
    "Valore medio stimato": "Valeur moyenne estimee",
    "Delta vs richiesto": "Delta vs demander",
    "Fonti": "Sources",
    "Capitale mutuo stimato": "Capital hypothecaire estime",
    "Rata fisso": "Paiement fixe",
    "Rata variabile": "Paiement variable",
    "Confronto rapido archivio": "Comparaison rapide des archives",
    "Migliore salvato": "Mieux sauvegarde",
    "Apri confronto immobili": "Comparaison de proprietes ouvertes",
    "Torna ai dati": "Retour aux donnees",
    "Archivio immobili": "Archives de propriete",
    "Cronologia analisi, benchmark e accesso ai confronti.": "Historique danalyse, benchmarks et acces aux comparaisons.",
    "Confronta immobili": "Comparez les proprietes",
    "Nuova analisi": "Nouvelle analyse",
    "Archivio vuoto": "Archives vides",
    "Salva almeno un'analisi per visualizzare storico e confronti.": "Enregistrez au moins une analyse pour afficher lhistorique et les comparaisons.",
    "Salvato il": "Enregistre le",
    "Dettaglio analisi": "Details de l'analyse",
    "Contesto, outcome e confronto col resto del portafoglio.": "Comparaison du contexte, des resultats et du portefeuille.",
    "Prezzo richiesto": "Prix demande",
    "MQ": "MQ",
    "Esito": "Resultat",
    "Confronta con archivio": "Comparer avec les archives",
    "Elimina analisi": "Supprimer l'analyse",
    "Confronto immobili": "Comparaison de proprietes",
    "Serve almeno una seconda analisi salvata.": "Au moins une analyse enregistree supplementaire est necessaire.",
    "Salva almeno due immobili per vedere il confronto.": "Enregistrez au moins deux proprietes pour afficher la comparaison.",
    "Metriche native senza librerie extra per ranking e benchmark.": "Metriques natives sans bibliotheques supplementaires pour le classement et les benchmarks.",
    "Miglior score": "Meilleure note",
    "Investimento min": "Investissement minimum",
    "Immobili": "Proprietes",
    "Top perf.": "Top perf.",
    "Score comparato": "Comparaison des scores",
    "Margine / rendimento": "Marge / rendement",
    "Margine minimo rivendita (%)": "Marge minimale de revente (%)",
    "Rendimento minimo affitto (%)": "Rendement locatif minimum (%)",
    "Budget massimo (€)": "Budget maximum ()",
    "Budget rapido a scorrimento": "Curseur de budget rapide",
    "Soglia rispetto alla bozza corrente": "Seuil par rapport au projet actuel",
    "Benchmark area fallback €/mq": "Referentiel de zone de repli /m2",
    "Imprevisti standard (%)": "Imprevus en cas de defaut (%)",
    "Lavori leggeri €/mq": "Travaux d'eclairage /m2",
    "Lavori medi €/mq": "Travaux moyens /m2",
    "Lavori pesanti €/mq": "Gros travaux /m2",
    "Commissione agenzia standard (%)": "Frais d'agence par defaut (%)",
    "Imposte e notaio standard (€)": "Taxes par defaut et notaire ()",
    "Anticipo mutuo default (%)": "Acompte par defaut (%)",
    "Durata mutuo default (anni)": "Duree du pret hypothecaire par defaut (annees)",
    "Tasso fisso default (%)": "Taux fixe par defaut (%)",
    "Tasso variabile default (%)": "Taux variable par defaut (%)",
    "AI reale": "Veritable IA",
    "L'app usa l'endpoint ufficiale Responses API con input testuale e immagine base64.": "L'application utilise le point de terminaison officiel de l'API Responses avec la saisie de texte et l'image base64.",
    "Dettatura attiva...": "Dictee active...",
    "Tocca il microfono per dettare la risposta": "Appuyez sur le microphone pour dicter votre reponse",
    "Detta risposta": "Dicter la reponse",
    "Interrompi dettatura": "Arreter la dictee",
    "Annuncio mancante": "Liste manquante",
    "Incolla prima il testo dell'annuncio.": "Collez d'abord le texte de la liste.",
    "Messaggio mancante": "Message manquant",
    "Scrivi una richiesta per la guida descrizione.": "Redigez une demande pour le guide de description.",
    "Risposta mancante": "Reponse manquante",
    "Inserisci o detta una risposta prima di continuare.": "Tapez ou dictez une reponse avant de continuer.",
    "Citta' mancante": "Ville disparue",
    "Inserisci almeno la citta' per scaricare dati locali verificati.": "Entrez au moins la ville pour recuperer des donnees locales verifiees.",
    "Dati locali non disponibili": "Donnees locales indisponibles",
    "Permesso negato": "Autorisation refusee",
    "Serve accesso alle immagini per leggere uno screenshot.": "L'acces a l'image est requis pour lire une capture d'ecran.",
    "Immagine non leggibile": "Image illisible",
    "Seleziona un'immagine valida.": "Selectionnez une image valide.",
    "API key mancante": "Cle API manquante",
    "Inserisci una chiave API nelle impostazioni AI.": "Entrez une cle API dans les parametres AI.",
    "Screenshot mancante": "Capture d'ecran manquante",
    "Seleziona prima uno screenshot.": "Selectionnez d'abord une capture d'ecran.",
    "Estrazione AI fallita": "L'extraction de l'IA a echoue",
    "Correggi i blocchi": "Resoudre les problemes de blocage",
    "Nessun prezzo locale verificato disponibile: inserisci un benchmark manuale.": "Aucun prix local verifie disponible : saisissez une reference manuelle.",
    "Inserisci mq e benchmark area per ottenere una stima guidata.": "Entrez le m2 et la superficie de reference pour obtenir une estimation guidee.",
    "Nessun tasso fisso verificato disponibile: inserisci un valore.": "Aucun taux fixe verifie disponible : saisissez une valeur.",
    "Nessun tasso variabile verificato disponibile: inserisci un valore.": "Aucun taux variable verifie disponible : saisissez une valeur.",
    "Nessuna fonte verificata per costi ristrutturazione locali: inserisci un costo personalizzato o valori €/mq nelle impostazioni.": "Aucune source verifiee pour les couts de renovation locaux : saisissez un cout personnalise ou des valeurs en /m2 dans les parametres.",
    "Inserisci un prezzo richiesto valido.": "Entrez un prix demande valide.",
    "Prezzo richiesto fuori range realistico.": "Prix demande en dehors de la fourchette realiste.",
    "Inserisci i metri quadri.": "Entrez les metres carres.",
    "Metri quadri fuori range realistico (15-1000).": "Metres carres en dehors de la plage realiste (15-1 000).",
    "Citta' mancante: usero' benchmark fallback €/mq.": "Ville manquante : une reference de repli en /m2 sera utilisee.",
    "Paese mancante: i tassi mutuo ufficiali potrebbero non essere aggiornabili.": "Pays manquant : les taux hypothecaires officiels pourraient ne pas etre actualises.",
    "Tipologia non specificata: utile per confronto e archivio.": "Type non precise : utile pour la comparaison et l'archivage.",
    "Zona/quartiere mancante: riduce la qualita' del confronto.": "Zone/district manquant : reduit la qualite de la comparaison.",
    "Il piano deve essere numerico (es. 0, 1, 2, -1).": "Le plancher doit etre numerique (par exemple 0, 1, 2, -1).",
    "Con lavori personalizzati devi indicare un costo lavori.": "Pour les travaux sur mesure, vous devez saisir le cout de la renovation.",
    "Condizione e livello lavori sono incoerenti: controlla i lavori.": "L'etat et le niveau de renovation sont incoherents : verifier les parametres de renovation.",
    "Imprevisti fuori range: usa un valore tra 0 e 40.": "Contingence hors plage : utilisez une valeur comprise entre 0 et 40.",
    "Costi accessori negativi non ammessi.": "Les frais supplementaires negatifs ne sont pas autorises.",
    "Il prezzo di rivendita non supera il prezzo richiesto.": "Le prix de revente ne depasse pas le prix demande.",
    "Canone mensile fuori range tipico: ricontrolla l'importo.": "Loyer mensuel hors fourchette commune : reverifier le montant.",
    "Aggiungi un titolo: nell'archivio migliora molto la leggibilita'.": "Ajouter un titre : cela ameliore grandement la lisibilite des archives.",
    "L'investimento totale supera il budget massimo impostato.": "L'investissement total depasse le budget maximum configure.",
    "Prezzo al metro quadro fuori range tipico: verifica i dati inseriti.": "Prix au metre carre hors fourchette commune : verifier les donnees saisies.",
    "Con le ipotesi attuali il margine e' negativo.": "Avec les hypotheses actuelles, la marge est negative.",
    "Con le ipotesi attuali il rendimento netto e' negativo.": "Avec les hypotheses actuelles, le rendement net est negatif.",
    "Qual e' il prezzo richiesto effettivo?": "Quel est le prix reellement demande ?",
    "Quanti metri quadri reali ha l'immobile?": "Combien de metres carres reels la propriete a-t-elle ?",
    "In quale citta' si trova l'immobile?": "Dans quelle ville se situe le bien ?",
    "Qual e' la zona o il quartiere preciso?": "Quelle est la zone ou le quartier exact ?",
    "Che tipologia e'? Monolocale, bilocale, trilocale o altro?": "De quel type s'agit-il ? Studio, deux pieces, trois pieces ou autre ?",
    "Puoi inserire un prezzo rivendita manuale oppure usare la stima automatica.": "Vous pouvez saisir un prix de revente manuel ou utiliser une estimation automatique.",
    "Puoi inserire un canone manuale oppure usare la stima automatica.": "Vous pouvez saisir un loyer manuellement ou utiliser une estimation automatique.",
    "Qual e' il costo lavori personalizzato?": "Quel est le cout dune renovation sur mesure ?",
    "I dati base ci sono: ora chiudi le incongruenze piu' importanti.": "Les donnees de base sont la : resolvez maintenant les incoherences les plus pertinentes.",
    "Dati coerenti: puoi calcolare e confrontare con l'archivio.": "Les donnees sont coherentes : vous pouvez calculer et comparer avec les archives.",
    "fallback configurato nelle impostazioni": "secours configure dans les parametres",
    "nessun benchmark interno": "pas de benchmark interne",
    "Fonte locale": "Source locale",
    "Prezzi": "Tarifs",
    "Tassi": "Tarifs",
    "data n/d": "date n/a",
    "ultimo disponibile": "dernier disponible",
    "Permesso microfono negato": "Autorisation du microphone refusee",
    "Abilita il microfono per usare l'assistente vocale.": "Activez l'acces au microphone pour utiliser l'assistant vocal.",
    "Microfono non disponibile": "Microphone indisponible",
    "Analisi salvata": "Analyse enregistree",
    "L'immobile e' stato archiviato.": "La propriete a ete enregistree dans les archives.",
    "Confronto non disponibile": "Comparaison indisponible",
    "Salva almeno due immobili per confrontarli.": "Enregistrez au moins deux proprietes pour les comparer.",
    "Investimento": "Investissement",
    "Prezzo/mq": "Prix/m2",
    "Rendimento netto": "Rendement net",
    "Lavori": "Renovation",
    "Incolla qui un annuncio o una tua descrizione operativa...": "Collez une annonce ou votre description operationnelle ici...",
    "Analisi AI in corso...": "Analyse de l'IA en cours...",
    "Estrai con AI vera": "Extraire avec une vraie IA",
    "OCR AI in corso...": "OCR IA en cours...",
    "Leggi screenshot con OCR + AI": "Lire la capture d'ecran avec OCR + AI",
    "Interessante": "Interessant",
    "Da verificare": "Pour verifier",
    "Poco conveniente": "Faible commodite",
    "In quale comune si trova l'immobile?": "Dans quelle commune se situe le bien ?",
    "In quale paese si trova l'immobile?": "Dans quel pays la propriete est-elle situee ?",
    "Qual e' la zona o il quartiere?": "Quelle est la zone ou le quartier ?",
    "Qual e' il prezzo richiesto in euro?": "Quel est le prix demande en euros ?",
    "Quanti metri quadri ha l'immobile?": "Combien de metres carres la propriete a-t-elle ?",
    "Vuoi simulare rivendita o affitto?": "Vous souhaitez simuler la revente ou la location ?",
    "Quale canone mensile ipotizzi in euro?": "Quel loyer mensuel estimez-vous en euros ?",
    "Quale prezzo di rivendita ipotizzi in euro?": "Quel prix de revente estimez-vous en euros ?",
    "Com'e' lo stato dell'immobile? Pronto, abitabile, da rinfrescare o da ristrutturare?": "Quel est letat du bien ? Pret, habitable, a rafraichir ou a renover ?",
    "Qual e' la tipologia? Es. bilocale, trilocale, loft.": "Quel est le type de propriete ? Par ex. deux pieces, trois pieces, grenier.",
    "A che piano si trova? Usa numero, 0 piano terra, -1 seminterrato.": "C'est a quel etage ? Numero d'utilisation : 0 rez-de-chaussee, -1 sous-sol.",
    "C'e' ascensore? Rispondi si o no.": "Y a-t-il un ascenseur ? Repondez oui ou non.",
    "Assistente vocale fermato. Puoi riattivarlo dal pulsante microfono.": "L'assistant vocal s'est arrete. Vous pouvez le redemarrer depuis le bouton du microphone.",
    "Percorso guidato completato. Controlla i campi in basso e modifica dove serve.": "Flux guide termine. Verifiez les champs ci-dessous et modifiez-les si necessaire.",
    "Scheda precompilata. Verifica i dati nelle sezioni sotto e correggi solo dove serve.": "Formulaire pre-rempli. Verifiez les donnees dans les sections ci-dessous et ajustez uniquement si necessaire.",
    "Inserisci il prossimo dato.": "Entrez la valeur suivante.",
    "Bozza inserita nel campo annuncio testuale. Puoi modificarla liberamente prima del parser.": "Brouillon insere dans le champ de liste de texte. Vous pouvez le modifier librement avant de l'analyser.",
    "Assistente descrizione gratis attivo. Scrivi cosa vuoi valorizzare e ti guido passo-passo.": "Assistant de description gratuit actif. Ecrivez ce que vous souhaitez mettre en valeur et je vous guiderai etape par etape.",
    "Parser locale avanzato: buono per bozza, meno affidabile dell'AI su annunci sporchi.": "Analyseur local avance : bon pour un brouillon, moins fiable que l'IA sur les listings bruyants.",
    "Estrazione AI completata.": "Extraction de l'IA terminee.",
    "API key": "API key",
  },
  es: {
    "← Indietro": " Volver",
    "Controlli": "cheques",
    "Nessun blocco: i dati sono coerenti per un primo calcolo.": "Sin obstaculos: los datos son consistentes para una estimacion inicial.",
    "Controlli live": "cheques en vivo",
    "Anagrafica immobile": "Detalles de la propiedad",
    "Titolo immobile": "Titulo de propiedad",
    "Citta'": "Ciudad",
    "Paese": "Pais",
    "Zona / quartiere": "Area / distrito",
    "Italia, Germania, Francia...": "Italia, Alemania, Francia...",
    "Tipologia": "Tipo de propiedad",
    "bilocale, trilocale, loft...": "dos habitaciones, tres habitaciones, loft...",
    "Metri quadri": "Metros cuadrados",
    "Piano": "Piso",
    "Usa 0 per piano terra e -1 per seminterrato.": "Utilice 0 para planta baja y -1 para sotano.",
    "Ascensore": "Ascensor",
    "Stato immobile": "Estado de la propiedad",
    "Pronto": "Listo",
    "Abitabile": "Habitable",
    "Da rinfrescare": "Necesita refrescarse",
    "Da ristrutturare": "para renovar",
    "Scenario d'investimento": "Escenario de inversion",
    "Prezzo richiesto (€)": "Precio de venta ()",
    "Obiettivo": "Meta",
    "Rivendita": "Reventa",
    "Affitto": "Alquilar",
    "Prezzo rivendita stimato (€)": "Precio estimado de reventa ()",
    "Canone mensile stimato (€)": "Alquiler mensual estimado ()",
    "Livello lavori": "Nivel de renovacion",
    "Nessuno": "Ninguno",
    "Leggero": "Luz",
    "Medio": "Medio",
    "Pesante": "Pesado",
    "Personalizzato": "Costumbre",
    "Costo lavori personalizzato (€)": "Coste de renovacion a medida ()",
    "Benchmark area e mutuo": "Referencia de area e hipoteca",
    "Prezzo medio zona (€/mq)": "Precio medio de la superficie (/m2)",
    "Valore medio stimato immobile (€)": "Valor medio estimado de la propiedad ()",
    "Delta rispetto al richiesto": "Delta vs precio de venta",
    "Anticipo mutuo (%)": "Pago inicial de la hipoteca (%)",
    "Durata mutuo (anni)": "Duracion de la hipoteca (anos)",
    "Tasso fisso (%)": "Tasa fija (%)",
    "Tasso variabile (%)": "Tasa variable (%)",
    "Costi accessori e note": "Costos y notas adicionales",
    "Imprevisti (%)": "Contingencia (%)",
    "Imposte e notaio (€)": "Impuestos y notario ()",
    "Commissione agenzia (€)": "Honorarios de agencia ()",
    "Arredo (€)": "Mobiliario ()",
    "Altri costi (€)": "Otros costes ()",
    "Note": "Notas",
    "Appunti, ipotesi, criticita', timing...": "Notas, supuestos, riesgos, timing...",
    "Dashboard investitore": "Panel de inversores",
    "Vista rapida, archivio e flussi di acquisizione.": "Resumen rapido, archivo y flujos de admision.",
    "Analizza immobili, pulisci i dati e confronta le opportunita'.": "Analice propiedades, limpie datos y compare oportunidades.",
    "Parser locale piu' robusto, revisione AI/OCR e criteri piu' severi prima del calcolo.": "Analizador local mas robusto, revision AI/OCR y controles mas estrictos antes del calculo.",
    "Nuova analisi manuale": "Nuevo analisis manual",
    "Parser AI / OCR": "Analizador de IA/OCR",
    "Analisi": "Analisis",
    "Budget max": "Presupuesto maximo",
    "Margine min": "Margen minimo",
    "Rendimento min": "Rendimiento minimo",
    "Distribuzione archivio": "Distribucion de archivos",
    "Verdi": "Verde",
    "Gialli": "Amarillo",
    "Rossi": "Rojo",
    "Miglior immobile salvato": "Propiedad mejor guardada",
    "Immobile senza titolo": "Propiedad sin titulo",
    "Apri dettaglio": "Abrir detalles",
    "Archivio ancora vuoto": "Archivo aun vacio",
    "Dopo il primo salvataggio vedrai trend, confronti e benchmark interni.": "Despues del primer guardado, vera tendencias, comparaciones y puntos de referencia internos.",
    "Metodo di acquisizione": "Metodo de adquisicion",
    "Manuale": "Manual",
    "AI / OCR": "AI / OCR",
    "Usa il microfono per una compilazione guidata a domande oppure incolla un annuncio/OCR e auto-compila.": "Utilice el microfono para realizar preguntas y respuestas guiadas, o pegue el listado/texto OCR para autocompletar.",
    "Copia/incolla qui annuncio o appunti (poi premi Compila dal testo)": "Pegue la lista o las notas aqui (luego toque Rellenar desde texto)",
    "Assistente": "Asistente",
    "Tu": "Tu",
    "Salta": "Saltar",
    "Continua": "Continuar",
    "Stato integrazione AI": "Estado de integracion de IA",
    "La chiave serve solo per estrazione AI remota/OCR e viene salvata localmente via AsyncStorage.": "La clave solo se utiliza para la extraccion remota de AI/OCR y se almacena localmente a traves de AsyncStorage.",
    "Annuncio testuale": "Listado de texto",
    "Guida descrizione AI (gratis)": "Guia de descripcion de IA (gratis)",
    "Nessuna API key: risposte locali guidate e bozza pronta da inserire.": "Sin clave API: respuestas locales guiadas y borrador listo para insertar.",
    "AI gratis": "IA libre",
    "Invia": "Enviar",
    "Inserisci bozza": "Insertar borrador",
    "Parser locale avanzato": "Analizador local avanzado",
    "OCR da screenshot": "OCR de captura de pantalla",
    "Seleziona uno screenshot e lascia all'AI OCR + parsing.": "Seleccione una captura de pantalla y deje que AI ejecute el analisis OCR +.",
    "Pronto per l'estrazione.": "Listo para la extraccion.",
    "Seleziona screenshot": "Seleccionar captura de pantalla",
    "Revisione estrazione": "Revision de extraccion",
    "Controlla i campi estratti e chiudi gli ultimi buchi.": "Revise los campos extraidos y cierre las brechas restantes.",
    "Esito estrazione": "Resultado de la extraccion",
    "Fonte": "Fuente",
    "Affidabilita' stimata": "Fiabilidad estimada",
    "Prossima domanda": "Siguiente pregunta",
    "Risultato analisi": "Resultado del analisis",
    "Score, numeri chiave e confronto con il tuo archivio.": "Puntuacion, metricas clave y comparacion con su archivo.",
    "Budget delta": "Delta presupuestario",
    "oltre limite": "sobre el limite",
    "entro limite": "dentro del limite",
    "Immobile": "Propiedad",
    "Tipologia non indicata": "Tipo no especificado",
    "Numeri chiave": "Cifras clave",
    "Investimento totale": "Inversion total",
    "Costo lavori": "Costo de renovacion",
    "Costi accessori": "Costos adicionales",
    "Prezzo al mq": "Precio por m2",
    "Margine lordo": "Margen bruto",
    "Margine %": "Margen %",
    "Prezzo rivendita auto-stimato": "Precio de reventa estimado automaticamente",
    "Canone annuo": "alquiler anual",
    "Rendimento lordo": "Rendimiento bruto",
    "Rendimento netto stimato": "Rendimiento neto estimado",
    "Canone mensile auto-stimato": "Alquiler mensual estimado automaticamente",
    "Benchmark zona": "Punto de referencia del area",
    "Valore medio stimato": "Valor medio estimado",
    "Delta vs richiesto": "Delta vs preguntar",
    "Fonti": "Fuentes",
    "Capitale mutuo stimato": "Principal estimado de la hipoteca",
    "Rata fisso": "Pago fijo",
    "Rata variabile": "Pago variable",
    "Confronto rapido archivio": "Comparacion rapida de archivos",
    "Migliore salvato": "Mejor guardado",
    "Apri confronto immobili": "Abrir comparacion de propiedades",
    "Torna ai dati": "Volver a los datos",
    "Archivio immobili": "Archivo de propiedades",
    "Cronologia analisi, benchmark e accesso ai confronti.": "Historial de analisis, puntos de referencia y acceso a comparaciones.",
    "Confronta immobili": "Comparar propiedades",
    "Nuova analisi": "Nuevo analisis",
    "Archivio vuoto": "Archivo vacio",
    "Salva almeno un'analisi per visualizzare storico e confronti.": "Guarde al menos un analisis para ver el historial y las comparaciones.",
    "Salvato il": "Guardado en",
    "Dettaglio analisi": "Detalles del analisis",
    "Contesto, outcome e confronto col resto del portafoglio.": "Comparacion de contexto, resultados y cartera.",
    "Prezzo richiesto": "precio de venta",
    "MQ": "MQ",
    "Esito": "Resultado",
    "Confronta con archivio": "Comparar con archivo",
    "Elimina analisi": "Eliminar analisis",
    "Confronto immobili": "Comparacion de propiedades",
    "Serve almeno una seconda analisi salvata.": "Se necesita al menos un analisis guardado mas.",
    "Salva almeno due immobili per vedere il confronto.": "Guarde al menos dos propiedades para ver la comparacion.",
    "Metriche native senza librerie extra per ranking e benchmark.": "Metricas nativas sin bibliotecas adicionales para clasificacion y puntos de referencia.",
    "Miglior score": "Mejor puntuacion",
    "Investimento min": "Inversion minima",
    "Immobili": "Propiedades",
    "Top perf.": "Maximo rendimiento.",
    "Score comparato": "Comparacion de puntuaciones",
    "Margine / rendimento": "Margen / rendimiento",
    "Margine minimo rivendita (%)": "Margen minimo de reventa (%)",
    "Rendimento minimo affitto (%)": "Rendimiento minimo de alquiler (%)",
    "Budget massimo (€)": "Presupuesto maximo ()",
    "Budget rapido a scorrimento": "Control deslizante de presupuesto rapido",
    "Soglia rispetto alla bozza corrente": "Umbral vs borrador actual",
    "Benchmark area fallback €/mq": "Referencia zona de reserva /m2",
    "Imprevisti standard (%)": "Contingencia por incumplimiento (%)",
    "Lavori leggeri €/mq": "Obras de luz /m2",
    "Lavori medi €/mq": "Obras medianas /m2",
    "Lavori pesanti €/mq": "Obras pesadas /m2",
    "Commissione agenzia standard (%)": "Tarifa de agencia predeterminada (%)",
    "Imposte e notaio standard (€)": "Impuestos por mora y notario ()",
    "Anticipo mutuo default (%)": "Pago inicial predeterminado (%)",
    "Durata mutuo default (anni)": "Duracion de la hipoteca en mora (anos)",
    "Tasso fisso default (%)": "Tasa fija predeterminada (%)",
    "Tasso variabile default (%)": "Tasa variable predeterminada (%)",
    "AI reale": "IA real",
    "L'app usa l'endpoint ufficiale Responses API con input testuale e immagine base64.": "La aplicacion utiliza el punto final oficial de la API de Responses con entrada de texto e imagen base64.",
    "Dettatura attiva...": "Dictado activo...",
    "Tocca il microfono per dettare la risposta": "Toca el microfono para dictar tu respuesta",
    "Detta risposta": "Dictar respuesta",
    "Interrompi dettatura": "detener el dictado",
    "Annuncio mancante": "Falta el listado",
    "Incolla prima il testo dell'annuncio.": "Pegue el texto del listado primero.",
    "Messaggio mancante": "Falta mensaje",
    "Scrivi una richiesta per la guida descrizione.": "Escriba una solicitud para la guia de descripcion.",
    "Risposta mancante": "Falta respuesta",
    "Inserisci o detta una risposta prima di continuare.": "Escriba o dicte una respuesta antes de continuar.",
    "Citta' mancante": "ciudad perdida",
    "Inserisci almeno la citta' per scaricare dati locali verificati.": "Ingrese al menos la ciudad para obtener datos locales verificados.",
    "Dati locali non disponibili": "Datos locales no disponibles",
    "Permesso negato": "Permiso denegado",
    "Serve accesso alle immagini per leggere uno screenshot.": "Se requiere acceso a la imagen para leer una captura de pantalla.",
    "Immagine non leggibile": "Imagen ilegible",
    "Seleziona un'immagine valida.": "Seleccione una imagen valida.",
    "API key mancante": "Falta la clave API",
    "Inserisci una chiave API nelle impostazioni AI.": "Ingrese una clave API en la configuracion de AI.",
    "Screenshot mancante": "Falta captura de pantalla",
    "Seleziona prima uno screenshot.": "Seleccione una captura de pantalla primero.",
    "Estrazione AI fallita": "La extraccion de IA fallo",
    "Correggi i blocchi": "Solucionar problemas de bloqueo",
    "Nessun prezzo locale verificato disponibile: inserisci un benchmark manuale.": "No hay precio local verificado disponible: ingrese un punto de referencia manual.",
    "Inserisci mq e benchmark area per ottenere una stima guidata.": "Ingrese los metros cuadrados y el area de referencia para obtener una estimacion guiada.",
    "Nessun tasso fisso verificato disponibile: inserisci un valore.": "No hay tarifa fija verificada disponible: ingrese un valor.",
    "Nessun tasso variabile verificato disponibile: inserisci un valore.": "No hay tasa variable verificada disponible: ingrese un valor.",
    "Nessuna fonte verificata per costi ristrutturazione locali: inserisci un costo personalizzato o valori €/mq nelle impostazioni.": "No hay una fuente verificada para los costos de renovacion local: ingrese un costo personalizado o valores de /m2 en la configuracion.",
    "Inserisci un prezzo richiesto valido.": "Introduzca un precio de venta valido.",
    "Prezzo richiesto fuori range realistico.": "Precio de venta fuera del rango realista.",
    "Inserisci i metri quadri.": "Introduzca metros cuadrados.",
    "Metri quadri fuori range realistico (15-1000).": "Metros cuadrados fuera del rango realista (15-1000).",
    "Citta' mancante: usero' benchmark fallback €/mq.": "Falta ciudad: se utilizara el valor de referencia de reserva /m2.",
    "Paese mancante: i tassi mutuo ufficiali potrebbero non essere aggiornabili.": "Falta pais: es posible que las tasas hipotecarias oficiales no se puedan actualizar.",
    "Tipologia non specificata: utile per confronto e archivio.": "Tipo no especificado: util para comparacion y archivo.",
    "Zona/quartiere mancante: riduce la qualita' del confronto.": "Falta area/distrito: reduce la calidad de la comparacion.",
    "Il piano deve essere numerico (es. 0, 1, 2, -1).": "El piso debe ser numerico (por ejemplo, 0, 1, 2, -1).",
    "Con lavori personalizzati devi indicare un costo lavori.": "Con trabajos a medida se debe ingresar costo de renovacion.",
    "Condizione e livello lavori sono incoerenti: controlla i lavori.": "El estado y el nivel de renovacion son inconsistentes: verifique la configuracion de renovacion.",
    "Imprevisti fuori range: usa un valore tra 0 e 40.": "Contingencia fuera de rango: utilice un valor entre 0 y 40.",
    "Costi accessori negativi non ammessi.": "No se permiten costes adicionales negativos.",
    "Il prezzo di rivendita non supera il prezzo richiesto.": "El precio de reventa no excede el precio de venta.",
    "Canone mensile fuori range tipico: ricontrolla l'importo.": "Renta mensual fuera de rango comun: volver a verificar el monto.",
    "Aggiungi un titolo: nell'archivio migliora molto la leggibilita'.": "Agregue un titulo: mejora enormemente la legibilidad del archivo.",
    "L'investimento totale supera il budget massimo impostato.": "La inversion total supera el presupuesto maximo configurado.",
    "Prezzo al metro quadro fuori range tipico: verifica i dati inseriti.": "Precio por metro cuadrado fuera de rango comun: verificar datos ingresados.",
    "Con le ipotesi attuali il margine e' negativo.": "Con los supuestos actuales el margen es negativo.",
    "Con le ipotesi attuali il rendimento netto e' negativo.": "Con los supuestos actuales, el rendimiento neto es negativo.",
    "Qual e' il prezzo richiesto effettivo?": "Cual es el precio de venta real?",
    "Quanti metri quadri reali ha l'immobile?": "Cuantos metros cuadrados reales tiene la propiedad?",
    "In quale citta' si trova l'immobile?": "En que ciudad esta ubicada la propiedad?",
    "Qual e' la zona o il quartiere preciso?": "Cual es el area o distrito exacto?",
    "Che tipologia e'? Monolocale, bilocale, trilocale o altro?": "Que tipo es? Estudio, dos habitaciones, tres habitaciones u otro?",
    "Puoi inserire un prezzo rivendita manuale oppure usare la stima automatica.": "Puede ingresar un precio de reventa manual o utilizar una estimacion automatica.",
    "Puoi inserire un canone manuale oppure usare la stima automatica.": "Puede ingresar un alquiler manual o utilizar una estimacion automatica.",
    "Qual e' il costo lavori personalizzato?": "Cual es el costo de la renovacion personalizada?",
    "I dati base ci sono: ora chiudi le incongruenze piu' importanti.": "Los datos base estan ahi: resuelva ahora las inconsistencias mas relevantes.",
    "Dati coerenti: puoi calcolare e confrontare con l'archivio.": "Los datos son consistentes: puedes calcularlos y compararlos con el archivo.",
    "fallback configurato nelle impostazioni": "respaldo configurado en la configuracion",
    "nessun benchmark interno": "sin punto de referencia interno",
    "Fonte locale": "fuente local",
    "Prezzi": "Precios",
    "Tassi": "Tarifas",
    "data n/d": "fecha n/a",
    "ultimo disponibile": "ultimo disponible",
    "Permesso microfono negato": "Permiso de microfono denegado",
    "Abilita il microfono per usare l'assistente vocale.": "Habilite el acceso al microfono para usar el asistente de voz.",
    "Microfono non disponibile": "Microfono no disponible",
    "Analisi salvata": "Analisis guardado",
    "L'immobile e' stato archiviato.": "La propiedad ha sido guardada para archivar.",
    "Confronto non disponibile": "Comparacion no disponible",
    "Salva almeno due immobili per confrontarli.": "Guarde al menos dos propiedades para compararlas.",
    "Investimento": "Inversion",
    "Prezzo/mq": "Precio/m2",
    "Rendimento netto": "Rendimiento neto",
    "Lavori": "Renovacion",
    "Incolla qui un annuncio o una tua descrizione operativa...": "Pegue un listado o su descripcion operativa aqui...",
    "Analisi AI in corso...": "Analisis de IA en progreso...",
    "Estrai con AI vera": "Extraer con IA real",
    "OCR AI in corso...": "OCR AI en progreso...",
    "Leggi screenshot con OCR + AI": "Leer captura de pantalla con OCR + AI",
    "Interessante": "Interesante",
    "Da verificare": "para verificar",
    "Poco conveniente": "Baja conveniencia",
    "In quale comune si trova l'immobile?": "En que municipio se encuentra la propiedad?",
    "In quale paese si trova l'immobile?": "En que pais esta ubicada la propiedad?",
    "Qual e' la zona o il quartiere?": "Cual es el area o distrito?",
    "Qual e' il prezzo richiesto in euro?": "Cual es el precio de venta en euros?",
    "Quanti metri quadri ha l'immobile?": "Cuantos metros cuadrados tiene la propiedad?",
    "Vuoi simulare rivendita o affitto?": "Quieres simular reventa o alquiler?",
    "Quale canone mensile ipotizzi in euro?": "Que alquiler mensual estimas en euros?",
    "Quale prezzo di rivendita ipotizzi in euro?": "Que precio de reventa estimas en euros?",
    "Com'e' lo stato dell'immobile? Pronto, abitabile, da rinfrescare o da ristrutturare?": "Cual es la condicion de la propiedad? Listo, habitable, necesita renovacion o renovacion?",
    "Qual e' la tipologia? Es. bilocale, trilocale, loft.": "Cual es el tipo de propiedad? P.ej. dos habitaciones, tres habitaciones, loft.",
    "A che piano si trova? Usa numero, 0 piano terra, -1 seminterrato.": "En que piso esta? Numero de uso: 0 planta baja, -1 sotano.",
    "C'e' ascensore? Rispondi si o no.": "Hay ascensor? Responda si o no.",
    "Assistente vocale fermato. Puoi riattivarlo dal pulsante microfono.": "El asistente de voz se detuvo. Puedes reiniciarlo desde el boton del microfono.",
    "Percorso guidato completato. Controlla i campi in basso e modifica dove serve.": "Flujo guiado completado. Revise los campos a continuacion y editelos cuando sea necesario.",
    "Scheda precompilata. Verifica i dati nelle sezioni sotto e correggi solo dove serve.": "Formulario prellenado. Verifique los datos en las secciones siguientes y ajustelos solo cuando sea necesario.",
    "Inserisci il prossimo dato.": "Introduzca el siguiente valor.",
    "Bozza inserita nel campo annuncio testuale. Puoi modificarla liberamente prima del parser.": "Borrador insertado en el campo de listado de texto. Puede editarlo libremente antes de analizarlo.",
    "Assistente descrizione gratis attivo. Scrivi cosa vuoi valorizzare e ti guido passo-passo.": "Asistente de descripcion gratuito activo. Escribe lo que quieras resaltar y te guiare paso a paso.",
    "Parser locale avanzato: buono per bozza, meno affidabile dell'AI su annunci sporchi.": "Analizador local avanzado: bueno para borradores, menos confiable que la IA en listados ruidosos.",
    "Estrazione AI completata.": "Extraccion de IA completada.",
    "API key": "API key",
  },
};

const INLINE_TRANSLATION_OVERRIDES: Record<Exclude<AppLanguage, "it">, Record<string, string>> = {
  en: {
    "Assistente sta parlando...": "Assistant is speaking...",
    "Interrompi voce assistente": "Stop assistant voice",
    "Non ho rilevato voce. Prova a parlare piu' vicino al microfono.": "No voice detected. Try speaking closer to the microphone.",
    "Connessione assente o instabile. Controlla rete e riprova.": "No or unstable connection. Check your network and try again.",
    "Lingua non supportata dal riconoscimento vocale del dispositivo.": "Language not supported by device speech recognition.",
    "Servizio vocale non disponibile sul telefono. Verifica App Google e motore vocale predefinito.": "Voice service not available on this phone. Check Google app and default speech engine.",
    "Riconoscimento vocale non disponibile sul dispositivo.": "Speech recognition is not available on this device.",
  },
  de: {
    "← Indietro": "← Zuruck",
    Controlli: "Prufungen",
    "Controlli live": "Live-Prufungen",
    Piano: "Etage",
    Abitabile: "Bewohnbar",
    "Da rinfrescare": "Zu modernisieren",
    "Da ristrutturare": "Zu renovieren",
    Nessuno: "Keine",
    Leggero: "Leicht",
    Personalizzato: "Benutzerdefiniert",
    Affitto: "Vermietung",
    "Prezzo richiesto (€)": "Angebotspreis (€)",
    "Prezzo rivendita stimato (€)": "Geschatzter Wiederverkaufspreis (€)",
    "Canone mensile stimato (€)": "Geschatzte Monatsmiete (€)",
    "Costo lavori personalizzato (€)": "Benutzerdefinierte Renovierungskosten (€)",
    "Prezzo medio zona (€/mq)": "Durchschnittspreis Gebiet (€/m2)",
    "Valore medio stimato immobile (€)": "Geschatzter Immobilienwert (€)",
    "Imposte e notaio (€)": "Steuern und Notar (€)",
    "Commissione agenzia (€)": "Maklerprovision (€)",
    "Arredo (€)": "Mobel (€)",
    "Altri costi (€)": "Sonstige Kosten (€)",
    "Budget massimo (€)": "Maximalbudget (€)",
    "Benchmark area fallback €/mq": "Fallback-Benchmark Gebiet €/m2",
    "Lavori leggeri €/mq": "Leichte Arbeiten €/m2",
    "Lavori medi €/mq": "Mittlere Arbeiten €/m2",
    "Lavori pesanti €/mq": "Schwere Arbeiten €/m2",
    "Imposte e notaio standard (€)": "Standard Steuern und Notar (€)",
    "Confronta immobili": "Immobilien vergleichen",
    "Miglior score": "Bester Score",
    "Top perf.": "Top-Performance",
    Prezzi: "Preise",
    Tassi: "Zinssatze",
    "Assistente sta parlando...": "Assistent spricht...",
    "Interrompi voce assistente": "Assistentenstimme stoppen",
    "Non ho rilevato voce. Prova a parlare piu' vicino al microfono.": "Keine Stimme erkannt. Bitte naher am Mikrofon sprechen.",
    "Connessione assente o instabile. Controlla rete e riprova.": "Keine oder instabile Verbindung. Bitte Netzwerk prufen und erneut versuchen.",
    "Lingua non supportata dal riconoscimento vocale del dispositivo.": "Sprache wird von der Spracherkennung des Gerats nicht unterstutzt.",
    "Servizio vocale non disponibile sul telefono. Verifica App Google e motore vocale predefinito.": "Sprachdienst auf dem Telefon nicht verfugbar. Google App und Standard-Sprachdienst prufen.",
    "Riconoscimento vocale non disponibile sul dispositivo.": "Spracherkennung ist auf diesem Gerat nicht verfugbar.",
  },
  fr: {
    "← Indietro": "← Retour",
    Controlli: "Verifications",
    "Controlli live": "Verifications en direct",
    Piano: "Etage",
    "Da rinfrescare": "A rafraichir",
    "Da ristrutturare": "A renover",
    Nessuno: "Aucun",
    Leggero: "Leger",
    Personalizzato: "Personnalise",
    Affitto: "Location",
    "Prezzo richiesto (€)": "Prix demande (€)",
    "Prezzo rivendita stimato (€)": "Prix de revente estime (€)",
    "Canone mensile stimato (€)": "Loyer mensuel estime (€)",
    "Costo lavori personalizzato (€)": "Cout travaux personnalise (€)",
    "Prezzo medio zona (€/mq)": "Prix moyen zone (€/m2)",
    "Valore medio stimato immobile (€)": "Valeur moyenne estimee du bien (€)",
    "Imposte e notaio (€)": "Taxes et notaire (€)",
    "Commissione agenzia (€)": "Commission agence (€)",
    "Arredo (€)": "Mobilier (€)",
    "Altri costi (€)": "Autres couts (€)",
    "Budget massimo (€)": "Budget maximum (€)",
    "Benchmark area fallback €/mq": "Benchmark de secours zone €/m2",
    "Lavori leggeri €/mq": "Travaux legers €/m2",
    "Lavori medi €/mq": "Travaux moyens €/m2",
    "Lavori pesanti €/mq": "Travaux lourds €/m2",
    "Imposte e notaio standard (€)": "Taxes et notaire standard (€)",
    "Confronta immobili": "Comparer les biens",
    "Miglior score": "Meilleur score",
    Prezzi: "Prix",
    Tassi: "Taux",
    "Assistente sta parlando...": "L'assistant parle...",
    "Interrompi voce assistente": "Arreter la voix de l'assistant",
    "Non ho rilevato voce. Prova a parlare piu' vicino al microfono.": "Aucune voix detectee. Parlez plus pres du microphone.",
    "Connessione assente o instabile. Controlla rete e riprova.": "Connexion absente ou instable. Verifiez le reseau et reessayez.",
    "Lingua non supportata dal riconoscimento vocale del dispositivo.": "Langue non prise en charge par la reconnaissance vocale de l'appareil.",
    "Servizio vocale non disponibile sul telefono. Verifica App Google e motore vocale predefinito.": "Service vocal indisponible sur ce telephone. Verifiez l'application Google et le moteur vocal par defaut.",
    "Riconoscimento vocale non disponibile sul dispositivo.": "La reconnaissance vocale n'est pas disponible sur cet appareil.",
  },
  es: {
    "← Indietro": "← Volver",
    Controlli: "Controles",
    "Controlli live": "Controles en vivo",
    "Da rinfrescare": "Para actualizar",
    "Da ristrutturare": "Para reformar",
    Nessuno: "Ninguno",
    Leggero: "Ligero",
    Personalizzato: "Personalizado",
    Affitto: "Alquiler",
    "Prezzo richiesto (€)": "Precio solicitado (€)",
    "Prezzo rivendita stimato (€)": "Precio reventa estimado (€)",
    "Canone mensile stimato (€)": "Alquiler mensual estimado (€)",
    "Costo lavori personalizzato (€)": "Coste reforma personalizado (€)",
    "Prezzo medio zona (€/mq)": "Precio medio zona (€/m2)",
    "Valore medio stimato immobile (€)": "Valor medio estimado inmueble (€)",
    "Imposte e notaio (€)": "Impuestos y notario (€)",
    "Commissione agenzia (€)": "Comision agencia (€)",
    "Arredo (€)": "Mobiliario (€)",
    "Altri costi (€)": "Otros costes (€)",
    "Budget massimo (€)": "Presupuesto maximo (€)",
    "Benchmark area fallback €/mq": "Benchmark fallback zona €/m2",
    "Lavori leggeri €/mq": "Obras ligeras €/m2",
    "Lavori medi €/mq": "Obras medias €/m2",
    "Lavori pesanti €/mq": "Obras pesadas €/m2",
    "Imposte e notaio standard (€)": "Impuestos y notario estandar (€)",
    "Confronta immobili": "Comparar inmuebles",
    "Miglior score": "Mejor score",
    Prezzi: "Precios",
    Tassi: "Tasas",
    "Assistente sta parlando...": "El asistente esta hablando...",
    "Interrompi voce assistente": "Detener voz del asistente",
    "Non ho rilevato voce. Prova a parlare piu' vicino al microfono.": "No se detecto voz. Intenta hablar mas cerca del microfono.",
    "Connessione assente o instabile. Controlla rete e riprova.": "Conexion ausente o inestable. Revisa la red e intentalo de nuevo.",
    "Lingua non supportata dal riconoscimento vocale del dispositivo.": "Idioma no compatible con el reconocimiento de voz del dispositivo.",
    "Servizio vocale non disponibile sul telefono. Verifica App Google e motore vocale predefinito.": "Servicio de voz no disponible en el telefono. Revisa la app de Google y el motor de voz predeterminado.",
    "Riconoscimento vocale non disponibile sul dispositivo.": "El reconocimiento de voz no esta disponible en este dispositivo.",
  },
};

function translateInlineText(language: AppLanguage, text: string): string {
  if (!text || language === "it") return text;

  const local = (en: string, de: string, fr: string, es: string) => {
    if (language === "de") return de;
    if (language === "fr") return fr;
    if (language === "es") return es;
    return en;
  };

  const directOverride = INLINE_TRANSLATION_OVERRIDES[language as Exclude<AppLanguage, "it">]?.[text];
  if (directOverride) return directOverride;

  const direct = INLINE_TRANSLATIONS[language as Exclude<AppLanguage, "it">]?.[text];
  if (direct) return direct;

  if (text === "OCR locale") {
    return local("Local OCR", "Lokales OCR", "OCR local", "OCR local");
  }
  if (text === "Seleziona uno screenshot: OCR locale gratis sempre attivo, con AI opzionale se hai API key.") {
    return local(
      "Select a screenshot: free local OCR is always on, with optional AI if you have an API key.",
      "Wahlen Sie einen Screenshot: Kostenloses lokales OCR ist immer aktiv, mit optionaler KI bei API-Schlussel.",
      "Selectionnez une capture : OCR local gratuit toujours actif, IA optionnelle si vous avez une cle API.",
      "Selecciona una captura: OCR local gratis siempre activo, con IA opcional si tienes API key."
    );
  }
  if (text === "Leggi screenshot con OCR locale") {
    return local(
      "Read screenshot with local OCR",
      "Screenshot mit lokalem OCR lesen",
      "Lire la capture avec OCR local",
      "Leer captura con OCR local"
    );
  }
  if (text === "OCR locale gratuito completato: verifica e correggi i campi suggeriti.") {
    return local(
      "Free local OCR completed: review and correct suggested fields.",
      "Kostenloses lokales OCR abgeschlossen: Prufen und korrigieren Sie die vorgeschlagenen Felder.",
      "OCR local gratuit termine : verifiez et corrigez les champs proposes.",
      "OCR local gratis completado: revisa y corrige los campos sugeridos."
    );
  }
  if (text === "OCR locale completato. Rifinitura AI non disponibile, campi compilati in locale.") {
    return local(
      "Local OCR completed. AI refinement unavailable, fields filled locally.",
      "Lokales OCR abgeschlossen. KI-Verfeinerung nicht verfugbar, Felder lokal ausgefullt.",
      "OCR local termine. Raffinement IA indisponible, champs remplis localement.",
      "OCR local completado. Refinado IA no disponible, campos completados localmente."
    );
  }
  if (text === "OCR locale + rifinitura AI completati.") {
    return local(
      "Local OCR + AI refinement completed.",
      "Lokales OCR + KI-Verfeinerung abgeschlossen.",
      "OCR local + raffinement IA termines.",
      "OCR local + refinado IA completados."
    );
  }

  const unavailableWithServices = text.match(/^Riconoscimento vocale non disponibile sul dispositivo\. Servizi trovati: (.+)$/);
  if (unavailableWithServices) {
    return local(
      `Speech recognition is not available on this device. Services found: ${unavailableWithServices[1]}`,
      `Spracherkennung ist auf diesem Gerat nicht verfugbar. Gefundene Dienste: ${unavailableWithServices[1]}`,
      `La reconnaissance vocale n'est pas disponible sur cet appareil. Services trouves: ${unavailableWithServices[1]}`,
      `El reconocimiento de voz no esta disponible en este dispositivo. Servicios encontrados: ${unavailableWithServices[1]}`
    );
  }

  const withLastSave = text.match(/^ultimo salvataggio (.+)$/);
  if (withLastSave) return local(`last save ${withLastSave[1]}`, `letzte Speicherung ${withLastSave[1]}`, `dernier enregistrement ${withLastSave[1]}`, `ultimo guardado ${withLastSave[1]}`);

  const overrun = text.match(/^Sforamento stimato: (.+)$/);
  if (overrun) return local(`Estimated overrun: ${overrun[1]}`, `Geschatzte Uberschreitung: ${overrun[1]}`, `Depassement estime: ${overrun[1]}`, `Exceso estimado: ${overrun[1]}`);

  const margin = text.match(/^Margine disponibile: (.+)$/);
  if (margin) return local(`Available margin: ${margin[1]}`, `Verfugbare Marge: ${margin[1]}`, `Marge disponible: ${margin[1]}`, `Margen disponible: ${margin[1]}`);

  const avg = text.match(/^Stima media: (.+)$/);
  if (avg) return local(`Average estimate: ${avg[1]}`, `Durchschnittsschatzung: ${avg[1]}`, `Estimation moyenne: ${avg[1]}`, `Estimacion media: ${avg[1]}`);

  const prefFast = text.match(/^Precompilato rapido: (.+)$/);
  if (prefFast) return local(`Quick prefill: ${prefFast[1]}`, `Schnelles Prefill: ${prefFast[1]}`, `Prefill rapide: ${prefFast[1]}`, `Prefill rapido: ${prefFast[1]}`);

  const prefilled = text.match(/^Precompilato: (.+)$/);
  if (prefilled) return local(`Prefilled: ${prefilled[1]}`, `Vorgefullt: ${prefilled[1]}`, `Pre-rempli: ${prefilled[1]}`, `Prellenado: ${prefilled[1]}`);

  const marketPrefill = text.match(/^Precompilato mercato: (.+)$/);
  if (marketPrefill) return local(`Market prefill: ${marketPrefill[1]}`, `Markt-Prefill: ${marketPrefill[1]}`, `Prefill marche: ${marketPrefill[1]}`, `Prefill mercado: ${marketPrefill[1]}`);

  const sourcePrefill = text.match(/^Precompilato da fonte verificata: (.+)$/);
  if (sourcePrefill) return local(`Prefilled from verified source: ${sourcePrefill[1]}`, `Vorgefullt aus verifizierter Quelle: ${sourcePrefill[1]}`, `Pre-rempli depuis source verifiee: ${sourcePrefill[1]}`, `Prellenado desde fuente verificada: ${sourcePrefill[1]}`);

  const renovation = text.match(/^Stima lavori guidata: (.+)$/);
  if (renovation) return local(`Guided renovation estimate: ${renovation[1]}`, `Gefuhrte Renovierungsschatzung: ${renovation[1]}`, `Estimation travaux guidee: ${renovation[1]}`, `Estimacion guiada de reforma: ${renovation[1]}`);

  const accessoryPack = text.match(/^Pacchetto costi medi guidati: (.+)$/);
  if (accessoryPack) return local(`Guided average-cost package: ${accessoryPack[1]}`, `Gefuhrtes Durchschnittskosten-Paket: ${accessoryPack[1]}`, `Pack de couts moyens guides: ${accessoryPack[1]}`, `Paquete guiado de costes medios: ${accessoryPack[1]}`);

  const localSource = text.match(/^Fonte locale: (.+)$/);
  if (localSource) return local(`Local source: ${localSource[1]}`, `Lokale Quelle: ${localSource[1]}`, `Source locale: ${localSource[1]}`, `Fuente local: ${localSource[1]}`);

  const deltaAsked = text.match(/^Delta rispetto al richiesto: (.+)$/);
  if (deltaAsked) return local(`Delta vs asking price: ${deltaAsked[1]}`, `Delta vs Angebotspreis: ${deltaAsked[1]}`, `Delta vs prix demande: ${deltaAsked[1]}`, `Delta vs precio solicitado: ${deltaAsked[1]}`);

  const capital = text.match(/^Capitale stimato finanziato: (.+)$/);
  if (capital) return local(`Estimated financed principal: ${capital[1]}`, `Geschatztes finanziertes Kapital: ${capital[1]}`, `Capital finance estime: ${capital[1]}`, `Capital financiado estimado: ${capital[1]}`);

  const fixedPayment = text.match(/^Rata fisso stimata: (.+)$/);
  if (fixedPayment) return local(`Estimated fixed payment: ${fixedPayment[1]}`, `Geschatzte Festzins-Rate: ${fixedPayment[1]}`, `Mensualite fixe estimee: ${fixedPayment[1]}`, `Cuota fija estimada: ${fixedPayment[1]}`);

  const variablePayment = text.match(/^Rata variabile stimata: (.+)$/);
  if (variablePayment) return local(`Estimated variable payment: ${variablePayment[1]}`, `Geschatzte variable Rate: ${variablePayment[1]}`, `Mensualite variable estimee: ${variablePayment[1]}`, `Cuota variable estimada: ${variablePayment[1]}`);

  const configuredModel = text.match(/^Configurata con modello (.+)\.$/);
  if (configuredModel) return local(`Configured with model ${configuredModel[1]}.`, `Konfiguriert mit Modell ${configuredModel[1]}.`, `Configure avec le modele ${configuredModel[1]}.`, `Configurado con el modelo ${configuredModel[1]}.`);

  const reliability = text.match(/^Affidabilita' stimata: (\d+)\/100$/);
  if (reliability) return local(`Estimated reliability: ${reliability[1]}/100`, `Geschatzte Zuverlassigkeit: ${reliability[1]}/100`, `Fiabilite estimee: ${reliability[1]}/100`, `Fiabilidad estimada: ${reliability[1]}/100`);

  const savedOn = text.match(/^Salvato il (.+)$/);
  if (savedOn) return local(`Saved on ${savedOn[1]}`, `Gespeichert am ${savedOn[1]}`, `Enregistre le ${savedOn[1]}`, `Guardado el ${savedOn[1]}`);

  const sourceLabel = text.match(/^Fonte: (.+)$/);
  if (sourceLabel) return local(`Source: ${sourceLabel[1]}`, `Quelle: ${sourceLabel[1]}`, `Source: ${sourceLabel[1]}`, `Fuente: ${sourceLabel[1]}`);

  const bestSaved = text.match(/^Migliore salvato: (.+) • Score (\d+)\/100$/);
  if (bestSaved) return local(`Best saved: ${bestSaved[1]} • Score ${bestSaved[2]}/100`, `Bestes Objekt: ${bestSaved[1]} • Score ${bestSaved[2]}/100`, `Meilleur enregistre: ${bestSaved[1]} • Score ${bestSaved[2]}/100`, `Mejor guardado: ${bestSaved[1]} • Score ${bestSaved[2]}/100`);

  const marginPerf = text.match(/^Margine (.+)$/);
  if (marginPerf) return local(`Margin ${marginPerf[1]}`, `Marge ${marginPerf[1]}`, `Marge ${marginPerf[1]}`, `Margen ${marginPerf[1]}`);

  const netYieldPerf = text.match(/^Rendimento netto (.+)$/);
  if (netYieldPerf) return local(`Net yield ${netYieldPerf[1]}`, `Nettorendite ${netYieldPerf[1]}`, `Rendement net ${netYieldPerf[1]}`, `Rentabilidad neta ${netYieldPerf[1]}`);

  const budgetDelta = text.match(/^Budget delta: (oltre limite|entro limite) • (.+)$/);
  if (budgetDelta) {
    const status = budgetDelta[1] === "oltre limite" ? local("over limit", "uber Limit", "hors limite", "fuera de limite") : local("within limit", "entro limite", "dans la limite", "dentro del limite");
    return local(`Budget delta: ${status} • ${budgetDelta[2]}`, `Budget-Differenz: ${status} • ${budgetDelta[2]}`, `Delta budget: ${status} • ${budgetDelta[2]}`, `Delta presupuesto: ${status} • ${budgetDelta[2]}`);
  }

  const localCompsZone = text.match(/^(\d+) comparabili interni in zona$/);
  if (localCompsZone) return local(`${localCompsZone[1]} internal comparables in area`, `${localCompsZone[1]} interne Vergleichswerte im Gebiet`, `${localCompsZone[1]} comparables internes en zone`, `${localCompsZone[1]} comparables internos en zona`);

  const localCompsCity = text.match(/^(\d+) comparabili interni in citta'$/);
  if (localCompsCity) return local(`${localCompsCity[1]} internal comparables in city`, `${localCompsCity[1]} interne Vergleichswerte in der Stadt`, `${localCompsCity[1]} comparables internes en ville`, `${localCompsCity[1]} comparables internos en ciudad`);

  const verifiedSource = text.match(/^fonte web locale verificata: (.+)$/);
  if (verifiedSource) return local(`verified local web source: ${verifiedSource[1]}`, `verifizierte lokale Webquelle: ${verifiedSource[1]}`, `source web locale verifiee: ${verifiedSource[1]}`, `fuente web local verificada: ${verifiedSource[1]}`);

  const resaleWarn = text.match(/^Prezzo rivendita non inserito: uso stima automatica (.+)\.$/);
  if (resaleWarn) return local(`Resale price missing: using automatic estimate ${resaleWarn[1]}.`, `Wiederverkaufspreis fehlt: automatische Schatzung ${resaleWarn[1]} wird verwendet.`, `Prix de revente manquant : estimation automatique ${resaleWarn[1]} utilisee.`, `Falta precio de reventa: se usa estimacion automatica ${resaleWarn[1]}.`);

  const rentWarn = text.match(/^Canone non inserito: uso stima automatica (.+)\/mese\.$/);
  if (rentWarn) return local(`Rent missing: using automatic estimate ${rentWarn[1]}/month.`, `Miete fehlt: automatische Schatzung ${rentWarn[1]}/Monat wird verwendet.`, `Loyer manquant : estimation automatique ${rentWarn[1]}/mois utilisee.`, `Falta alquiler: se usa estimacion automatica ${rentWarn[1]}/mes.`);

  return text;
}

function formatUiText(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce((output, [key, value]) => {
    return output.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }, template);
}

const TranslationContext = createContext<TranslationFn>((value) => value);

const DEV_OCR_REGRESSION_CASES: DevOcrRegressionCase[] = [
  {
    id: "immobiliare-card",
    label: "Immobiliare card Bologna",
    imageFileName: "Screenshot_2026-03-09-20-17-53-934_it.immobiliare.android.jpg",
    ocrText: `Bologna Comune
109.000
Appartamento Bologna Borgo Panigale dell'ospedaletto, 7
242m²S,21No`,
    expected: {
      askingPrice: "109000",
      city: "Bologna",
      zone: "Borgo Panigale",
      sqm: "42",
      hasElevator: false,
    },
  },
  {
    id: "immobiliare-features",
    label: "Immobiliare dettagli superficie",
    imageFileName: "Screenshot_2026-03-09-20-18-23-391_it.immobiliare.android.jpg",
    ocrText: `109.000
242 m2
Dettagli superficie
Totale superficie principale 41,8 m2
Abitazione
Piano
2
Superficie
40,0 m2
Tipo superficie Principale
Sup. commerciale 40,0 m2
PIANO SECONDO`,
    expected: {
      askingPrice: "109000",
      sqm: "42",
      floor: "2",
    },
  },
  {
    id: "immobiliare-description",
    label: "Immobiliare descrizione",
    imageFileName: "Screenshot_2026-03-09-20-18-35-589_it.immobiliare.android.jpg",
    ocrText: `Descrizione
piano seminterrato.
Infissi in pvc doppio vetro, pavimentazione e bagno fatti nuovi nel 2022.
Immobile attualmente locato a 500e/mese con scadenza il 31/10/2027 con contratto del 2019,
potenzialmente locabile a 650 euro/mese con i valori di mercato attuali.
Prezzo: 109.000,00
Rif.: BP-08
C.E.: G`,
    expected: {
      askingPrice: "109000",
      monthlyRent: "500",
    },
  },
  {
    id: "tecnocasa-roma",
    label: "Tecnocasa Roma",
    imageFileName: "Screenshot_2026-03-09-20-20-04-169_com.android.chrome.jpg",
    ocrText: `Affiliato: Immobiliare Villa Fiorelli Re Di Roma Srl
Via Enna, 33 00182 Roma (RM)
Rif: 61186133
249.000
Bilocale in vendita
Roma, Via Mirandola - Villa Fiorelli
Tipologia: appartamenti
Superficie: mq 48 ca.
Locali: 2
Bagni: 1
Piano:
Nel cuore di Villa Fiorelli`,
    expected: {
      askingPrice: "249000",
      city: "Roma",
      zone: "Villa Fiorelli",
      sqm: "48",
      bathrooms: "1",
      propertyType: "bilocale",
    },
  },
  {
    id: "toscano-brescia",
    label: "Toscano Brescia",
    imageFileName: "Screenshot_2026-03-09-20-20-44-521_com.android.chrome.jpg",
    ocrText: `Affittato | 1 Livello
Casa in vendita - Via Marino Ballini, Brescia (rif. 35/2025)
116 m2
4 Locali
2 Bagni
Piano 2
Prezzo immobile
210.000
Rata di 740 al mese`,
    expected: {
      askingPrice: "210000",
      city: "Brescia",
      sqm: "116",
      bathrooms: "2",
      floor: "2",
      propertyType: "quadrilocale",
    },
  },
];

const DEBUG_OCR_DEVICE_IMAGE_DIR = "file:///sdcard/Android/data/com.st3fez.affaresubito/files/debug-ocr";

const PROPERTY_TYPES = [
  "monolocale",
  "bilocale",
  "trilocale",
  "quadrilocale",
  "villetta a schiera",
  "casa di corte",
  "rustico",
  "cascina",
  "attico",
  "loft",
  "villa",
  "villetta",
  "duplex",
  "appartamento",
  "ufficio",
  "locale commerciale",
];

const LOCATION_STOP_WORDS = [
  "vendita",
  "affitto",
  "richiesta",
  "prezzo",
  "canone",
  "mq",
  "m2",
  "metri",
  "ascensore",
  "ristrutturare",
  "locazione",
  "immobile",
  "tranquilla",
  "tranquillo",
  "servita",
  "servito",
  "strategica",
  "strategico",
  "residenziale",
  "silenziosa",
  "silenzioso",
  "comoda",
  "comodo",
  "verde",
  "affittato",
  "livello",
  "nuovo",
  "top",
  "sky",
  "comune",
  "visita",
];

const LISTING_TEXT_SIGNALS = [
  "€",
  "euro",
  "mq",
  "m2",
  "m²",
  "metri",
  "prezzo",
  "richiesta",
  "vendita",
  "affitto",
  "canone",
  "appartamento",
  "monolocale",
  "bilocale",
  "trilocale",
  "quadrilocale",
  "attico",
  "loft",
  "villa",
  "piano",
  "ascensore",
  "zona",
  "quartiere",
  "camere",
  "bagni",
  "balcone",
  "terrazzo",
  "ristrutturare",
  "abitabile",
  "ristrutturato",
];

const LISTING_TEXT_NOISE = [
  "cookie",
  "privacy",
  "accedi",
  "registrati",
  "newsletter",
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "whatsapp",
  "captcha",
  "cloudflare",
  "abilita javascript",
  "enable javascript",
  "annunci simili",
  "salva ricerca",
  "preferiti",
  "contattaci",
  "contatti",
  "login",
  "menu",
];

const OCR_NOISE_LINE_HINTS = [
  "tecnocasa.it",
  "casa.it",
  "immobiliare.it",
  "medialabtc.it",
  "filtri",
  "mappa",
  "ordina",
  "fino a",
  "lista",
  "foto",
  "planimetrie",
  "chiama",
  "scrivi",
  "messaggi",
  "menu",
  "cerca",
  "salvati",
  "mia casa",
  "salva ricerca",
  "contatta",
  "pubblicita",
  "scopri",
  "visita",
  "virtuale",
  "tour",
  "video",
  "case -",
  "punta qui il tuo smartphone",
  "franchising network",
];

const HTML_META_KEYS = new Set([
  "description",
  "og:title",
  "og:description",
  "og:site_name",
  "twitter:title",
  "twitter:description",
]);

const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: "\"",
  apos: "'",
  lt: "<",
  gt: ">",
  euro: "€",
  agrave: "à",
  egrave: "è",
  igrave: "ì",
  ograve: "ò",
  ugrave: "ù",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  rsquo: "'",
  lsquo: "'",
  rdquo: "\"",
  ldquo: "\"",
  ndash: "-",
  mdash: "-",
  bull: "•",
  hellip: "...",
  copy: "(c)",
  reg: "(r)",
  trade: "tm",
};

const AI_EXTRACTION_INSTRUCTIONS = `Sei un assistente che estrae dati strutturati da annunci immobiliari italiani.
Restituisci solo JSON valido, senza markdown e senza testo extra.
Usa esattamente questa forma:
{
  "title": "",
  "city": "",
  "country": "",
  "zone": "",
  "askingPrice": 0,
  "sqm": 0,
  "bedrooms": 0,
  "bathrooms": 0,
  "propertyType": "",
  "floor": "",
  "hasElevator": "yes|no|unknown",
  "hasCellar": "yes|no|unknown",
  "hasGarage": "yes|no|unknown",
  "hasGarden": "yes|no|unknown",
  "condition": "pronto|abitabile|da_rinfrescare|da_ristrutturare|unknown",
  "goal": "flip|rent|unknown",
  "resalePrice": 0,
  "monthlyRent": 0,
  "renovationLevel": "nessuno|leggero|medio|pesante|personalizzato|unknown",
  "renovationCost": 0,
  "notes": "",
  "rawText": "",
  "confidence": 0,
  "reasoningNotes": ""
}
Regole:
- Usa numeri interi per prezzi, canoni, mq e costi.
- Se un dato manca usa stringa vuota o 0.
- country deve essere il paese dell'immobile (es. Italia, Germania, Francia) oppure stringa vuota.
- hasElevator deve essere "unknown" se non e' esplicito.
- hasCellar, hasGarage e hasGarden devono essere "unknown" se non sono espliciti.
- goal deve essere "rent" solo se il testo parla di locazione, messa a reddito, canone o immobile locato.
- rawText deve contenere il testo OCR letto dall'immagine se stai analizzando uno screenshot.
- notes puo' contenere dettagli utili ma compatti.
- confidence deve essere un numero da 0 a 100.
- reasoningNotes deve essere una riga breve sulle assunzioni fatte.`;

const emptyForm = (): PropertyForm => ({
  id: String(Date.now()),
  title: "",
  city: "",
  province: "",
  country: "",
  zone: "",
  askingPrice: "",
  sqm: "",
  bedrooms: "",
  bathrooms: "",
  propertyType: "",
  floor: "",
  hasElevator: false,
  hasCellar: false,
  hasGarage: false,
  hasGarden: false,
  condition: "abitabile",
  goal: "flip",
  resalePrice: "",
  monthlyRent: "",
  renovationLevel: "medio",
  renovationCost: "",
  unexpectedPct: "",
  taxesAndNotary: "",
  agencyFee: "",
  furnitureCost: "",
  otherCosts: "",
  areaAveragePricePerSqm: "",
  estimatedMarketValue: "",
  mortgageDownPaymentPct: "",
  mortgageYears: "",
  fixedMortgageRate: "",
  variableMortgageRate: "",
  notes: "",
});

function extractAutoPropertyTitleIndex(title: string): number | null {
  const match = title.trim().match(/^immobile\s+(\d+)$/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function nextAutoPropertyTitleIndex(analyses: SavedAnalysis[], excludeId = ""): number {
  const filtered = analyses.filter((item) => item.id !== excludeId);
  const maxFromTitles = filtered.reduce((max, item) => {
    const index = extractAutoPropertyTitleIndex(item.form.title);
    return index && index > max ? index : max;
  }, 0);
  return Math.max(maxFromTitles + 1, filtered.length + 1, 1);
}

function buildAutoPropertyTitle(analyses: SavedAnalysis[], excludeId = ""): string {
  return `Immobile ${nextAutoPropertyTitleIndex(analyses, excludeId)}`;
}

function buildPropertyDisplayTitle(
  form: Pick<PropertyForm, "title" | "propertyType" | "city" | "zone">,
  fallbackIndex?: number
): string {
  const explicitTitle = form.title.trim();
  if (explicitTitle) return explicitTitle;
  if (typeof fallbackIndex === "number" && fallbackIndex > 0) return `Immobile ${fallbackIndex}`;

  const descriptor = [
    form.propertyType.trim() ? titleCase(form.propertyType.trim()) : "",
    form.city.trim(),
    form.zone.trim() ? `- ${form.zone.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return descriptor || "Immobile";
}

function formatCountLabel(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function buildPropertyFeatureList(
  form: Pick<PropertyForm, "bedrooms" | "bathrooms" | "hasCellar" | "hasGarage" | "hasGarden">
): string[] {
  const features: string[] = [];
  const bedrooms = Math.round(toNumber(form.bedrooms));
  const bathrooms = Math.round(toNumber(form.bathrooms));

  if (bedrooms > 0) features.push(formatCountLabel(bedrooms, "camera", "camere"));
  if (bathrooms > 0) features.push(formatCountLabel(bathrooms, "bagno", "bagni"));
  if (form.hasCellar) features.push("cantina");
  if (form.hasGarage) features.push("garage");
  if (form.hasGarden) features.push("giardino");

  return features;
}

function buildPropertyFeatureSummary(
  form: Pick<PropertyForm, "bedrooms" | "bathrooms" | "hasCellar" | "hasGarage" | "hasGarden">
): string {
  return buildPropertyFeatureList(form).join(" • ");
}

function buildPropertyAccessorySummary(form: Pick<PropertyForm, "hasCellar" | "hasGarage" | "hasGarden">): string {
  const accessories: string[] = [];
  if (form.hasCellar) accessories.push("cantina");
  if (form.hasGarage) accessories.push("garage");
  if (form.hasGarden) accessories.push("giardino");
  return accessories.join(" • ");
}

function toNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function resolveNumericInput(value: string, fallback: number): number {
  return value.trim() ? toNumber(value) : fallback;
}

function parseFlexibleNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;

  const separators = cleaned.match(/[.,]/g) ?? [];
  const decimalCandidate =
    separators.length === 1 &&
    cleaned.split(/[.,]/)[1] !== undefined &&
    cleaned.split(/[.,]/)[1].length !== 3;

  if (decimalCandidate) {
    const num = parseFloat(cleaned.replace(",", "."));
    return Number.isFinite(num) ? num : 0;
  }

  return toNumber(cleaned);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatOptionalCurrency(value: number): string {
  return value > 0 ? formatCurrency(value) : "-";
}

function formatOptionalPercent(value: number): string {
  return value > 0 ? formatPercent(value) : "-";
}

function detectDefaultLanguage(): AppLanguage {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  if (locale.startsWith("en")) return "en";
  if (locale.startsWith("de")) return "de";
  if (locale.startsWith("fr")) return "fr";
  if (locale.startsWith("es")) return "es";
  return "it";
}

function formatNumericPlaceholder(value: number, maxFractionDigits = 0): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const normalized = maxFractionDigits > 0 ? value : Math.round(value);
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(normalized);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function scoreColorLabel(color: ScoreColor): string {
  if (color === "verde") return "Interessante";
  if (color === "giallo") return "Da verificare";
  return "Poco conveniente";
}

function scoreColorHex(color: ScoreColor): string {
  if (color === "verde") return "#2f855a";
  if (color === "giallo") return "#b7791f";
  return "#c53030";
}

function scoreSurface(color: ScoreColor): {
  backgroundColor: string;
  borderColor: string;
  accentColor: string;
  textColor: string;
} {
  if (color === "verde") {
    return {
      backgroundColor: "#f3fbf5",
      borderColor: "#bfdcc7",
      accentColor: "#2f855a",
      textColor: "#1f5b40",
    };
  }
  if (color === "giallo") {
    return {
      backgroundColor: "#fff8ea",
      borderColor: "#ecd5a6",
      accentColor: "#b7791f",
      textColor: "#754d10",
    };
  }
  return {
    backgroundColor: "#fff2ef",
    borderColor: "#efc7bf",
    accentColor: "#c53030",
    textColor: "#7b1f1f",
  };
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeSpeechPhrase(text: string): string {
  return normalizeText(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:!?]+$/g, "").trim();
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function appendNotes(existing: string, addition: string): string {
  const first = existing.trim();
  const second = addition.trim();
  if (!second) return first;
  if (!first) return second;
  if (first.includes(second)) return first;
  return `${first}\n\n${second}`;
}

function buildMarketLookupKey(form: Pick<PropertyForm, "city" | "country" | "zone" | "province">): string {
  return [form.city, form.country, form.zone, form.province].map((value) => normalizeText(value)).join("|");
}

const ASSISTANT_PROMPT_PATTERNS = [
  "in quale comune si trova l'immobile",
  "in quale paese si trova l'immobile",
  "qual e' la zona o il quartiere",
  "qual e' il prezzo richiesto in euro",
  "quanti metri quadri ha l'immobile",
  "vuoi simulare rivendita o affitto",
  "quale canone mensile ipotizzi in euro",
  "quale prezzo di rivendita ipotizzi in euro",
  "com'e' lo stato dell'immobile",
  "qual e' la tipologia",
  "quante camere ha l'immobile",
  "quanti bagni ha l'immobile",
  "a che piano si trova",
  "c'e' ascensore",
  "e' presente una cantina",
  "e' presente un garage",
  "e' presente un giardino",
  "inserisci il prossimo dato",
  "assistente vocale fermato",
  "percorso guidato completato",
  "scheda precompilata",
];

function cleanArchiveNotes(rawNotes: string): string {
  const lines = rawNotes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const normalized = normalizeText(line).replace(/[?.!]+$/g, "");
      return !ASSISTANT_PROMPT_PATTERNS.some((pattern) => normalized.includes(pattern));
    });

  const deduped = lines.filter((line, index, current) => {
    const normalized = normalizeText(line);
    return current.findIndex((item) => normalizeText(item) === normalized) === index;
  });
  return deduped.join("\n");
}

function appendTranscript(base: string, chunk: string): string {
  const first = base.trim();
  const second = chunk.trim();
  if (!second) return first;
  if (!first) return second;
  const firstNorm = normalizeText(first);
  const secondNorm = normalizeText(second);

  if (firstNorm === secondNorm) {
    return second.length > first.length ? second : first;
  }
  if (firstNorm.endsWith(secondNorm)) return first;
  if (secondNorm.startsWith(firstNorm) || secondNorm.includes(firstNorm)) return second;
  if (firstNorm.includes(secondNorm)) return first;

  const firstWords = first.split(/\s+/).filter(Boolean);
  const secondWords = second.split(/\s+/).filter(Boolean);
  const maxOverlap = Math.min(firstWords.length, secondWords.length, 10);
  for (let overlap = maxOverlap; overlap >= 2; overlap -= 1) {
    const left = normalizeText(firstWords.slice(-overlap).join(" "));
    const right = normalizeText(secondWords.slice(0, overlap).join(" "));
    if (left === right) {
      return `${first} ${secondWords.slice(overlap).join(" ")}`.replace(/\s+/g, " ").trim();
    }
  }

  return `${first} ${second}`.replace(/\s+/g, " ").trim();
}

function sanitizeDictationText(raw: string): string {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return "";

  const chunks = compact.split(/[.!?]\s+|\n+/).map((part) => part.trim()).filter(Boolean);
  const dedupedChunks: string[] = [];
  for (const chunk of chunks) {
    const normalized = normalizeText(chunk).replace(/[.,;:!?]+$/g, "");
    if (!normalized) continue;
    const prev = dedupedChunks.length > 0 ? normalizeText(dedupedChunks[dedupedChunks.length - 1]).replace(/[.,;:!?]+$/g, "") : "";
    if (prev === normalized) continue;
    dedupedChunks.push(chunk);
  }

  const merged = dedupedChunks.length > 0 ? dedupedChunks.join(" ") : compact;
  const words = merged.split(/\s+/).filter(Boolean);
  const normalizedWords = words.map((word) => normalizeText(word).replace(/[^\p{L}\p{N}]+/gu, ""));
  const cleanedWords: string[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const current = normalizedWords[i];
    const previous = i > 0 ? normalizedWords[i - 1] : "";
    if (current && current === previous && current.length > 2) continue;
    cleanedWords.push(words[i]);
  }
  return cleanedWords.join(" ").replace(/\s+/g, " ").trim();
}

function normalizeOcrLine(raw: string): string {
  return cleanupExtractedLine(raw)
    .replace(/[•·]/g, " • ")
    .replace(/\s{2,}/g, " ")
    .replace(/(\d)\s*(m²|mq|m2)\b/gi, "$1 $2")
    .replace(/(\d)\s*(bagni?|locali?)\b/gi, "$1 $2")
    .replace(/\bcasadicorte\b/gi, "casa di corte")
    .replace(/\bcasadicorteinvendita\b/gi, "casa di corte in vendita")
    .replace(/\bvillettaaschiera\b/gi, "villetta a schiera")
    .replace(/\binvendita\b/gi, "in vendita")
    .replace(/\binaffitto\b/gi, "in affitto")
    .replace(/([A-Za-zÀ-ú])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-zÀ-ú])/g, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isLikelyOcrNoiseLine(line: string): boolean {
  const normalized = normalizeSpeechPhrase(line);
  if (!normalized) return true;
  if (/^\d{1,2}\s?\d{2}$/.test(normalized.replace(/\s+/g, ""))) return true;
  if (/^\d+\/\d+$/.test(normalized.replace(/\s+/g, ""))) return true;
  if (/^\d+case$/.test(normalized.replace(/\s+/g, ""))) return true;
  if (/^(nuovo|top|platinum)$/.test(normalized)) return true;
  if (normalized.includes("http") || normalized.includes("www")) return true;
  if (OCR_NOISE_LINE_HINTS.some((hint) => normalized.includes(normalizeSpeechPhrase(hint)))) return true;

  return false;
}

function sanitizeOcrText(raw: string): string {
  const compact = raw.replace(/\r/g, "").trim();
  if (!compact) return "";

  const lines = compact
    .split(/\n+/)
    .map((line) => normalizeOcrLine(line))
    .filter(Boolean);

  const cleanedLines: string[] = [];
  let lastNormalized = "";

  for (const line of lines) {
    const normalized = normalizeSpeechPhrase(line);
    if (!normalized) continue;
    if (isLikelyOcrNoiseLine(line)) continue;
    if (normalized === lastNormalized) continue;
    cleanedLines.push(line);
    lastNormalized = normalized;
  }

  if (cleanedLines.length === 0) {
    return sanitizeDictationText(compact);
  }

  return cleanedLines.join("\n");
}

function isLikelyNoiseTranscript(text: string, confidence = -1): boolean {
  void confidence;
  const trimmed = text.trim();
  if (!trimmed) return true;
  const normalized = normalizeText(trimmed).replace(/[.,;:!?]+/g, " ");
  if (!normalized) return true;

  const words = normalized.split(" ").filter(Boolean);
  if (words.length === 0) return true;

  const compact = normalized.replace(/[^a-z0-9]+/gi, "");
  if (compact.length <= 1) return true;

  if (words.length === 1 && VOICE_NOISE_WORDS.includes(words[0])) {
    return true;
  }

  return false;
}

function isStripeSuccessUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const route = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    const status = (parsed.searchParams.get("status") || "").toLowerCase();
    const pro = parsed.searchParams.get("pro");
    const unlock = (parsed.searchParams.get("unlock") || "").toLowerCase();
    const hasSession = Boolean(parsed.searchParams.get("session_id"));
    return route.includes("billing/success") || pro === "1" || unlock === "pro" || status === "success" || hasSession;
  } catch {
    const normalized = url.toLowerCase();
    return (
      normalized.includes("billing/success") ||
      normalized.includes("pro=1") ||
      normalized.includes("unlock=pro") ||
      normalized.includes("status=success") ||
      normalized.includes("session_id=")
    );
  }
}

function normalizeListingUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity: string) => {
      const normalized = entity.toLowerCase();

      if (normalized.startsWith("#x")) {
        const codePoint = Number.parseInt(normalized.slice(2), 16);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : " ";
      }

      if (normalized.startsWith("#")) {
        const codePoint = Number.parseInt(normalized.slice(1), 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : " ";
      }

      return HTML_ENTITY_MAP[normalized] ?? " ";
    })
    .replace(/\u00a0/g, " ");
}

function cleanupExtractedLine(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function pushUniqueLine(target: string[], seen: Set<string>, value: string) {
  const cleaned = cleanupExtractedLine(value);
  if (!cleaned || cleaned.length < 4) return;

  const key = normalizeText(cleaned);
  if (seen.has(key)) return;
  seen.add(key);
  target.push(cleaned);
}

function extractTitleAndMetaLines(html: string): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    pushUniqueLine(output, seen, titleMatch[1]);
  }

  const metaRegexes = [
    /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']([^"']+)["'][^>]*>/gi,
  ];

  for (const regex of metaRegexes) {
    let match = regex.exec(html);
    while (match) {
      const key = (regex === metaRegexes[0] ? match[1] : match[2])?.toLowerCase();
      const content = regex === metaRegexes[0] ? match[2] : match[1];

      if (key && content && HTML_META_KEYS.has(key)) {
        pushUniqueLine(output, seen, content);
      }

      match = regex.exec(html);
    }
  }

  return output;
}

function collectLinesFromStructuredData(value: unknown, output: string[], seen: Set<string>) {
  if (!value) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectLinesFromStructuredData(item, output, seen);
    }
    return;
  }

  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;

  if (typeof record.name === "string") pushUniqueLine(output, seen, record.name);
  if (typeof record.description === "string") pushUniqueLine(output, seen, record.description);
  if (typeof record.category === "string") pushUniqueLine(output, seen, `Tipologia ${record.category}`);
  if (typeof record.floorLevel === "string" || typeof record.floorLevel === "number") {
    pushUniqueLine(output, seen, `Piano ${record.floorLevel}`);
  }
  if (typeof record.numberOfRoomsTotal === "string" || typeof record.numberOfRoomsTotal === "number") {
    pushUniqueLine(output, seen, `Locali ${record.numberOfRoomsTotal}`);
  }
  if (typeof record.numberOfBathroomsTotal === "string" || typeof record.numberOfBathroomsTotal === "number") {
    pushUniqueLine(output, seen, `Bagni ${record.numberOfBathroomsTotal}`);
  }

  if (record.address && typeof record.address === "object") {
    const address = record.address as Record<string, unknown>;
    const addressParts = [
      typeof address.streetAddress === "string" ? address.streetAddress : "",
      typeof address.addressLocality === "string" ? address.addressLocality : "",
      typeof address.addressRegion === "string" ? address.addressRegion : "",
    ].filter(Boolean);

    if (addressParts.length > 0) {
      pushUniqueLine(output, seen, addressParts.join(", "));
    }
  }

  if (record.floorSize && typeof record.floorSize === "object") {
    const floorSize = record.floorSize as Record<string, unknown>;
    const valuePart = typeof floorSize.value === "string" || typeof floorSize.value === "number" ? String(floorSize.value) : "";
    const unitPart =
      typeof floorSize.unitText === "string"
        ? floorSize.unitText
        : typeof floorSize.unitCode === "string"
          ? floorSize.unitCode
          : "mq";
    if (valuePart) {
      pushUniqueLine(output, seen, `Superficie ${valuePart} ${unitPart}`);
    }
  }

  if (record.offers) {
    const offers = Array.isArray(record.offers) ? record.offers[0] : record.offers;
    if (offers && typeof offers === "object") {
      const offerRecord = offers as Record<string, unknown>;
      const price =
        typeof offerRecord.price === "string" || typeof offerRecord.price === "number" ? String(offerRecord.price) : "";
      const currency = typeof offerRecord.priceCurrency === "string" ? offerRecord.priceCurrency : "EUR";
      if (price) {
        pushUniqueLine(output, seen, `Prezzo ${price} ${currency}`);
      }
    }
  }

  for (const child of Object.values(record)) {
    if (child && typeof child === "object") {
      collectLinesFromStructuredData(child, output, seen);
    }
  }
}

function extractStructuredLinesFromJsonLd(html: string): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match = scriptRegex.exec(html);

  while (match) {
    const rawJson = decodeHtmlEntities(match[1].replace(/^\s*<!--|-->\s*$/g, "").trim());
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson) as unknown;
        collectLinesFromStructuredData(parsed, output, seen);
      } catch {
        // Ignore malformed JSON-LD blocks and continue with HTML/meta extraction.
      }
    }
    match = scriptRegex.exec(html);
  }

  return output;
}

function scoreListingLine(line: string): number {
  const normalized = normalizeText(line);
  let score = 0;

  if (line.length >= 18 && line.length <= 220) score += 1;
  if (/\d/.test(line)) score += 1;

  for (const signal of LISTING_TEXT_SIGNALS) {
    if (normalized.includes(signal)) score += 2;
  }

  for (const noise of LISTING_TEXT_NOISE) {
    if (normalized.includes(noise)) score -= 4;
  }

  if (/^[^a-zA-ZÀ-ÿ]*$/.test(line)) score -= 3;
  return score;
}

function extractRelevantBodyLines(html: string): string[] {
  const text = decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h1|\/h2|\/h3|\/h4|\/tr|\/td)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );

  const lines = text
    .split(/\n+/)
    .map((line) => cleanupExtractedLine(line))
    .filter((line) => line.length >= 10 && line.length <= 260);

  const scored = lines
    .map((line, index) => ({ line, index, score: scoreListingLine(line) }))
    .filter((item) => item.score > 0);

  const selected = (scored.length > 0 ? scored : lines.map((line, index) => ({ line, index, score: 0 })))
    .sort((a, b) => (b.score === a.score ? a.index - b.index : b.score - a.score))
    .slice(0, 32)
    .sort((a, b) => a.index - b.index);

  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of selected) {
    pushUniqueLine(output, seen, item.line);
  }
  return output;
}

function extractListingTextFromHtml(html: string): string {
  const segments: string[] = [];
  const seen = new Set<string>();

  for (const line of extractTitleAndMetaLines(html)) {
    pushUniqueLine(segments, seen, line);
  }

  for (const line of extractStructuredLinesFromJsonLd(html)) {
    pushUniqueLine(segments, seen, line);
  }

  for (const line of extractRelevantBodyLines(html)) {
    pushUniqueLine(segments, seen, line);
  }

  const rawText = segments.join("\n");
  const antiBotPage =
    rawText.length < 180 &&
    LISTING_TEXT_NOISE.some((token) => normalizeText(rawText).includes(token)) &&
    !rawText.includes("€");

  if (antiBotPage) {
    throw new Error("La pagina blocca la lettura automatica locale. Copia il testo dell'annuncio o usa uno screenshot.");
  }

  if (!rawText.trim()) {
    throw new Error("La pagina non contiene testo utile leggibile dal parser locale.");
  }

  return rawText.slice(0, 5000).trim();
}

function estimateLocalLinkConfidence(text: string): number {
  let score = 40;
  if (extractMoneyCandidates(text).length > 0) score += 18;
  if (extractSqm(text)) score += 14;
  if (extractType(text)) score += 8;
  if (extractCityZone(text).city) score += 10;
  if (text.length > 600) score += 8;
  return Math.max(35, Math.min(88, score));
}

const DEFAULT_LISTING_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
};

const BROWSER_LIKE_LISTING_HEADERS: Record<string, string> = {
  ...DEFAULT_LISTING_HEADERS,
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 16; 2412DPC0AG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Dest": "document",
};

function getHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isImmobiliareHost(value: string): boolean {
  const hostname = getHostname(value);
  return hostname === "immobiliare.it" || hostname.endsWith(".immobiliare.it");
}

async function fetchListingResponse(url: string, signal: AbortSignal): Promise<Response> {
  const firstResponse = await fetch(url, {
    method: "GET",
    headers: DEFAULT_LISTING_HEADERS,
    signal,
  });

  if (firstResponse.ok) return firstResponse;

  const shouldRetryWithBrowserHeaders =
    firstResponse.status === 403 &&
    isImmobiliareHost(url);

  if (!shouldRetryWithBrowserHeaders) return firstResponse;

  return fetch(url, {
    method: "GET",
    headers: BROWSER_LIKE_LISTING_HEADERS,
    signal,
  });
}

async function fetchListingTextFromUrl(url: string): Promise<LocalLinkExtraction> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetchListingResponse(url, controller.signal);

    if (!response.ok) {
      if (response.status === 403 && isImmobiliareHost(url)) {
        throw new Error(
          "immobiliare.it ha bloccato la lettura automatica del link. Riprova il link pulito dell'annuncio oppure usa testo o screenshot."
        );
      }
      throw new Error(`Risposta ${response.status}: impossibile leggere l'annuncio dal link.`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (contentType.includes("pdf")) {
      throw new Error("Il link punta a un PDF. Usa screenshot/OCR oppure incolla il testo.");
    }

    const html = await response.text();
    const finalUrl = response.url || url;
    const extractedText = extractListingTextFromHtml(html);
    const host = (() => {
      try {
        return new URL(finalUrl).hostname.replace(/^www\./, "");
      } catch {
        return finalUrl;
      }
    })();

    return {
      url: finalUrl,
      text: extractedText,
      confidence: estimateLocalLinkConfidence(extractedText),
      note: `Pagina letta sul dispositivo da ${host}. Parsing locale senza invio del link a servizi AI esterni.`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timeout durante la lettura del link. Riprova con una pagina piu' leggera o usa testo/screenshot.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractionSourceLabel(source: ExtractionMeta["source"]): string {
  if (source === "local_text") return "parser locale";
  if (source === "local_image") return "OCR locale";
  if (source === "ai_text") return "AI testo";
  return "AI OCR";
}

function getMainTab(screen: Screen): MainTab {
  if (screen === "home") return "home";
  if (screen === "archive" || screen === "detail" || screen === "compare") return "archive";
  if (screen === "settings") return "settings";
  return "analyze";
}

function conditionLabel(condition: PropertyCondition): string {
  if (condition === "pronto") return "Pronto";
  if (condition === "abitabile") return "Abitabile";
  if (condition === "da_rinfrescare") return "Da rinfrescare";
  return "Da ristrutturare";
}

function goalLabel(goal: Goal): string {
  return goal === "flip" ? "Rivendita" : "Affitto";
}

function renovationLabel(level: RenovationLevel): string {
  if (level === "nessuno") return "Nessuno";
  if (level === "leggero") return "Leggero";
  if (level === "medio") return "Medio";
  if (level === "pesante") return "Pesante";
  return "Personalizzato";
}

function inferRenovationLevelFromCondition(condition: PropertyCondition): RenovationLevel {
  if (condition === "pronto") return "nessuno";
  if (condition === "abitabile") return "leggero";
  if (condition === "da_rinfrescare") return "medio";
  return "pesante";
}

function parseCondition(text: string): PropertyCondition {
  const t = normalizeText(text);
  const spoken = normalizeSpeechPhrase(text);
  if (
    t.includes("da ristrutturare") ||
    spoken.includes("da ristrutturare") ||
    spoken.includes("ristrutturazione") ||
    spoken.includes("ristrutturare") ||
    spoken.includes("da rifare") ||
    t.includes("completamente da rifare") ||
    t.includes("integralmente da rifare") ||
    t.includes("grezzo")
  ) {
    return "da_ristrutturare";
  }
  if (
    t.includes("da rinfrescare") ||
    spoken.includes("da rinfrescare") ||
    spoken.includes("rinfrescare") ||
    spoken.includes("da sistemare") ||
    t.includes("da sistemare") ||
    t.includes("da ammodernare") ||
    t.includes("da rivedere") ||
    t.includes("parzialmente da ristrutturare")
  ) {
    return "da_rinfrescare";
  }
  if (
    t.includes("abitabile") ||
    spoken.includes("abitabile") ||
    spoken.includes("buono stato") ||
    spoken.includes("buone condizioni") ||
    spoken.includes("discreto")
  ) {
    return "abitabile";
  }
  if (
    t.includes("pronto da abitare") ||
    spoken.includes("pronto") ||
    spoken.includes("pronto da abitare") ||
    t.includes("chiavi in mano") ||
    t.includes("ristrutturato") ||
    t.includes("nuova costruzione") ||
    t.includes("ottime condizioni") ||
    t.includes("perfette condizioni")
  ) {
    return "pronto";
  }
  return "abitabile";
}

function inferRenovationCost(
  renovationLevel: RenovationLevel,
  sqm: number,
  settings: InvestorSettings,
  customCost: number
): number {
  if (customCost > 0) return customCost;
  if (sqm <= 0) return 0;

  switch (renovationLevel) {
    case "nessuno":
      return 0;
    case "leggero":
      return sqm * settings.lightRenovationPerSqm;
    case "medio":
      return sqm * settings.mediumRenovationPerSqm;
    case "pesante":
      return sqm * settings.heavyRenovationPerSqm;
    default:
      return customCost;
  }
}

function normalizeLocationToken(value: string): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function slugifyForPath(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function parseNumbeoPrimaryValue(line: string): number | null {
  const parts = line
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const value = parseFlexibleNumber(parts[1]);
    if (value > 0) return value;
  }

  const fallback = line.match(/([0-9][0-9.,\s]*)\s*(?:€|eur|%)/i);
  if (!fallback?.[1]) return null;
  const parsed = parseFlexibleNumber(fallback[1]);
  return parsed > 0 ? parsed : null;
}

function parseEcbRateCsv(csv: string): { value: number; period: string } | null {
  const match = csv.match(/,(\d{4}-\d{2}),([0-9]+(?:\.[0-9]+)?),/);
  if (!match) return null;

  const period = match[1];
  const value = Number(match[2]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value, period };
}

function isCentreZone(zone: string): boolean {
  const zoneKey = normalizeLocationToken(zone);
  if (!zoneKey) return false;
  const centerTokens = [
    "centro",
    "center",
    "centre",
    "zentrum",
    "downtown",
    "old town",
    "altstadt",
    "city center",
    "centro storico",
  ];
  return centerTokens.some((token) => zoneKey.includes(normalizeLocationToken(token)));
}

function pickVerifiedAreaPricePerSqm(data: VerifiedMarketData | null, zone: string): number {
  if (!data) return 0;
  if (isCentreZone(zone) && data.priceCityCentrePerSqm && data.priceCityCentrePerSqm > 0) {
    return data.priceCityCentrePerSqm;
  }
  if (!isCentreZone(zone) && data.priceOutsideCentrePerSqm && data.priceOutsideCentrePerSqm > 0) {
    return data.priceOutsideCentrePerSqm;
  }

  const values = [data.priceCityCentrePerSqm, data.priceOutsideCentrePerSqm].filter(
    (value): value is number => Boolean(value && value > 0)
  );
  if (values.length === 0) return 0;
  return average(values);
}

function parseNumbeoPropertyMarkdown(markdown: string): {
  priceCityCentrePerSqm: number | null;
  priceOutsideCentrePerSqm: number | null;
  mortgageFixedPct: number | null;
  areaUpdatedAt: string;
} {
  const lines = markdown.split(/\r?\n/);
  let priceCityCentrePerSqm: number | null = null;
  let priceOutsideCentrePerSqm: number | null = null;
  let mortgageFixedPct: number | null = null;
  let areaUpdatedAt = "";

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.includes("price per square meter to buy apartment in city centre")) {
      const value = parseNumbeoPrimaryValue(line);
      if (value && value > 0) priceCityCentrePerSqm = value;
      continue;
    }

    if (lower.includes("price per square meter to buy apartment outside of centre")) {
      const value = parseNumbeoPrimaryValue(line);
      if (value && value > 0) priceOutsideCentrePerSqm = value;
      continue;
    }

    if (lower.includes("price per square feet to buy apartment in city centre")) {
      const value = parseNumbeoPrimaryValue(line);
      if (value && value > 0) priceCityCentrePerSqm = value * 10.7639;
      continue;
    }

    if (lower.includes("price per square feet to buy apartment outside of centre")) {
      const value = parseNumbeoPrimaryValue(line);
      if (value && value > 0) priceOutsideCentrePerSqm = value * 10.7639;
      continue;
    }

    if (lower.includes("annual mortgage interest rate (20-year fixed")) {
      const value = parseNumbeoPrimaryValue(line);
      if (value && value > 0) mortgageFixedPct = value;
      continue;
    }

    const updatedMatch = line.match(/Last update:\s*(.+)$/i);
    if (updatedMatch?.[1]) {
      areaUpdatedAt = updatedMatch[1].trim();
    }
  }

  return {
    priceCityCentrePerSqm: priceCityCentrePerSqm ? Math.round(priceCityCentrePerSqm) : null,
    priceOutsideCentrePerSqm: priceOutsideCentrePerSqm ? Math.round(priceOutsideCentrePerSqm) : null,
    mortgageFixedPct,
    areaUpdatedAt,
  };
}

function parseNumbeoPropertyHtml(html: string): {
  priceCityCentrePerSqm: number | null;
  priceOutsideCentrePerSqm: number | null;
  mortgageFixedPct: number | null;
  areaUpdatedAt: string;
} {
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const pickMoney = (pattern: RegExp): number | null => {
    const match = plain.match(pattern);
    if (!match?.[1]) return null;
    const value = parseFlexibleNumber(match[1]);
    return value > 0 ? Math.round(value) : null;
  };
  const pickRate = (pattern: RegExp): number | null => {
    const match = plain.match(pattern);
    if (!match?.[1]) return null;
    const value = parseFlexibleNumber(match[1]);
    return value > 0 ? Number(value.toFixed(2)) : null;
  };

  const priceCityCentrePerSqm =
    pickMoney(/Price per Square Meter to Buy Apartment in City Centre[^0-9]{0,45}([0-9][0-9.,\s]+)/i) ??
    pickMoney(/City Centre[^0-9]{0,45}([0-9][0-9.,\s]+)/i);

  const priceOutsideCentrePerSqm =
    pickMoney(/Price per Square Meter to Buy Apartment Outside of Centre[^0-9]{0,45}([0-9][0-9.,\s]+)/i) ??
    pickMoney(/Outside of Centre[^0-9]{0,45}([0-9][0-9.,\s]+)/i);

  const mortgageFixedPct = pickRate(
    /Annual Mortgage Interest Rate in Percentages \(%\), Yearly, for 20 Years Fixed-Rate[^0-9]{0,45}([0-9][0-9.,\s]+)/i
  );

  const updatedMatch = plain.match(/Last update[^A-Za-z0-9]{0,8}([A-Za-z]{3,12}\s+\d{1,2},\s*\d{4})/i);
  const areaUpdatedAt = updatedMatch?.[1]?.trim() || "";

  return {
    priceCityCentrePerSqm,
    priceOutsideCentrePerSqm,
    mortgageFixedPct,
    areaUpdatedAt,
  };
}

class HttpStatusError extends Error {
  status: number;
  url: string;

  constructor(status: number, url: string, message?: string) {
    super(message || `Richiesta fallita (${status})`);
    this.name = "HttpStatusError";
    this.status = status;
    this.url = url;
  }
}

function isHttpStatusError(error: unknown): error is HttpStatusError {
  return error instanceof HttpStatusError;
}

async function fetchTextWithTimeout(url: string, timeoutMs = 15000, headers?: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "text/plain,application/json,text/html;q=0.9,*/*;q=0.8",
        ...headers,
      },
    });

    if (!response.ok) {
      throw new HttpStatusError(response.status, url, `Richiesta fallita (${response.status})`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchEcbMortgageRate(countryCode: string, maturityCode: "F" | "P"): Promise<{ value: number; period: string } | null> {
  const code = countryCode.toUpperCase();
  const endpoint = `https://data-api.ecb.europa.eu/service/data/MIR/M.${code}.B.A2C.${maturityCode}.R.A.2250.EUR.N?lastNObservations=1&format=csvdata`;

  try {
    const csv = await fetchTextWithTimeout(endpoint, 12000);
    return parseEcbRateCsv(csv);
  } catch {
    return null;
  }
}

async function fetchWorldBankTransferCostPct(countryCode: string): Promise<{ value: number; year: string } | null> {
  const endpoint = `https://api.worldbank.org/v2/country/${countryCode.toUpperCase()}/indicator/IC.REG.PRRT.COST.PRT.VAL?format=json&per_page=60`;
  try {
    const raw = await fetchTextWithTimeout(endpoint, 15000, { Accept: "application/json,text/plain,*/*" });
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 2 || !Array.isArray(parsed[1])) return null;
    const rows = parsed[1] as Array<{ value?: number | null; date?: string }>;
    const firstValid = rows.find((row) => typeof row.value === "number" && Number.isFinite(row.value) && row.value > 0);
    if (!firstValid || typeof firstValid.value !== "number") return null;
    return {
      value: Number(firstValid.value.toFixed(2)),
      year: firstValid.date || "",
    };
  } catch {
    return null;
  }
}

async function resolveCityAndCountry(city: string, country: string): Promise<{ city: string; countryCode: string; countryName: string }> {
  const query = [city.trim(), country.trim()].filter(Boolean).join(", ");
  if (!query) throw new Error("Inserisci almeno la citta' per aggiornare i dati locali.");

  let nominatim403 = false;
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&accept-language=en&limit=1&q=${encodeURIComponent(query)}`;
    const raw = await fetchTextWithTimeout(nominatimUrl, 12000, {
      "User-Agent": "AffareSubito/1.0 (+https://affaresubito.app)",
      Referer: "https://affaresubito.app",
    });
    const parsed = JSON.parse(raw) as Array<{
      address?: Record<string, string>;
      display_name?: string;
    }>;

    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      const address = first.address ?? {};
      const cityValue = address.city || address.town || address.village || address.county || city;
      const countryCode = (address.country_code || "").toUpperCase();
      const countryName = address.country || country;
      if (cityValue && countryCode) {
        return {
          city: titleCase(cityValue),
          countryCode,
          countryName: titleCase(countryName || country || ""),
        };
      }
    }
  } catch (error) {
    if (isHttpStatusError(error) && error.status === 403) {
      nominatim403 = true;
    }
  }

  let openMeteo403 = false;
  try {
    const openMeteoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const raw = await fetchTextWithTimeout(openMeteoUrl, 12000);
    const parsed = JSON.parse(raw) as {
      results?: Array<{
        name?: string;
        country?: string;
        country_code?: string;
        admin1?: string;
      }>;
    };

    const first = parsed.results?.[0];
    const cityValue = first?.name || city;
    const countryCode = (first?.country_code || "").toUpperCase();
    const countryName = first?.country || country;

    if (cityValue && countryCode) {
      return {
        city: titleCase(cityValue),
        countryCode,
        countryName: titleCase(countryName || country || ""),
      };
    }
  } catch (error) {
    if (isHttpStatusError(error) && error.status === 403) {
      openMeteo403 = true;
    }
  }

  if (nominatim403 && openMeteo403) {
    throw new Error("Geocoding locale temporaneamente bloccato (403). Riprova tra poco.");
  }
  throw new Error("Non riesco a determinare paese/citta' della localita'.");
}

async function fetchVerifiedMarketData(city: string, country: string): Promise<VerifiedMarketData> {
  const resolved = await resolveCityAndCountry(city, country);
  const cityCandidates = Array.from(
    new Set(
      [resolved.city, city, `${resolved.city}-${resolved.countryName}`, `${resolved.city}-${resolved.countryCode}`]
        .map((value) => slugifyForPath(value))
        .filter(Boolean)
    )
  );

  let numbeoSnapshot: ReturnType<typeof parseNumbeoPropertyMarkdown> = {
    priceCityCentrePerSqm: null,
    priceOutsideCentrePerSqm: null,
    mortgageFixedPct: null,
    areaUpdatedAt: "",
  };
  let areaSourceUrl = "";
  let areaSourceBlocked = false;

  for (const slug of cityCandidates) {
    const pageCandidates = [
      `https://www.numbeo.com/property-investment/in/${slug}`,
      `https://www.numbeo.com/cost-of-living/in/${slug}`,
    ];

    for (const pageUrl of pageCandidates) {
      const fetchCandidates = [
        { url: `https://r.jina.ai/http://${pageUrl.replace(/^https?:\/\//, "")}`, source: pageUrl },
        { url: `https://r.jina.ai/${pageUrl}`, source: pageUrl },
        { url: pageUrl, source: pageUrl },
      ];

      for (const candidate of fetchCandidates) {
        try {
          const raw = await fetchTextWithTimeout(candidate.url, 20000, {
            "User-Agent": "AffareSubito/1.0 (+https://affaresubito.app)",
            Referer: "https://affaresubito.app",
          });
          const rawLower = raw.toLowerCase();
          const parsed =
            rawLower.includes("price per square meter to buy apartment") || rawLower.includes("annual mortgage interest rate")
              ? parseNumbeoPropertyMarkdown(raw)
              : parseNumbeoPropertyHtml(raw);
          const hasUsefulData =
            (parsed.priceCityCentrePerSqm && parsed.priceCityCentrePerSqm > 0) ||
            (parsed.priceOutsideCentrePerSqm && parsed.priceOutsideCentrePerSqm > 0) ||
            (parsed.mortgageFixedPct && parsed.mortgageFixedPct > 0);
          if (hasUsefulData) {
            numbeoSnapshot = parsed;
            areaSourceUrl = candidate.source;
            break;
          }
        } catch (error) {
          if (isHttpStatusError(error) && error.status === 403) {
            areaSourceBlocked = true;
          }
        }
      }

      if (
        (numbeoSnapshot.priceCityCentrePerSqm && numbeoSnapshot.priceCityCentrePerSqm > 0) ||
        (numbeoSnapshot.priceOutsideCentrePerSqm && numbeoSnapshot.priceOutsideCentrePerSqm > 0) ||
        (numbeoSnapshot.mortgageFixedPct && numbeoSnapshot.mortgageFixedPct > 0)
      ) {
        break;
      }
    }

    if (
      (numbeoSnapshot.priceCityCentrePerSqm && numbeoSnapshot.priceCityCentrePerSqm > 0) ||
      (numbeoSnapshot.priceOutsideCentrePerSqm && numbeoSnapshot.priceOutsideCentrePerSqm > 0) ||
      (numbeoSnapshot.mortgageFixedPct && numbeoSnapshot.mortgageFixedPct > 0)
    ) {
      break;
    }
  }

  const ecbFixed = await fetchEcbMortgageRate(resolved.countryCode, "P");
  const ecbVariable = await fetchEcbMortgageRate(resolved.countryCode, "F");
  const worldBankTransferCost = await fetchWorldBankTransferCostPct(resolved.countryCode);
  const ecbRatesSourceUrl = `https://data-api.ecb.europa.eu/service/data/MIR/M.${resolved.countryCode}.B.A2C.P.R.A.2250.EUR.N?lastNObservations=1&format=csvdata`;
  const worldBankSourceUrl = `https://api.worldbank.org/v2/country/${resolved.countryCode}/indicator/IC.REG.PRRT.COST.PRT.VAL?format=json&per_page=60`;
  const effectiveFixedRate = ecbFixed?.value ?? numbeoSnapshot.mortgageFixedPct ?? null;
  const hasEcbRates = Boolean((ecbFixed?.value && ecbFixed.value > 0) || (ecbVariable?.value && ecbVariable.value > 0));
  const hasAreaData =
    (numbeoSnapshot.priceCityCentrePerSqm && numbeoSnapshot.priceCityCentrePerSqm > 0) ||
    (numbeoSnapshot.priceOutsideCentrePerSqm && numbeoSnapshot.priceOutsideCentrePerSqm > 0);
  const hasRatesData =
    (effectiveFixedRate && effectiveFixedRate > 0) || (ecbVariable?.value && ecbVariable.value > 0);

  if (!hasAreaData && !hasRatesData) {
    if (areaSourceBlocked) {
      throw new Error("Fonte locale temporaneamente bloccata (403). Riprova tra poco o inserisci benchmark manuale.");
    }
    throw new Error("Dati locali non disponibili per questa localita'.");
  }

  return {
    canonicalCity: resolved.city,
    countryCode: resolved.countryCode,
    countryName: resolved.countryName,
    priceCityCentrePerSqm: numbeoSnapshot.priceCityCentrePerSqm,
    priceOutsideCentrePerSqm: numbeoSnapshot.priceOutsideCentrePerSqm,
    mortgageFixedPct: effectiveFixedRate,
    mortgageVariablePct: ecbVariable?.value ?? null,
    renovationLightPerSqm: null,
    renovationMediumPerSqm: null,
    renovationHeavyPerSqm: null,
    transferCostPct: worldBankTransferCost?.value ?? null,
    areaSourceUrl: hasAreaData ? areaSourceUrl : "",
    ratesSourceUrl: hasRatesData ? (hasEcbRates ? ecbRatesSourceUrl : areaSourceUrl) : "",
    transferCostSourceUrl: worldBankTransferCost?.value ? worldBankSourceUrl : "",
    areaUpdatedAt: hasAreaData ? numbeoSnapshot.areaUpdatedAt || new Date().toISOString() : "",
    ratesUpdatedAt: ecbFixed?.period || ecbVariable?.period || numbeoSnapshot.areaUpdatedAt || "",
    transferCostUpdatedAt: worldBankTransferCost?.year || "",
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateMortgagePayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;

  const monthlyRate = annualRatePct / 100 / 12;
  const installments = Math.max(1, Math.round(years * 12));

  if (monthlyRate <= 0) {
    return principal / installments;
  }

  const factor = Math.pow(1 + monthlyRate, installments);
  return principal * ((monthlyRate * factor) / (factor - 1));
}

function estimateGoalFallbacks(params: {
  askingPrice: number;
  sqm: number;
  areaPricePerSqm: number;
  estimatedMarketValue: number;
  totalInvestment: number;
  settings: InvestorSettings;
}): { suggestedResalePrice: number; suggestedMonthlyRent: number } {
  const marketValueFromSqm = params.sqm > 0 && params.areaPricePerSqm > 0 ? params.sqm * params.areaPricePerSqm : 0;
  const effectiveMarketValue = params.estimatedMarketValue > 0 ? params.estimatedMarketValue : marketValueFromSqm;
  const minFlipTarget = params.totalInvestment > 0 ? params.totalInvestment * (1 + params.settings.minFlipMarginPct / 100) : 0;
  const baseResale = Math.max(effectiveMarketValue, params.askingPrice, minFlipTarget);

  const rentBase = Math.max(params.totalInvestment, effectiveMarketValue, params.askingPrice);
  const rentTargetPct = Math.max(5, params.settings.minRentYieldPct);
  const suggestedMonthlyRent = rentBase > 0 ? (rentBase * (rentTargetPct / 100)) / 12 : 0;

  return {
    suggestedResalePrice: Math.round(baseResale),
    suggestedMonthlyRent: Math.round(suggestedMonthlyRent),
  };
}

function buildAnalysisSupport(
  form: PropertyForm,
  settings: InvestorSettings,
  analyses: SavedAnalysis[],
  verifiedMarketData: VerifiedMarketData | null
): AnalysisSupport {
  const sqm = toNumber(form.sqm);
  const askingPrice = toNumber(form.askingPrice);
  const zoneKey = normalizeLocationToken(form.zone);
  const cityKey = normalizeLocationToken(form.city);
  const typeKey = normalizeLocationToken(form.propertyType);

  const comparablePool = analyses.filter((item) => {
    if (item.form.id === form.id) return false;
    if (normalizeLocationToken(item.form.city) !== cityKey) return false;
    return pricePerSqm(item.form) > 0;
  });

  const zoneMatches = zoneKey
    ? comparablePool.filter((item) => normalizeLocationToken(item.form.zone) === zoneKey)
    : comparablePool;
  const typedMatches = typeKey
    ? zoneMatches.filter((item) => normalizeLocationToken(item.form.propertyType) === typeKey)
    : zoneMatches;
  const comparables = typedMatches.length >= 2 ? typedMatches : zoneMatches.length >= 2 ? zoneMatches : comparablePool;
  const verifiedAreaPricePerSqm = pickVerifiedAreaPricePerSqm(verifiedMarketData, form.zone);

  const archivedAreaPricePerSqm = average(comparables.map((item) => pricePerSqm(item.form)).filter((value) => value > 0));
  const suggestedAreaPricePerSqm =
    archivedAreaPricePerSqm > 0
      ? archivedAreaPricePerSqm
      : verifiedAreaPricePerSqm > 0
        ? verifiedAreaPricePerSqm
      : settings.defaultAreaPricePerSqm > 0
        ? settings.defaultAreaPricePerSqm
        : pricePerSqm(form);
  const effectiveAreaPricePerSqm = resolveNumericInput(form.areaAveragePricePerSqm, suggestedAreaPricePerSqm);
  const suggestedEstimatedMarketValue = sqm > 0 ? suggestedAreaPricePerSqm * sqm : 0;
  const effectiveEstimatedMarketValue = resolveNumericInput(form.estimatedMarketValue, suggestedEstimatedMarketValue);
  const priceGapPct =
    effectiveEstimatedMarketValue > 0 && askingPrice > 0
      ? ((askingPrice - effectiveEstimatedMarketValue) / effectiveEstimatedMarketValue) * 100
      : 0;

  const renovationLightPerSqm = verifiedMarketData?.renovationLightPerSqm ?? settings.lightRenovationPerSqm;
  const renovationMediumPerSqm = verifiedMarketData?.renovationMediumPerSqm ?? settings.mediumRenovationPerSqm;
  const renovationHeavyPerSqm = verifiedMarketData?.renovationHeavyPerSqm ?? settings.heavyRenovationPerSqm;
  const suggestedRenovationCost = (() => {
    if (sqm <= 0) return 0;
    if (form.renovationLevel === "nessuno") return 0;
    if (form.renovationLevel === "leggero") return sqm * Math.max(0, renovationLightPerSqm);
    if (form.renovationLevel === "medio") return sqm * Math.max(0, renovationMediumPerSqm);
    if (form.renovationLevel === "pesante") return sqm * Math.max(0, renovationHeavyPerSqm);
    return 0;
  })();
  const suggestedAgencyFee = askingPrice > 0 ? askingPrice * (settings.defaultAgencyPct / 100) : 0;
  const transferCostPct = verifiedMarketData?.transferCostPct ?? null;
  const marketTaxesAndNotary = askingPrice > 0 && transferCostPct && transferCostPct > 0 ? askingPrice * (transferCostPct / 100) : 0;
  const suggestedTaxesAndNotary =
    marketTaxesAndNotary > 0
      ? marketTaxesAndNotary
      : settings.defaultTaxesAndNotary > 0
        ? settings.defaultTaxesAndNotary
        : askingPrice > 0
          ? askingPrice * 0.05
          : 0;
  const suggestedUnexpectedPct = settings.defaultUnexpectedPct;
  const suggestedUnexpectedValue = suggestedRenovationCost * (suggestedUnexpectedPct / 100);
  const suggestedAccessoryCosts = suggestedAgencyFee + suggestedTaxesAndNotary + suggestedUnexpectedValue;
  const { suggestedResalePrice, suggestedMonthlyRent } = estimateGoalFallbacks({
    askingPrice,
    sqm,
    areaPricePerSqm: effectiveAreaPricePerSqm,
    estimatedMarketValue: effectiveEstimatedMarketValue,
    totalInvestment: askingPrice + suggestedRenovationCost + suggestedAccessoryCosts,
    settings,
  });

  const effectiveDownPaymentPct = resolveNumericInput(form.mortgageDownPaymentPct, settings.defaultDownPaymentPct);
  const downPaymentAmount = Math.max(0, askingPrice * (effectiveDownPaymentPct / 100));
  const effectiveMortgageYears = resolveNumericInput(form.mortgageYears, settings.defaultMortgageYears);
  const effectiveFixedRate = resolveNumericInput(
    form.fixedMortgageRate,
    verifiedMarketData?.mortgageFixedPct ?? settings.defaultFixedRatePct
  );
  const effectiveVariableRate = resolveNumericInput(
    form.variableMortgageRate,
    verifiedMarketData?.mortgageVariablePct ?? settings.defaultVariableRatePct
  );
  const mortgagePrincipal = Math.max(0, askingPrice * (1 - effectiveDownPaymentPct / 100));
  const fixedMonthlyPayment = calculateMortgagePayment(mortgagePrincipal, effectiveFixedRate, effectiveMortgageYears);
  const variableMonthlyPayment = calculateMortgagePayment(mortgagePrincipal, effectiveVariableRate, effectiveMortgageYears);
  const installments = Math.max(1, Math.round(effectiveMortgageYears * 12));
  const fixedTotalInterest = Math.max(0, fixedMonthlyPayment * installments - mortgagePrincipal);
  const variableTotalInterest = Math.max(0, variableMonthlyPayment * installments - mortgagePrincipal);

  const areaBenchmarkLabel =
    comparables.length > 0
      ? `${comparables.length} comparabili interni${zoneKey ? " in zona" : " in citta'"}`
      : verifiedAreaPricePerSqm > 0
        ? `fonte web locale verificata: ${verifiedMarketData?.canonicalCity}, ${verifiedMarketData?.countryName}`
      : settings.defaultAreaPricePerSqm > 0
        ? "fallback configurato nelle impostazioni"
        : "nessun benchmark interno";

  return {
    comparableCount: comparables.length,
    areaBenchmarkLabel,
    suggestedAreaPricePerSqm,
    effectiveAreaPricePerSqm,
    suggestedEstimatedMarketValue,
    effectiveEstimatedMarketValue,
    priceGapPct,
    suggestedRenovationCost,
    suggestedResalePrice,
    suggestedMonthlyRent,
    suggestedAgencyFee,
    suggestedTaxesAndNotary,
    suggestedUnexpectedPct,
    suggestedUnexpectedValue,
    suggestedAccessoryCosts,
    downPaymentAmount,
    effectiveDownPaymentPct,
    effectiveMortgageYears,
    effectiveFixedRate,
    effectiveVariableRate,
    mortgagePrincipal,
    fixedMonthlyPayment,
    variableMonthlyPayment,
    fixedTotalInterest,
    variableTotalInterest,
  };
}

function calculateAnalysis(form: PropertyForm, settings: InvestorSettings): AnalysisResult {
  const askingPrice = toNumber(form.askingPrice);
  const sqm = toNumber(form.sqm);
  const resalePrice = toNumber(form.resalePrice);
  const monthlyRent = toNumber(form.monthlyRent);
  const taxesAndNotary =
    toNumber(form.taxesAndNotary) > 0 ? toNumber(form.taxesAndNotary) : settings.defaultTaxesAndNotary;
  const agencyFee =
    toNumber(form.agencyFee) > 0
      ? toNumber(form.agencyFee)
      : askingPrice * (settings.defaultAgencyPct / 100);
  const unexpectedPct =
    toNumber(form.unexpectedPct) > 0 ? toNumber(form.unexpectedPct) : settings.defaultUnexpectedPct;
  const renovationCost = inferRenovationCost(
    form.renovationLevel,
    sqm,
    settings,
    toNumber(form.renovationCost)
  );
  const furnitureCost = toNumber(form.furnitureCost);
  const otherCosts = toNumber(form.otherCosts);
  const unexpectedValue = renovationCost * (unexpectedPct / 100);
  const accessoryCosts = taxesAndNotary + agencyFee + furnitureCost + otherCosts + unexpectedValue;
  const totalInvestment = askingPrice + renovationCost + accessoryCosts;
  const areaPricePerSqm = resolveNumericInput(form.areaAveragePricePerSqm, settings.defaultAreaPricePerSqm);
  const estimatedMarketValue = resolveNumericInput(form.estimatedMarketValue, sqm > 0 ? areaPricePerSqm * sqm : 0);
  const fallback = estimateGoalFallbacks({
    askingPrice,
    sqm,
    areaPricePerSqm,
    estimatedMarketValue,
    totalInvestment,
    settings,
  });
  const effectiveResalePrice = resalePrice > 0 ? resalePrice : fallback.suggestedResalePrice;
  const effectiveMonthlyRent = monthlyRent > 0 ? monthlyRent : fallback.suggestedMonthlyRent;

  let grossMargin = 0;
  let grossMarginPct = 0;
  let annualRent = 0;
  let grossYieldPct = 0;
  let netYieldPct = 0;
  let score = 0;
  let color: ScoreColor = "rosso";
  let summary = "";

  if (form.goal === "flip") {
    grossMargin = effectiveResalePrice - totalInvestment;
    grossMarginPct = totalInvestment > 0 ? (grossMargin / totalInvestment) * 100 : 0;
    score = 52;
    score += Math.max(-30, Math.min(35, grossMarginPct - settings.minFlipMarginPct));
    if (renovationCost > askingPrice * 0.35) score -= 12;
    if (accessoryCosts > askingPrice * 0.18) score -= 8;
    if (effectiveResalePrice <= 0 || askingPrice <= 0 || sqm <= 0) score -= 35;
    if (resalePrice <= 0) score -= 6;
    if (totalInvestment > settings.maxBudget) score -= 6;
    score = Math.max(0, Math.min(100, score));

    if (grossMarginPct >= settings.minFlipMarginPct) color = "verde";
    else if (grossMarginPct >= settings.minFlipMarginPct * 0.55) color = "giallo";
    else color = "rosso";

    summary =
      color === "verde"
        ? "Margine solido. Rimangono da verificare tempi, rivendibilita' e sconto in ingresso."
        : color === "giallo"
          ? "Operazione sensibile. Basta poco sui lavori o sul prezzo di uscita per peggiorarla."
          : "Margine debole. Servono una trattativa migliore o ipotesi piu' prudenti.";
  } else {
    annualRent = effectiveMonthlyRent * 12;
    grossYieldPct = totalInvestment > 0 ? (annualRent / totalInvestment) * 100 : 0;
    const estimatedAnnualExpenses = annualRent * 0.2;
    netYieldPct =
      totalInvestment > 0 ? ((annualRent - estimatedAnnualExpenses) / totalInvestment) * 100 : 0;
    score = 52;
    score += Math.max(-25, Math.min(30, (netYieldPct - settings.minRentYieldPct) * 5));
    if (renovationCost > askingPrice * 0.25) score -= 10;
    if (accessoryCosts > askingPrice * 0.18) score -= 8;
    if (effectiveMonthlyRent <= 0 || askingPrice <= 0 || sqm <= 0) score -= 35;
    if (monthlyRent <= 0) score -= 6;
    if (totalInvestment > settings.maxBudget) score -= 6;
    score = Math.max(0, Math.min(100, score));

    if (netYieldPct >= settings.minRentYieldPct) color = "verde";
    else if (netYieldPct >= settings.minRentYieldPct * 0.7) color = "giallo";
    else color = "rosso";

    summary =
      color === "verde"
        ? "Rendimento interessante. Verifica domanda locativa, vacanza e spese condominiali."
        : color === "giallo"
          ? "Rendimento discreto ma fragile. Canone, lavori e tempi incidono molto."
          : "Rendimento debole. Per stare in piedi servono prezzo o canone migliori.";
  }

  const roundedScore = Math.round(score);

  return {
    totalInvestment,
    renovationCost,
    accessoryCosts,
    grossMargin,
    grossMarginPct,
    annualRent,
    grossYieldPct,
    netYieldPct,
    score: roundedScore,
    color,
    summary,
  };
}

function pricePerSqm(form: PropertyForm): number {
  const askingPrice = toNumber(form.askingPrice);
  const sqm = toNumber(form.sqm);
  return askingPrice > 0 && sqm > 0 ? askingPrice / sqm : 0;
}

function getPerformanceValue(item: SavedAnalysis): number {
  return item.form.goal === "flip" ? item.result.grossMarginPct : item.result.netYieldPct;
}

function getPerformanceLabel(item: SavedAnalysis): string {
  return item.form.goal === "flip"
    ? `Margine ${formatPercent(item.result.grossMarginPct)}`
    : `Rendimento netto ${formatPercent(item.result.netYieldPct)}`;
}

function buildSavedMemorySnapshot(
  item: SavedAnalysis,
  settings: InvestorSettings,
  analyses: SavedAnalysis[]
): SavedMemorySnapshot {
  const support = buildAnalysisSupport(item.form, settings, analyses, null);
  return {
    askingPrice: toNumber(item.form.askingPrice),
    sqm: toNumber(item.form.sqm),
    pricePerSqm: pricePerSqm(item.form),
    areaBenchmarkPerSqm: support.effectiveAreaPricePerSqm,
    totalInvestment: item.result.totalInvestment,
    performanceValue: getPerformanceValue(item),
    downPaymentPct: support.effectiveDownPaymentPct,
    downPaymentAmount: support.downPaymentAmount,
    fixedRatePct: support.effectiveFixedRate,
    variableRatePct: support.effectiveVariableRate,
    fixedMonthlyPayment: support.fixedMonthlyPayment,
    variableMonthlyPayment: support.variableMonthlyPayment,
  };
}

function extractMoneyCandidatesLegacy(text: string): MoneyCandidate[] {
  const lower = text.toLowerCase();
  const regexes = [
    /€\s*\d[\d.,\s]{0,18}(?:\s?(?:k|mila|mln|milioni))?/gi,
    /\d[\d.,\s]{0,18}\s*(?:€|euro|eur|k|mila|mln|milioni)/gi,
  ];
  const output: MoneyCandidate[] = [];

  for (const regex of regexes) {
    let match: RegExpExecArray | null = regex.exec(lower);
    while (match) {
      const raw = match[0];
      const index = match.index;
      const context = lower.slice(Math.max(0, index - 40), Math.min(lower.length, index + raw.length + 40));
      let value = parseFlexibleNumber(raw);

      if (/mln|milioni/.test(raw)) value *= 1000000;
      else if (/k|mila/.test(raw)) value *= 1000;

      if (value >= 100 && value <= 50000000) {
        output.push({ value: Math.round(value), index, context });
      }

      match = regex.exec(lower);
    }
  }

  return output.filter((item, index, array) => {
    return array.findIndex((candidate) => candidate.index === item.index && candidate.value === item.value) === index;
  });
}

function buildMoneyCandidateContext(text: string, startIndex: number, rawLength: number): string {
  const lower = text.toLowerCase();
  const currentStart = lower.lastIndexOf("\n", Math.max(0, startIndex - 1)) + 1;
  const currentEndCandidate = lower.indexOf("\n", startIndex + rawLength);
  const currentEnd = currentEndCandidate >= 0 ? currentEndCandidate : lower.length;
  return lower.slice(currentStart, currentEnd).trim();
}

function extractMoneyCandidates(text: string): MoneyCandidate[] {
  const regexes = [
    /(?:\u20ac)\s*\d[\d.,\s]{0,18}(?:\s?(?:k|mila|mln|milioni))?/gi,
    /\d[\d.,\s]{0,18}\s*(?:\u20ac|euro|eur|k|mila|mln|milioni)/gi,
    /\b\d{3,6}(?:[.,]\d{1,2})?\s*(?:\u20ac|e)(?=\s*\/?\s*(?:mese|mensile|mensili)\b)/gi,
    /\b\d{3,6}(?:[.,]\d{1,2})?\b(?=\s*(?:\/\s*mese|\s+al\s+mese|\s+mese\b))/gi,
    /\b\d{2,3}(?:[.\s]\d{3})+(?:,\d{2})?\b/g,
  ];
  const output: MoneyCandidate[] = [];

  for (const regex of regexes) {
    let match: RegExpExecArray | null = regex.exec(text);
    while (match) {
      const raw = match[0];
      const index = match.index;
      const context = buildMoneyCandidateContext(text, index, raw.length);
      let value = parseFlexibleNumber(raw);

      if (/mln|milioni/i.test(raw)) value *= 1000000;
      else if (/k|mila/i.test(raw)) value *= 1000;

      if (value >= 100 && value <= 50000000) {
        output.push({ value: Math.round(value), index, context });
      }

      match = regex.exec(text);
    }
  }

  return output.filter((item, index, array) => {
    return array.findIndex((candidate) => candidate.index === item.index && candidate.value === item.value) === index;
  });
}

function pickMoneyCandidate(
  candidates: MoneyCandidate[],
  positiveWords: string[],
  negativeWords: string[],
  minValue: number,
  maxValue: number
): number | null {
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestValue: number | null = null;

  for (const candidate of candidates) {
    if (candidate.value < minValue || candidate.value > maxValue) continue;

    let score = 0;
    for (const word of positiveWords) {
      if (candidate.context.includes(word)) score += 3;
    }
    for (const word of negativeWords) {
      if (candidate.context.includes(word)) score -= 4;
    }

    if (score > bestScore) {
      bestScore = score;
      bestValue = candidate.value;
    }
  }

  if (bestScore <= 0) return null;
  return bestValue;
}

function pickFallbackMoneyCandidate(candidates: MoneyCandidate[], minValue: number, maxValue: number): number | null {
  const filtered = candidates.filter((candidate) => {
    if (candidate.value < minValue || candidate.value > maxValue) return false;
    return !["mese", "mensile", "canone", "affitto", "mutuo", "rata", "spese", "annue", "annuali", "fino", "filtri", "salva ricerca", "budget"].some(
      (word) => candidate.context.includes(word)
    );
  });

  if (filtered.length === 0) return null;
  return [...filtered].sort((a, b) => b.value - a.value)[0]?.value ?? null;
}

function extractTopStandalonePrice(text: string): number | null {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  let bestValue: number | null = null;

  for (const line of lines) {
    if (/\b(?:mq|m2|mÂ²|m²|mese|mensile|canone|rata|mutuo)\b/i.test(line)) continue;
    const matches = line.match(/\b\d{2,3}(?:[.\s]\d{3})+(?:,\d{2})?\b/g) || [];
    for (const raw of matches) {
      const value = Math.round(parseFlexibleNumber(raw));
      if (value < 10000 || value > 20000000) continue;
      if (bestValue === null || value > bestValue) bestValue = value;
    }
  }

  return bestValue;
}

function extractSqmLegacy(text: string): number | null {
  const regexes = [
    /(\d{2,4})(?:[,.]\d+)?\s*(?:mq|m2|m²)\b/gi,
    /superficie[^\d]{0,10}(\d{2,4})/gi,
    /(\d{2,4})(?:[,.]\d+)?\s*(?:metri quadri|metri commerciali|metri)\b/gi,
  ];

  for (const regex of regexes) {
    const match = regex.exec(text);
    if (match?.[1]) {
      const sqm = Math.round(parseFlexibleNumber(match[1]));
      if (sqm >= 15 && sqm <= 1000) return sqm;
    }
  }

  return null;
}

function getSqmContextScore(line: string): number {
  const normalized = normalizeText(line);
  let score = 0;

  if (normalized.includes("totale superficie principale")) score += 18;
  else {
    if (normalized.includes("superficie principale")) score += 14;
    if (normalized.includes("superficie commerciale") || normalized.includes("sup commerciale") || normalized.includes("commerciale")) score += 10;
    if (normalized.includes("dettagli superficie")) score += 4;
    if (normalized.includes("superficie")) score += 6;
  }

  if (/(mq|m2|mÂ²|m²|metri quadri|metri commerciali)/i.test(line)) score += 3;
  if (normalized.includes("totale")) score += 2;

  return score;
}

function pushSqmCandidate(output: Array<{ value: number; score: number }>, rawValue: string, line: string, scoreBonus = 0) {
  const value = parseFlexibleNumber(rawValue);
  if (!Number.isFinite(value) || value < 15 || value > 1000) return;
  output.push({ value, score: getSqmContextScore(line) + scoreBonus });
}

function extractSqm(text: string): number | null {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates: Array<{ value: number; score: number }> = [];
  const linePatterns = [
    /(\d{1,4}(?:[,.]\d{1,2})?)\s*(?:mq|m2|mÂ²|m²)/gi,
    /superficie[^\d]{0,24}(\d{1,4}(?:[,.]\d{1,2})?)/gi,
    /totale[^\d]{0,24}(\d{1,4}(?:[,.]\d{1,2})?)/gi,
  ];

  for (const line of lines) {
    const packedMatch = line.match(/\b(\d)\s*(\d{2})(?:[,.]\d+)?\s*(?:mq|m2|mÂ²|m²)(?=\S*[A-Za-z]\S*\d)/i);
    if (packedMatch?.[2]) {
      pushSqmCandidate(candidates, packedMatch[2], line, 14);
    }

    for (const pattern of linePatterns) {
      let match: RegExpExecArray | null = pattern.exec(line);
      while (match) {
        if (match[1]) pushSqmCandidate(candidates, match[1], line);
        match = pattern.exec(line);
      }
    }
  }

  if (candidates.length === 0) {
    const looseMatch = text.match(/(\d{2,4})(?:[.,]\d{1,2})?\s*m(?:q|2|Â²|²)?\b/i);
    if (looseMatch?.[1]) {
      const looseValue = Math.round(parseFlexibleNumber(looseMatch[1]));
      if (looseValue >= 15 && looseValue <= 1000) return looseValue;
    }
    return null;
  }
  const bestCandidate = [...candidates].sort((left, right) => right.score - left.score || right.value - left.value)[0];
  return bestCandidate ? Math.round(bestCandidate.value) : null;
}

function parseSmallCountToken(raw: string): number | null {
  const normalized = normalizeSpeechPhrase(raw);
  if (!normalized) return null;
  if (/^\d{1,2}$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const wordMap: Record<string, number> = {
    zero: 0,
    un: 1,
    uno: 1,
    una: 1,
    due: 2,
    tre: 3,
    quattro: 4,
    cinque: 5,
    sei: 6,
    sette: 7,
    otto: 8,
    nove: 9,
    dieci: 10,
  };

  return Number.isFinite(wordMap[normalized]) ? wordMap[normalized] : null;
}

function extractCountByPatterns(text: string, patterns: RegExp[], fallbackChecks: Array<[string, number]> = []): number | null {
  const normalized = normalizeSpeechPhrase(text);

  for (const [pattern, value] of fallbackChecks) {
    if (normalized.includes(pattern)) return value;
  }

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const parsed = parseSmallCountToken(raw);
    if (parsed !== null && parsed >= 0 && parsed <= 20) return parsed;
  }

  return null;
}

function extractBedrooms(text: string): number | null {
  return extractCountByPatterns(text, [
    /(\d{1,2}|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s+(?:camere?|stanze?)\b(?:\s+da\s+letto)?/i,
    /(?:camere?|stanze?)\b(?:\s+da\s+letto)?\s*[:\-]?\s*(\d{1,2}|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/i,
  ]);
}

function extractBathroomsLegacy(text: string): number | null {
  return extractCountByPatterns(
    text,
    [
      /(\d{1,2}|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s*bagni?\b/i,
      /bagni?\b\s*[:\-]?\s*(\d{1,2}|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/i,
    ],
    [
      ["doppio bagno", 2],
      ["doppi servizi", 2],
    ]
  );
}

function extractBathrooms(text: string): number | null {
  const normalized = normalizeSpeechPhrase(text);
  if (normalized.includes("doppio bagno") || normalized.includes("doppi servizi")) return 2;

  const lines = text
    .split(/\n+/)
    .map((line) => normalizeSpeechPhrase(line))
    .filter(Boolean);
  const tokenPattern = "(\\d{1,2}|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)";
  const labelFirst = new RegExp(`\\bbagni?\\b\\s*[:\\-]?\\s*${tokenPattern}\\b`, "i");
  const valueFirst = new RegExp(`\\b${tokenPattern}\\s+bagni?\\b`, "i");

  for (const line of lines) {
    const match = line.match(labelFirst);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const parsed = parseSmallCountToken(raw);
    if (parsed !== null && parsed >= 0 && parsed <= 20) return parsed;
  }

  for (const line of lines) {
    const match = line.match(valueFirst);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const prefix = line.slice(0, match?.index ?? 0);
    if (/\b(locali?|stanze?|camere?)\b/.test(prefix)) continue;
    const parsed = parseSmallCountToken(raw);
    if (parsed !== null && parsed >= 0 && parsed <= 20) return parsed;
  }

  return null;
}

function extractBooleanFeature(text: string, positivePatterns: string[], negativePatterns: string[]): boolean | null {
  const normalized = normalizeSpeechPhrase(text);
  if (!normalized) return null;

  for (const pattern of negativePatterns) {
    if (normalized === pattern || normalized.startsWith(`${pattern} `) || normalized.includes(pattern)) return false;
  }

  for (const pattern of positivePatterns) {
    if (normalized === pattern || normalized.startsWith(`${pattern} `) || normalized.includes(pattern)) return true;
  }

  return null;
}

function extractGarageFeature(text: string): boolean | null {
  const normalized = normalizeSpeechPhrase(text);
  if (!normalized) return null;

  if (
    normalized.includes("senza garage") ||
    normalized.includes("senza box auto") ||
    normalized.includes("senza box") ||
    normalized.includes("garage assente")
  ) {
    return false;
  }

  if (
    normalized.includes("garage") ||
    normalized.includes("box auto") ||
    normalized.includes("autorimessa") ||
    normalized.includes("box singolo") ||
    normalized.includes("box doppio") ||
    /\bbox\b\s*[:\-]?\s*\d{1,2}\b/.test(normalized)
  ) {
    return true;
  }

  return null;
}

function parseFloorValue(raw: string, allowStandaloneNumeric = false): string {
  const compact = normalizeText(raw).replace(/\s+/g, " ").trim();
  if (!compact) return "";

  if (compact === "terra" || compact === "piano terra" || compact === "al piano terra" || compact.includes("piano terra")) return "0";
  if (
    compact === "seminterrato" ||
    compact === "interrato" ||
    compact === "piano seminterrato" ||
    compact === "piano interrato" ||
    compact.includes("seminterrato") ||
    compact.includes("interrato")
  ) {
    return "-1";
  }
  if (compact === "rialzato" || compact === "piano rialzato" || compact.includes("rialzato")) return "1";

  const wordMap: Record<string, string> = {
    primo: "1",
    secondo: "2",
    terzo: "3",
    quarto: "4",
    quinto: "5",
    sesto: "6",
    settimo: "7",
    ottavo: "8",
  };

  for (const [word, value] of Object.entries(wordMap)) {
    if (
      compact === word ||
      compact === `${word} piano` ||
      compact === `piano ${word}` ||
      compact === `al ${word} piano` ||
      compact === `al piano ${word}` ||
      compact.includes(`${word} piano`) ||
      compact.includes(`piano ${word}`)
    ) {
      return value;
    }
  }

  const explicitNumericMatch =
    compact.match(/\b(?:piano|floor)\s*[:\-]?\s*(-?\d{1,2})\b/) ||
    compact.match(/\b(-?\d{1,2})(?:°|º|o|a)?\s*piano\b/);
  if (explicitNumericMatch?.[1]) return explicitNumericMatch[1];

  if (allowStandaloneNumeric && /^-?\d{1,2}$/.test(compact)) return compact;

  return "";
}

function extractFloor(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => normalizeText(line).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const compact = normalizeText(text).replace(/\s+/g, " ").trim();

  if (lines.length <= 1 || compact.length <= 28) {
    return parseFloorValue(compact, true);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const parsedInline = parseFloorValue(line, line.split(" ").length <= 2);
    if (parsedInline) return parsedInline;

    if (/\b(?:piano|floor)\b/.test(line)) {
      const nextLine = lines[index + 1] || "";
      const parsedNext = parseFloorValue(nextLine, true);
      if (parsedNext) return parsedNext;
    }
  }

  return parseFloorValue(compact, false);
}

function extractType(text: string): string {
  const t = normalizeText(text);
  for (const propertyType of PROPERTY_TYPES) {
    if (t.includes(propertyType)) return propertyType;
  }

  const localiMatch = t.match(/(\d{1,2})\s*locali\b/);
  const locali = localiMatch?.[1] ? Number(localiMatch[1]) : 0;
  if (locali === 1) return "monolocale";
  if (locali === 2) return "bilocale";
  if (locali === 3) return "trilocale";
  if (locali === 4) return "quadrilocale";
  if (locali >= 5) return "appartamento";

  return "";
}

function extractGoal(text: string, rentValue: number | null, resaleValue: number | null): Goal | null {
  const t = normalizeText(text);
  if (
    rentValue ||
    t.includes("affitto") ||
    t.includes("locazione") ||
    t.includes("messa a reddito") ||
    t.includes("da mettere a reddito") ||
    t.includes("locato") ||
    t.includes("canone")
  ) {
    return "rent";
  }

  if (
    resaleValue ||
    t.includes("flip") ||
    t.includes("rivendere") ||
    t.includes("rivendita") ||
    t.includes("exit")
  ) {
    return "flip";
  }

  return null;
}

function cleanupLocation(value: string): string {
  let cleaned = stripTrailingPunctuation(value).replace(/[|•·]+/g, " ").replace(/\s{2,}/g, " ").trim();
  const normalizedTokens = normalizeSpeechPhrase(cleaned)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
  if (normalizedTokens.length === 0) return "";
  if (normalizedTokens.every((token) => token.length <= 2)) return "";
  if (normalizedTokens.some((token) => LOCATION_STOP_WORDS.includes(token))) return "";
  cleaned = cleaned
    .split(" ")
    .filter((token) => normalizeSpeechPhrase(token).length > 1 || /[A-Za-zÀ-ú]{2,}/.test(token))
    .join(" ")
    .trim();
  if (cleaned.length <= 2) return "";
  if (cleaned.length > 32) {
    cleaned = cleaned.split(",")[0]?.trim() || cleaned;
  }
  return titleCase(cleaned);
}

function extractProvince(text: string): string {
  const compact = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const provincePatterns = [
    /provincia(?:\s+di)?\s+([A-ZÀ-Ú][A-Za-zÀ-ú' -]{1,30})/iu,
    /prov\.\s*([A-ZÀ-Ú][A-Za-zÀ-ú' -]{1,30})/iu,
    /\(([A-Z]{2})\)/u,
  ];

  for (const pattern of provincePatterns) {
    const match = compact.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
    const cleaned = cleanupLocation(raw);
    if (cleaned) return cleaned;
  }
  return "";
}

function formatLocationLabel(location: { city: string; province?: string; zone?: string; country?: string }): string {
  const city = location.city.trim();
  const province = location.province?.trim() || "";
  const zone = location.zone?.trim() || "";
  const country = location.country?.trim() || "";
  const cityBlock = city ? (province ? `${city} (${province.toUpperCase()})` : city) : "";
  return [cityBlock, zone, country ? `(${country})` : ""].filter(Boolean).join(" • ");
}

function stripPropertyTypePrefix(value: string): string {
  let cleaned = value.trim();
  for (const propertyType of PROPERTY_TYPES) {
    const pattern = new RegExp(`^${propertyType}\\s+`, "i");
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim();
}

function extractCityZoneLegacy(text: string): { city: string; zone: string } {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const compact = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  let city = "";
  let zone = "";

  const zonePatterns = [
    /zona\s+([A-Za-zÀ-ú0-9' -]{2,40})/i,
    /quartiere\s+([A-Za-zÀ-ú0-9' -]{2,40})/i,
    /in\s+zona\s+([A-Za-zÀ-ú0-9' -]{2,40})/i,
  ];

  for (const pattern of zonePatterns) {
    const match = compact.match(pattern);
    if (match?.[1]) {
      zone = cleanupLocation(match[1].split(" con ")[0]?.split(" senza ")[0] || match[1]);
      if (zone) break;
    }
  }

  const addressLine = rawLines.find((line) => /,\s*(?:via|viale|piazza|corso|vicolo|strada|sp\b|localita\b)/iu.test(line));
  if (addressLine) {
    const addressMatch = addressLine.match(/^([A-ZÀ-Ú][A-Za-zÀ-ú' -]{1,30})\s*,\s*(?:via|viale|piazza|corso|vicolo|strada|sp\b|localita\b)/u);
    if (addressMatch?.[1]) {
      city = cleanupLocation(addressMatch[1]);
    }
  }

  const cityPatterns = [
    /nel comune di\s+([A-ZÀ-Ú][A-Za-zÀ-ú']{1,20}(?:\s+[A-ZÀ-Ú][A-Za-zÀ-ú']{1,20}){0,2})(?=$|[,.()]|\s+(?:zona|quartiere|via|viale|piazza|corso|sp\b|nel\b|con\b|senza\b|proponiamo\b|ideale\b|immobile\b))/u,
    /\ba\s+([A-ZÀ-Ú][A-Za-zÀ-ú']{1,20}(?:\s+[A-ZÀ-Ú][A-Za-zÀ-ú']{1,20}){0,2})(?=$|[,.()]|\s+(?:zona|quartiere|via|viale|piazza|corso|sp\b|nel\b|con\b|senza\b|proponiamo\b|ideale\b|immobile\b))/u,
    /\bdi\s+([A-ZÀ-Ú][A-Za-zÀ-ú']{1,20}(?:\s+[A-ZÀ-Ú][A-Za-zÀ-ú']{1,20}){0,2})(?=$|[,.()]|\s+(?:zona|quartiere|via|viale|piazza|corso|sp\b|nel\b|con\b|senza\b|proponiamo\b|ideale\b|immobile\b))/u,
  ];

  if (!city) {
    for (const pattern of cityPatterns) {
      const match = compact.match(pattern);
      if (match?.[1]) {
        city = cleanupLocation(match[1].split(" zona ")[0]?.split(" quartiere ")[0] || match[1]);
        if (city) break;
      }
    }
  }

  const bulletSource =
    rawLines.find((line) => {
      const normalized = normalizeText(line);
      return !isLikelyPortalUiLine(line) && (PROPERTY_TYPES.some((propertyType) => normalized.includes(propertyType)) || /[•·|]/.test(line));
    }) || compact;

  const bulletPieces = bulletSource
    .split(/[•·|]/)
    .map((piece) => cleanupLocation(stripPropertyTypePrefix(piece.replace(/\([A-Z]{2}\)/g, "").trim())))
    .filter(Boolean);

  if (!city && bulletPieces.length >= 2) {
    const lastPiece = bulletSource.split(/[•·|]/).map((piece) => piece.trim()).filter(Boolean).slice(-1)[0] || "";
    const first = bulletPieces[0];
    const second = bulletPieces[1];

    if (/\([A-Z]{2}\)/.test(lastPiece)) {
      city = second || first;
      if (!zone && first && first !== city) zone = first;
    } else {
      city = first;
      if (!zone && second && !/\d/.test(second)) zone = second;
    }
  }

  if (!city) {
    const pieces = compact
      .split(/[,\n\-•·]/)
      .map((piece) => piece.trim())
      .filter(Boolean);
    for (const piece of pieces) {
      if (/^[A-ZÀ-Ú][A-Za-zÀ-ú' ]{1,28}$/.test(piece)) {
        const candidate = cleanupLocation(piece);
        if (candidate) {
          city = candidate;
          break;
        }
      }
    }
  }

  return { city, zone };
}

function extractCityZone(text: string): { city: string; zone: string } {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const usefulLines = rawLines.filter((line) => !isLikelyPortalUiLine(line));
  const compact = usefulLines.join(" ").replace(/\s+/g, " ").trim();
  let city = "";
  let zone = "";

  const zonePatterns = [
    /zona\s+([\p{L}0-9' -]{2,40})/iu,
    /quartiere\s+([\p{L}0-9' -]{2,40})/iu,
    /-(?!\s*(?:via|viale|piazza|corso|vicolo|strada|sp\b|localita\b))\s*([\p{Lu}][\p{L}' -]{2,40})(?=$|[,(])/iu,
  ];

  for (const pattern of zonePatterns) {
    const match = compact.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const cleaned = cleanupLocation(raw.split(" con ")[0]?.split(" senza ")[0] || raw);
    if (cleaned) {
      zone = cleaned;
      break;
    }
  }

  for (const line of usefulLines) {
    const cityFirstMatch = line.match(/^([\p{Lu}][\p{L}' -]{1,40})\s*,\s*(?:via|viale|piazza|corso|vicolo|strada|sp\b|localita\b)[^\n-]{0,80}(?:-\s*([\p{Lu}][\p{L}' -]{1,40}))?/iu);
    if (cityFirstMatch?.[1]) {
      if (!city) city = cleanupLocation(cityFirstMatch[1]);
      if (!zone && cityFirstMatch[2]) zone = cleanupLocation(cityFirstMatch[2]);
      if (city && zone) return { city, zone };
    }

    const streetFirstMatch = line.match(/(?:via|viale|piazza|corso|vicolo|strada|sp\b|localita\b)\s+[\p{L}0-9' .-]{2,80},\s*([\p{Lu}][\p{L}' -]{1,40})(?=$|\s*\(|\s*-|\s*,)/iu);
    if (streetFirstMatch?.[1] && !city) {
      city = cleanupLocation(streetFirstMatch[1]);
      if (city && zone) return { city, zone };
    }

    const provinceMatch = line.match(/([\p{Lu}][\p{L}' -]{1,40})\s*\(([A-Z]{2})\)/u);
    if (provinceMatch?.[1] && !city) {
      const candidate = cleanupLocation(provinceMatch[1]);
      if (candidate) city = candidate;
    }
  }

  for (const line of usefulLines) {
    if (!/[|]/.test(line) && !line.includes("\u2022") && !line.includes("\u00b7")) continue;
    const rawPieces = line
      .split(/[\u2022\u00b7|]/u)
      .map((piece) => stripPropertyTypePrefix(piece.replace(/\([A-Z]{2}\)/g, "").trim()))
      .filter(Boolean);
    const cleanedPieces = rawPieces.map((piece) => cleanupLocation(piece)).filter(Boolean);
    if (cleanedPieces.length < 2) continue;

    if (/\([A-Z]{2}\)/.test(line) && cleanedPieces.length >= 2) {
      if (!city) city = cleanedPieces[1] || cleanedPieces[0];
      if (!zone && cleanedPieces[0] && cleanedPieces[0] !== city) zone = cleanedPieces[0];
    } else {
      if (!city) city = cleanedPieces[0];
      if (!zone && cleanedPieces[1] && cleanedPieces[1] !== city) zone = cleanedPieces[1];
    }

    if (city && zone) return { city, zone };
  }

  for (const line of usefulLines) {
    const stripped = stripPropertyTypePrefix(line.replace(/\([A-Z]{2}\)/g, "").trim());
    if (!stripped) continue;
    const normalizedStripped = normalizeText(stripped);
    if (/(^| )(piano|superficie|abitazione|dettagli|bagni|locali|commerciale|principale)( |$)/.test(normalizedStripped)) continue;

    const commaIndex = stripped.indexOf(",");
    const head = commaIndex > 0 ? stripped.slice(0, commaIndex).trim() : stripped;
    const words = head.split(/\s+/).filter(Boolean);
    const locationWords: string[] = [];

    for (let index = 0; index < words.length; index += 1) {
      const token = words[index].replace(/[()]/g, "");
      if (!/^[\p{Lu}][\p{L}'’-]*$/u.test(token)) break;
      locationWords.push(token);
    }

    if (locationWords.length >= 2) {
      const firstLocation = cleanupLocation(locationWords[0]);
      const zoneCandidate = cleanupLocation(locationWords.slice(1).join(" "));
      if (!firstLocation) continue;
      if (!city) city = firstLocation;
      if (!zone && zoneCandidate && normalizeText(firstLocation) === normalizeText(city)) zone = zoneCandidate;
      if (city && zone) break;
    }
  }

  if (!city) {
    const cityPatterns = [
      /nel comune di\s+([\p{Lu}][\p{L}']{1,20}(?:\s+[\p{Lu}][\p{L}']{1,20}){0,2})/u,
      /\ba\s+([\p{Lu}][\p{L}']{1,20}(?:\s+[\p{Lu}][\p{L}']{1,20}){0,2})/u,
    ];

    for (const pattern of cityPatterns) {
      const match = compact.match(pattern);
      const raw = match?.[1]?.trim();
      if (!raw) continue;
      const cleaned = cleanupLocation(raw);
      if (cleaned) {
        city = cleaned;
        break;
      }
    }
  }

  city = cleanupLocation(city);
  zone = cleanupLocation(zone);
  return { city, zone };
}

function isLikelyPortalUiLine(value: string): boolean {
  const raw = value.toLowerCase();
  const normalized = normalizeSpeechPhrase(value);
  if (!normalized) return true;
  if (/^\d{1,2}\s?\d{2}$/.test(normalized.replace(/\s+/g, ""))) return true;
  if (raw.includes("http") || raw.includes(".it/")) return true;
  return [
    "tecnocasa",
    "casa it",
    "immobiliare it",
    "idealista",
    "medialabtc",
    "filtri",
    "salva ricerca",
    "lista",
    "mappa",
    "visita",
    "virtuale",
    "foto",
    "planimetrie",
    "chiama",
    "scrivi",
    "messaggi",
    "contattaci",
  ].some((token) => normalized.includes(token));
}

function extractTitle(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && line.length <= 90 && !isLikelyPortalUiLine(line));

  const priorityCandidate = lines.find((line) => {
    const normalized = normalizeText(line);
    return normalized.includes("in vendita") || normalized.includes("in affitto");
  });
  if (priorityCandidate) return stripTrailingPunctuation(priorityCandidate);

  const propertyCandidate = lines.find((line) => {
    const normalized = normalizeText(line);
    return PROPERTY_TYPES.some((propertyType) => normalized.includes(propertyType)) || /\b\d{1,2}\s+locali\b/i.test(normalized);
  });
  if (propertyCandidate) return stripTrailingPunctuation(propertyCandidate);

  return lines[0] ? stripTrailingPunctuation(lines[0]) : "";
}

function buildFormPatchFromText(text: string): Partial<PropertyForm> {
  const title = extractTitle(text);
  const condition = parseCondition(text);
  const renovationLevel = inferRenovationLevelFromCondition(condition);
  const propertyType = extractType(text);
  const floor = extractFloor(text);
  const sqm = extractSqm(text);
  const bedrooms = extractBedrooms(text);
  const bathrooms = extractBathrooms(text);
  const candidates = extractMoneyCandidates(text);
  const askingPrice =
    pickMoneyCandidate(
      candidates,
      ["prezzo", "richiesta", "richiesto", "vendita", "costo", "trattabile"],
      ["affitto", "canone", "mese", "mensile", "locato", "rendita", "rivendita", "uscita", "rata", "mutuo"],
      10000,
      20000000
    ) ?? pickFallbackMoneyCandidate(candidates, 10000, 20000000) ?? extractTopStandalonePrice(text);
  const monthlyRent = pickMoneyCandidate(
    candidates,
    ["affitto", "canone", "mese", "mensile", "locato", "rendita", "reddito"],
    ["prezzo", "richiesta", "vendita", "rivendita", "uscita", "rata", "mutuo", "potenziale", "potenzialmente", "mercato", "stimato"],
    200,
    20000
  );
  const resalePrice = pickMoneyCandidate(
    candidates,
    ["rivendita", "rivendere", "uscita", "exit", "valore finale", "post lavori"],
    ["affitto", "canone", "mese", "mensile"],
    10000,
    30000000
  );
  const goal = extractGoal(text, monthlyRent, resalePrice);
  const { city, zone } = extractCityZone(text);
  const province = extractProvince(text);
  const normalized = normalizeText(text);
  const hasCellar = extractBooleanFeature(text, ["cantina", "con cantina"], ["senza cantina", "privo di cantina", "cantina assente"]);
  const hasGarage = extractGarageFeature(text);
  const hasGarden = extractBooleanFeature(
    text,
    ["giardino", "giardino privato", "cortile privato"],
    ["senza giardino", "privo di giardino", "giardino assente"]
  );

  const patch: Partial<PropertyForm> = {};
  if (title) patch.title = title;
  if (province) patch.province = province;
  if (city) patch.city = city;
  if (zone) patch.zone = zone;
  if (askingPrice) patch.askingPrice = String(askingPrice);
  if (sqm) patch.sqm = String(sqm);
  if (bedrooms !== null) patch.bedrooms = String(Math.round(bedrooms));
  if (bathrooms !== null) patch.bathrooms = String(Math.round(bathrooms));
  if (propertyType) patch.propertyType = propertyType;
  if (floor) patch.floor = floor;
  if (goal) patch.goal = goal;
  patch.condition = condition;
  patch.renovationLevel = renovationLevel;
  if (monthlyRent) patch.monthlyRent = String(monthlyRent);
  if (resalePrice) patch.resalePrice = String(resalePrice);

  if (normalized.includes("senza ascensore") || normalized.includes("no ascensore")) {
    patch.hasElevator = false;
  } else if (
    normalized.includes("con ascensore") ||
    normalized.includes("dotato di ascensore") ||
    normalized.includes("ascensorato")
  ) {
    patch.hasElevator = true;
  }
  if (typeof hasCellar === "boolean") patch.hasCellar = hasCellar;
  if (typeof hasGarage === "boolean") patch.hasGarage = hasGarage;
  if (typeof hasGarden === "boolean") patch.hasGarden = hasGarden;

  patch.notes = text.trim();
  return patch;
}

function mergeFormWithPatch(currentForm: PropertyForm, patch: Partial<PropertyForm>): PropertyForm {
  const next: PropertyForm = { ...currentForm };
  const assignString = (key: keyof PropertyForm, value: string | undefined) => {
    if (value && value.trim()) next[key] = value as never;
  };

  assignString("title", patch.title);
  assignString("province", patch.province);
  assignString("city", patch.city);
  assignString("country", patch.country);
  assignString("zone", patch.zone);
  assignString("askingPrice", patch.askingPrice);
  assignString("sqm", patch.sqm);
  assignString("bedrooms", patch.bedrooms);
  assignString("bathrooms", patch.bathrooms);
  assignString("propertyType", patch.propertyType);
  assignString("floor", patch.floor);
  assignString("resalePrice", patch.resalePrice);
  assignString("monthlyRent", patch.monthlyRent);
  assignString("renovationCost", patch.renovationCost);
  assignString("unexpectedPct", patch.unexpectedPct);
  assignString("taxesAndNotary", patch.taxesAndNotary);
  assignString("agencyFee", patch.agencyFee);
  assignString("furnitureCost", patch.furnitureCost);
  assignString("otherCosts", patch.otherCosts);
  assignString("notes", patch.notes);

  if (patch.goal) next.goal = patch.goal;
  if (patch.condition) next.condition = patch.condition;
  if (patch.renovationLevel) next.renovationLevel = patch.renovationLevel;
  if (typeof patch.hasElevator === "boolean") next.hasElevator = patch.hasElevator;
  if (typeof patch.hasCellar === "boolean") next.hasCellar = patch.hasCellar;
  if (typeof patch.hasGarage === "boolean") next.hasGarage = patch.hasGarage;
  if (typeof patch.hasGarden === "boolean") next.hasGarden = patch.hasGarden;

  if (!next.title.trim()) {
    const parts = [
      patch.propertyType ? titleCase(patch.propertyType) : next.propertyType ? titleCase(next.propertyType) : "Immobile",
      next.city,
      next.zone ? `- ${next.zone}` : "",
    ].filter(Boolean);
    next.title = parts.join(" ").trim();
  }

  return next;
}

function parseAdTextToForm(text: string, currentForm: PropertyForm): PropertyForm {
  return mergeFormWithPatch(currentForm, buildFormPatchFromText(text));
}

function formatDevOcrRegressionValue(value: string | boolean | undefined): string {
  if (typeof value === "boolean") return value ? "si" : "no";
  return typeof value === "string" ? value.trim() : "";
}

function compareDevOcrRegressionValue(actual: string | boolean | undefined, expected: string | boolean | undefined): boolean {
  if (typeof expected === "boolean") return actual === expected;
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  return normalizeText(actual) === normalizeText(expected);
}

function summarizeDevOcrRegressionResult(form: PropertyForm): string {
  const parts = [
    form.askingPrice ? `p=${form.askingPrice}` : "",
    form.city ? `c=${form.city}` : "",
    form.zone ? `z=${form.zone}` : "",
    form.sqm ? `mq=${form.sqm}` : "",
    form.bathrooms ? `bagni=${form.bathrooms}` : "",
    form.monthlyRent ? `aff=${form.monthlyRent}` : "",
    form.floor ? `piano=${form.floor}` : "",
    form.propertyType ? `tipo=${form.propertyType}` : "",
    typeof form.hasElevator === "boolean" ? `asc=${form.hasElevator ? "si" : "no"}` : "",
    typeof form.hasGarage === "boolean" ? `box=${form.hasGarage ? "si" : "no"}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

function buildPatchFromAI(payload: AIExtractionPayload): Partial<PropertyForm> {
  const patch: Partial<PropertyForm> = {};
  const country = typeof payload.country === "string" ? payload.country : "";
  if (payload.title.trim()) patch.title = payload.title.trim();
  if (payload.city.trim()) patch.city = titleCase(payload.city.trim());
  if (country.trim()) patch.country = titleCase(country.trim());
  if (payload.zone.trim()) patch.zone = titleCase(payload.zone.trim());
  if (payload.askingPrice > 0) patch.askingPrice = String(Math.round(payload.askingPrice));
  if (payload.sqm > 0) patch.sqm = String(Math.round(payload.sqm));
  if (payload.bedrooms > 0) patch.bedrooms = String(Math.round(payload.bedrooms));
  if (payload.bathrooms > 0) patch.bathrooms = String(Math.round(payload.bathrooms));
  if (payload.propertyType.trim()) patch.propertyType = normalizeText(payload.propertyType);
  if (payload.floor.trim()) patch.floor = payload.floor.trim();
  if (payload.goal !== "unknown") patch.goal = payload.goal;
  if (payload.hasElevator === "yes") patch.hasElevator = true;
  if (payload.hasElevator === "no") patch.hasElevator = false;
  if (payload.hasCellar === "yes") patch.hasCellar = true;
  if (payload.hasCellar === "no") patch.hasCellar = false;
  if (payload.hasGarage === "yes") patch.hasGarage = true;
  if (payload.hasGarage === "no") patch.hasGarage = false;
  if (payload.hasGarden === "yes") patch.hasGarden = true;
  if (payload.hasGarden === "no") patch.hasGarden = false;
  if (payload.condition !== "unknown") patch.condition = payload.condition;
  if (payload.resalePrice > 0) patch.resalePrice = String(Math.round(payload.resalePrice));
  if (payload.monthlyRent > 0) patch.monthlyRent = String(Math.round(payload.monthlyRent));
  if (payload.renovationLevel !== "unknown") patch.renovationLevel = payload.renovationLevel;
  if (payload.renovationCost > 0) patch.renovationCost = String(Math.round(payload.renovationCost));

  const noteBits = [payload.notes, payload.reasoningNotes, payload.rawText].filter(Boolean);
  if (noteBits.length > 0) patch.notes = noteBits.join("\n\n");
  return patch;
}

function getValidationReport(form: PropertyForm, settings: InvestorSettings): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const askingPrice = toNumber(form.askingPrice);
  const sqm = toNumber(form.sqm);
  const bedrooms = toNumber(form.bedrooms);
  const bathrooms = toNumber(form.bathrooms);
  const resalePrice = toNumber(form.resalePrice);
  const monthlyRent = toNumber(form.monthlyRent);
  const floor = form.floor.trim();
  const unexpectedPct = toNumber(form.unexpectedPct);
  const agencyFee = toNumber(form.agencyFee);
  const taxesAndNotary = toNumber(form.taxesAndNotary);
  const furnitureCost = toNumber(form.furnitureCost);
  const otherCosts = toNumber(form.otherCosts);
  const renovationCost = toNumber(form.renovationCost);
  const areaPricePerSqm = resolveNumericInput(form.areaAveragePricePerSqm, settings.defaultAreaPricePerSqm);
  const estimatedMarketValue = resolveNumericInput(form.estimatedMarketValue, sqm > 0 ? areaPricePerSqm * sqm : 0);
  const live = calculateAnalysis(form, settings);
  const fallbackGoalValues = estimateGoalFallbacks({
    askingPrice,
    sqm,
    areaPricePerSqm,
    estimatedMarketValue,
    totalInvestment: live.totalInvestment,
    settings,
  });

  if (!askingPrice) errors.push("Inserisci un prezzo richiesto valido.");
  else if (askingPrice < 10000 || askingPrice > 20000000) errors.push("Prezzo richiesto fuori range realistico.");

  if (!sqm) errors.push("Inserisci i metri quadri.");
  else if (sqm < 15 || sqm > 1000) errors.push("Metri quadri fuori range realistico (15-1000).");

  if (!form.province.trim()) warnings.push("Provincia mancante: utile per affinare il confronto locale.");
  if (!form.city.trim()) warnings.push("Citta' mancante: usero' benchmark fallback €/mq.");
  if (!form.propertyType.trim()) warnings.push("Tipologia non specificata: utile per confronto e archivio.");
  if (!bedrooms) warnings.push("Numero camere mancante: utile per confronto, rivendita e affitto.");
  if (!bathrooms) warnings.push("Numero bagni mancante: utile per confronto e qualita' della scheda.");

  if (floor && !/^-?\d{1,2}$/.test(floor)) {
    errors.push("Il piano deve essere numerico (es. 0, 1, 2, -1).");
  }

  if (form.renovationLevel === "personalizzato" && renovationCost <= 0) {
    errors.push("Con lavori personalizzati devi indicare un costo lavori.");
  }

  if (form.renovationLevel === "nessuno" && form.condition === "da_ristrutturare") {
    warnings.push("Condizione e livello lavori sono incoerenti: controlla i lavori.");
  }

  if (unexpectedPct < 0 || unexpectedPct > 40) {
    errors.push("Imprevisti fuori range: usa un valore tra 0 e 40.");
  }

  if (agencyFee < 0 || taxesAndNotary < 0 || furnitureCost < 0 || otherCosts < 0) {
    errors.push("Costi accessori negativi non ammessi.");
  }

  if (form.goal === "flip") {
    if (!resalePrice) {
      warnings.push(`Prezzo rivendita non inserito: uso stima automatica ${formatCurrency(fallbackGoalValues.suggestedResalePrice)}.`);
    }
    else if (resalePrice <= askingPrice) warnings.push("Il prezzo di rivendita non supera il prezzo richiesto.");
  } else {
    if (!monthlyRent) {
      warnings.push(`Canone non inserito: uso stima automatica ${formatCurrency(fallbackGoalValues.suggestedMonthlyRent)}/mese.`);
    }
    else if (monthlyRent < 200 || monthlyRent > 20000) {
      warnings.push("Canone mensile fuori range tipico: ricontrolla l'importo.");
    }
  }

  if (!form.title.trim()) warnings.push("Aggiungi un titolo: nell'archivio migliora molto la leggibilita'.");

  if (live.totalInvestment > settings.maxBudget) {
    warnings.push("L'investimento totale supera il budget massimo impostato.");
  }

  const sqmPrice = pricePerSqm(form);
  if (sqmPrice > 0 && (sqmPrice < 300 || sqmPrice > 25000)) {
    warnings.push("Prezzo al metro quadro fuori range tipico: verifica i dati inseriti.");
  }

  if (form.goal === "flip" && live.grossMarginPct < 0) {
    warnings.push("Con le ipotesi attuali il margine e' negativo.");
  }

  if (form.goal === "rent" && live.netYieldPct < 0) {
    warnings.push("Con le ipotesi attuali il rendimento netto e' negativo.");
  }

  return { errors, warnings };
}

function nextQuestion(form: PropertyForm, validation: ValidationReport): string {
  if (!form.province.trim()) return "In quale provincia si trova l'immobile?";
  if (!toNumber(form.askingPrice)) return "Qual e' il prezzo richiesto effettivo?";
  if (!toNumber(form.sqm)) return "Quanti metri quadri reali ha l'immobile?";
  if (!form.city.trim()) return "In quale citta' si trova l'immobile?";
  if (!form.propertyType.trim()) return "Che tipologia e'? Monolocale, bilocale, trilocale o altro?";
  if (!toNumber(form.bedrooms)) return "Quante camere ha davvero l'immobile?";
  if (!toNumber(form.bathrooms)) return "Quanti bagni sono presenti?";
  if (form.goal === "flip" && !toNumber(form.resalePrice)) return "Puoi inserire un prezzo rivendita manuale oppure usare la stima automatica.";
  if (form.goal === "rent" && !toNumber(form.monthlyRent)) return "Puoi inserire un canone manuale oppure usare la stima automatica.";
  if (form.renovationLevel === "personalizzato" && !toNumber(form.renovationCost)) {
    return "Qual e' il costo lavori personalizzato?";
  }
  if (validation.warnings.length > 0) return "I dati base ci sono: ora chiudi le incongruenze piu' importanti.";
  return "Dati coerenti: puoi calcolare e confrontare con l'archivio.";
}

function voiceGuideQuestion(stepId: VoiceGuideStepId, form: PropertyForm): string {
  switch (stepId) {
    case "province":
      return "In quale provincia si trova l'immobile?";
    case "city":
      return "In quale comune si trova l'immobile?";
    case "zone":
      return "Zona/quartiere facoltativa: se vuoi inserirla dimmela ora, altrimenti di' salta.";
    case "askingPrice":
      return "Qual e' il prezzo richiesto in euro?";
    case "sqm":
      return "Quanti metri quadri ha l'immobile?";
    case "goal":
      return "Vuoi simulare rivendita o affitto?";
    case "goalValue":
      return form.goal === "rent"
        ? "Quale canone mensile ipotizzi in euro?"
        : "Quale prezzo di rivendita ipotizzi in euro?";
    case "condition":
      return "Com'e' lo stato dell'immobile? Pronto, abitabile, da rinfrescare o da ristrutturare?";
    case "propertyType":
      return "Qual e' la tipologia? Es. bilocale, trilocale, loft.";
    case "bedrooms":
      return "Quante camere ha l'immobile?";
    case "bathrooms":
      return "Quanti bagni ha l'immobile?";
    case "floor":
      return "A che piano si trova? Usa numero oppure primo/secondo, 0 piano terra, -1 seminterrato.";
    case "hasElevator":
      return "C'e' ascensore? Rispondi si o no.";
    case "hasCellar":
      return "E' presente una cantina? Rispondi si o no.";
    case "hasGarage":
      return "E' presente un garage o box auto? Rispondi si o no.";
    case "hasGarden":
      return "E' presente un giardino? Rispondi si o no.";
    default:
      return "Inserisci il prossimo dato.";
  }
}

function parseBinaryPresenceAnswer(answer: string, positivePatterns: string[], negativePatterns: string[]): boolean | null {
  const normalizedSpeech = normalizeSpeechPhrase(answer);
  if (!normalizedSpeech) return null;

  for (const pattern of ["no", "assente", ...negativePatterns]) {
    if (normalizedSpeech === pattern || normalizedSpeech.startsWith(`${pattern} `) || normalizedSpeech.includes(pattern)) {
      return false;
    }
  }

  for (const pattern of ["si", "yes", "certo", "presente", ...positivePatterns]) {
    if (normalizedSpeech === pattern || normalizedSpeech.startsWith(`${pattern} `) || normalizedSpeech.includes(pattern)) {
      return true;
    }
  }

  return null;
}

function buildVoiceGuideAnswerPatch(form: PropertyForm, stepId: VoiceGuideStepId, answer: string): Partial<PropertyForm> {
  const normalized = normalizeText(answer);
  const normalizedSpeech = normalizeSpeechPhrase(answer);
  const numeric = Math.round(parseFlexibleNumber(answer));
  const patch: Partial<PropertyForm> = {};

  switch (stepId) {
    case "province": {
      const trimmed = answer.trim();
      if (trimmed) patch.province = /^[A-Za-z]{2}$/.test(trimmed) ? trimmed.toUpperCase() : titleCase(trimmed);
      break;
    }
    case "city": {
      const trimmed = answer.trim();
      if (trimmed) patch.city = titleCase(trimmed);
      break;
    }
    case "zone": {
      const trimmed = answer.trim();
      if (trimmed) patch.zone = titleCase(trimmed);
      break;
    }
    case "askingPrice":
      if (numeric > 0) patch.askingPrice = String(numeric);
      break;
    case "sqm":
      if (numeric > 0) patch.sqm = String(numeric);
      break;
    case "goal":
      if (
        normalizedSpeech.includes("affitto") ||
        normalizedSpeech.includes("locazione") ||
        normalizedSpeech.includes("reddito") ||
        normalizedSpeech.includes("canone")
      ) {
        patch.goal = "rent";
      } else if (
        normalizedSpeech.includes("rivendita") ||
        normalizedSpeech.includes("rivendere") ||
        normalizedSpeech.includes("flip")
      ) {
        patch.goal = "flip";
      }
      break;
    case "goalValue":
      if (numeric > 0) {
        if (form.goal === "rent") patch.monthlyRent = String(numeric);
        else patch.resalePrice = String(numeric);
      }
      break;
    case "condition":
      if (
        normalized.includes("da ristrutturare") ||
        normalizedSpeech.includes("ristrutturazione") ||
        normalizedSpeech.includes("ristrutturare") ||
        normalizedSpeech.includes("da rifare")
      ) {
        patch.condition = "da_ristrutturare";
      } else if (
        normalized.includes("da rinfrescare") ||
        normalizedSpeech.includes("rinfrescare") ||
        normalizedSpeech.includes("da sistemare") ||
        normalized.includes("da ammodernare")
      ) {
        patch.condition = "da_rinfrescare";
      } else if (
        normalizedSpeech.includes("pronto") ||
        normalized.includes("chiavi in mano") ||
        normalized.includes("ristrutturato")
      ) {
        patch.condition = "pronto";
      } else if (
        normalized.includes("abitabile") ||
        normalizedSpeech.includes("abitabile") ||
        normalizedSpeech.includes("buono stato") ||
        normalizedSpeech.includes("buone condizioni") ||
        normalizedSpeech.includes("discreto")
      ) {
        patch.condition = "abitabile";
      }

      if (patch.condition) {
        patch.renovationLevel = inferRenovationLevelFromCondition(patch.condition);
      }
      break;
    case "propertyType": {
      const propertyType = extractType(answer) || normalizeText(answer).slice(0, 32).trim();
      if (propertyType) patch.propertyType = propertyType;
      break;
    }
    case "bedrooms":
      if (numeric > 0) patch.bedrooms = String(numeric);
      else {
        const bedrooms = extractBedrooms(answer);
        if (bedrooms !== null) patch.bedrooms = String(Math.round(bedrooms));
      }
      break;
    case "bathrooms":
      if (numeric > 0) patch.bathrooms = String(numeric);
      else {
        const bathrooms = extractBathrooms(answer);
        if (bathrooms !== null) patch.bathrooms = String(Math.round(bathrooms));
      }
      break;
    case "floor": {
      const floor = extractFloor(answer);
      if (floor) patch.floor = floor;
      break;
    }
    case "hasElevator": {
      const hasElevator = parseBinaryPresenceAnswer(
        answer,
        ["con ascensore", "ascensore presente", "c e ascensore", "ce ascensore"],
        ["no ascensore", "senza ascensore", "ascensore assente", "non c e ascensore", "non ce ascensore"]
      );
      if (typeof hasElevator === "boolean") patch.hasElevator = hasElevator;
      break;
    }
    case "hasCellar": {
      const hasCellar = parseBinaryPresenceAnswer(answer, ["cantina", "con cantina"], ["senza cantina", "cantina assente"]);
      if (typeof hasCellar === "boolean") patch.hasCellar = hasCellar;
      break;
    }
    case "hasGarage": {
      const hasGarage = parseBinaryPresenceAnswer(
        answer,
        ["garage", "box auto", "autorimessa", "con garage", "con box"],
        ["senza garage", "senza box", "garage assente", "senza box auto"]
      );
      if (typeof hasGarage === "boolean") patch.hasGarage = hasGarage;
      break;
    }
    case "hasGarden": {
      const hasGarden = parseBinaryPresenceAnswer(answer, ["giardino", "con giardino"], ["senza giardino", "giardino assente"]);
      if (typeof hasGarden === "boolean") patch.hasGarden = hasGarden;
      break;
    }
    default:
      break;
  }

  return patch;
}

function isVoiceGuideAnswerResolved(stepId: VoiceGuideStepId, patch: Partial<PropertyForm>): boolean {
  switch (stepId) {
    case "province":
      return Boolean(patch.province?.trim());
    case "city":
      return Boolean(patch.city?.trim());
    case "zone":
      return Boolean(patch.zone?.trim());
    case "askingPrice":
      return Boolean(patch.askingPrice?.trim());
    case "sqm":
      return Boolean(patch.sqm?.trim());
    case "goal":
      return Boolean(patch.goal);
    case "goalValue":
      return Boolean(patch.monthlyRent?.trim() || patch.resalePrice?.trim());
    case "condition":
      return Boolean(patch.condition);
    case "propertyType":
      return Boolean(patch.propertyType?.trim());
    case "bedrooms":
      return Boolean(patch.bedrooms?.trim());
    case "bathrooms":
      return Boolean(patch.bathrooms?.trim());
    case "floor":
      return Boolean(patch.floor?.trim());
    case "hasElevator":
      return typeof patch.hasElevator === "boolean";
    case "hasCellar":
      return typeof patch.hasCellar === "boolean";
    case "hasGarage":
      return typeof patch.hasGarage === "boolean";
    case "hasGarden":
      return typeof patch.hasGarden === "boolean";
    default:
      return false;
  }
}

function voiceGuideRetryMessage(stepId: VoiceGuideStepId, form: PropertyForm): string {
  switch (stepId) {
    case "province":
      return "Non ho capito la provincia. Dimmi la sigla, come MI o RM, oppure il nome completo.";
    case "city":
      return "Non ho capito il comune. Ripeti solo il nome della citta'.";
    case "zone":
      return "Non ho capito la zona. Dimmi il quartiere oppure di' salta.";
    case "askingPrice":
      return "Non ho capito il prezzo richiesto. Dimmi solo il numero, per esempio 185000.";
    case "sqm":
      return "Non ho capito i metri quadri. Dimmi solo il numero, per esempio 78.";
    case "goal":
      return "Non ho capito la strategia. Rispondi rivendita oppure affitto.";
    case "goalValue":
      return form.goal === "rent"
        ? "Non ho capito il canone. Dimmi solo il numero mensile, per esempio 950."
        : "Non ho capito il prezzo di rivendita. Dimmi solo il numero, per esempio 245000.";
    case "condition":
      return "Non ho capito lo stato. Rispondi pronto, abitabile, da rinfrescare o da ristrutturare.";
    case "propertyType":
      return "Non ho capito la tipologia. Dimmi per esempio bilocale, trilocale, loft o villa.";
    case "bedrooms":
      return "Non ho capito il numero camere. Dimmi solo il numero, per esempio 2 o 3.";
    case "bathrooms":
      return "Non ho capito il numero bagni. Dimmi solo il numero, per esempio 1 o 2.";
    case "floor":
      return "Non ho capito il piano. Di' per esempio primo, secondo, piano terra oppure -1.";
    case "hasElevator":
      return "Non ho capito l'ascensore. Rispondi si ascensore oppure no ascensore.";
    case "hasCellar":
      return "Non ho capito la cantina. Rispondi si cantina oppure no cantina.";
    case "hasGarage":
      return "Non ho capito il garage. Rispondi si garage oppure no garage.";
    case "hasGarden":
      return "Non ho capito il giardino. Rispondi si giardino oppure no giardino.";
    default:
      return "Ripeti la risposta in modo piu' diretto.";
  }
}

function applyVoiceGuideAnswer(form: PropertyForm, stepId: VoiceGuideStepId, answer: string): PropertyForm {
  return mergeFormWithPatch(form, buildVoiceGuideAnswerPatch(form, stepId, answer));
}

function normalizeDraftPayload(raw: unknown): DraftPayload | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Partial<DraftPayload> & { form?: Partial<PropertyForm> };
  if (!record.form || typeof record.form !== "object") return null;

  const baseForm = emptyForm();
  const form: PropertyForm = {
    ...baseForm,
    ...record.form,
    id: String(record.form.id ?? baseForm.id),
  };

  const validSources: ExtractionMeta["source"][] = ["local_text", "local_image", "ai_text", "ai_image"];
  const extractionMeta =
    record.extractionMeta &&
    typeof record.extractionMeta === "object" &&
    validSources.includes((record.extractionMeta as ExtractionMeta).source)
      ? (record.extractionMeta as ExtractionMeta)
      : null;

  const verifiedMarketData =
    record.verifiedMarketData && typeof record.verifiedMarketData === "object"
      ? (record.verifiedMarketData as VerifiedMarketData)
      : null;

  return {
    form,
    aiText: typeof record.aiText === "string" ? record.aiText : "",
    extractionMeta,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
    verifiedMarketData,
  };
}

function floorLabelForDescription(floor: string): string {
  const cleaned = floor.trim();
  if (!cleaned) return "piano da specificare";
  if (cleaned === "0") return "piano terra";
  if (cleaned === "-1") return "seminterrato";
  return `${cleaned} piano`;
}

function descriptionMissingFields(form: PropertyForm): string[] {
  const missing: string[] = [];
  if (!form.province.trim()) missing.push("provincia");
  if (!form.city.trim()) missing.push("comune");
  if (!form.zone.trim()) missing.push("zona/quartiere");
  if (!form.propertyType.trim()) missing.push("tipologia immobile");
  if (!toNumber(form.sqm)) missing.push("metri quadri");
  if (!toNumber(form.bedrooms)) missing.push("camere");
  if (!toNumber(form.bathrooms)) missing.push("bagni");
  if (!form.floor.trim()) missing.push("piano");
  if (!toNumber(form.askingPrice)) missing.push("prezzo richiesto");
  if (form.goal === "flip" && !toNumber(form.resalePrice)) missing.push("prezzo rivendita stimato");
  if (form.goal === "rent" && !toNumber(form.monthlyRent)) missing.push("canone mensile stimato");
  return missing;
}

function buildGuidedDescriptionDraft(form: PropertyForm): string {
  const sqm = toNumber(form.sqm);
  const askingPrice = toNumber(form.askingPrice);
  const resalePrice = toNumber(form.resalePrice);
  const monthlyRent = toNumber(form.monthlyRent);
  const features = buildPropertyFeatureList(form);
  const location = [form.zone.trim(), form.city.trim(), form.province.trim()].filter(Boolean).join(", ");
  const propertyType = form.propertyType.trim() ? form.propertyType.trim() : "appartamento";
  const floor = floorLabelForDescription(form.floor);
  const condition = conditionLabel(form.condition).toLowerCase();
  const strategyText =
    form.goal === "flip"
      ? `operazione orientata alla rivendita, uscita stimata ${resalePrice > 0 ? formatCurrency(resalePrice) : "[da inserire]"}.`
      : `operazione orientata alla messa a reddito, canone stimato ${monthlyRent > 0 ? formatCurrency(monthlyRent) : "[da inserire]"}/mese.`;

  return [
    `${titleCase(propertyType)} ${location ? `in ${location}` : "in zona da specificare"} di ${sqm > 0 ? `${Math.round(sqm)} mq` : "[mq da inserire]"}${features.length > 0 ? `, ${features.join(", ")}` : ""}, ${floor}, ${form.hasElevator ? "con ascensore" : "senza ascensore"}, stato ${condition}.`,
    `Prezzo richiesto ${askingPrice > 0 ? formatCurrency(askingPrice) : "[da inserire]"}. ${strategyText}`,
    "Punti da valorizzare nella descrizione: distribuzione degli spazi, luminosita', servizi vicini, collegamenti e tempi di disponibilita'.",
  ].join("\n");
}

function buildDescriptionCoachReply(message: string, form: PropertyForm): string {
  const normalized = normalizeText(message);
  const missing = descriptionMissingFields(form);

  if (
    normalized.includes("bozza") ||
    normalized.includes("descrizione") ||
    normalized.includes("testo") ||
    normalized.includes("annuncio")
  ) {
    return `Bozza pronta:\n${buildGuidedDescriptionDraft(form)}`;
  }

  if (missing.length > 0) {
    return `Ricevuto. Per migliorare la descrizione inserisci: ${missing.slice(0, 3).join(", ")}. Scrivi "genera bozza" quando vuoi il testo pronto.`;
  }

  return "Hai gia' i dati principali. Scrivi \"genera bozza\" per ottenere subito una descrizione pronta da incollare.";
}

function buildAutoAccessoryAndMarketNotes(
  form: PropertyForm,
  support: AnalysisSupport,
  verifiedMarketData: VerifiedMarketData | null
): string {
  const lines = [
    `Stima media automatica costi accessori: agenzia ${formatCurrency(support.suggestedAgencyFee)}, imposte+notaio ${formatCurrency(support.suggestedTaxesAndNotary)}, imprevisti ${formatPercent(support.suggestedUnexpectedPct)}.`,
  ];
  if (verifiedMarketData?.areaSourceUrl) {
    lines.push(`Fonte prezzi locali: ${verifiedMarketData.areaSourceUrl} (${verifiedMarketData.areaUpdatedAt || "data non dichiarata"}).`);
  }
  if (verifiedMarketData?.ratesSourceUrl) {
    lines.push(`Fonte tassi mutuo: ${verifiedMarketData.ratesSourceUrl} (${verifiedMarketData.ratesUpdatedAt || "ultimo dato disponibile"}).`);
  }
  if (verifiedMarketData?.transferCostSourceUrl) {
    lines.push(`Fonte imposte/registrazione: ${verifiedMarketData.transferCostSourceUrl} (${verifiedMarketData.transferCostUpdatedAt || "ultimo dato disponibile"}).`);
  }
  return lines.join("\n");
}

function normalizeLoadedAnalysis(raw: unknown, settings: InvestorSettings): SavedAnalysis | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Partial<SavedAnalysis> & { form?: Partial<PropertyForm> };
  const baseForm = emptyForm();
  const form: PropertyForm = {
    ...baseForm,
    ...(item.form ?? {}),
    id: String(item.id ?? item.form?.id ?? baseForm.id),
  };

  const result = item.result ?? calculateAnalysis(form, settings);

  return {
    id: String(item.id ?? form.id),
    createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
    form,
    result,
  };
}

function normalizeDebugBootScreen(raw: unknown): Screen | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim();
  return ["home", "manualForm", "archive", "settings", "detail", "compare"].includes(normalized) ? (normalized as Screen) : null;
}

function extractOutputTextValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const nested = (value as { value?: unknown }).value;
  return typeof nested === "string" ? nested : "";
}

function extractResponsesOutputText(responsePayload: unknown): string {
  const payload = responsePayload as {
    output_text?: unknown;
    output?: Array<{
      type?: string;
      text?: unknown;
      content?: Array<{ type?: string; text?: unknown }>;
    }>;
  };

  const chunks: string[] = [];
  const pushChunk = (value: unknown) => {
    const text = extractOutputTextValue(value).trim();
    if (text) chunks.push(text);
  };

  if (Array.isArray(payload.output_text)) {
    payload.output_text.forEach((item) => pushChunk(item));
  } else {
    pushChunk(payload.output_text);
  }

  if (Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const chunk of item.content) {
          if (chunk.type === "output_text") {
            pushChunk(chunk.text);
          }
        }
        continue;
      }

      if (item.type === "output_text") {
        pushChunk(item.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function extractLikelyJsonText(text: string): string {
  const withoutFences = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutFences.slice(firstBrace, lastBrace + 1);
  }
  return withoutFences;
}

function tryParseAIJson(responsePayload: unknown): AIExtractionPayload {
  const text = extractResponsesOutputText(responsePayload);
  if (!text) {
    throw new Error("Risposta AI senza testo utilizzabile.");
  }

  const jsonText = extractLikelyJsonText(text);
  try {
    return JSON.parse(jsonText) as AIExtractionPayload;
  } catch {
    throw new Error("Formato JSON AI non valido.");
  }
}

async function requestAIExtraction(params: {
  aiSettings: AISettings;
  text?: string;
  image?: PickedImage | null;
}): Promise<AIExtractionPayload> {
  const content: Array<Record<string, string>> = [];

  if (params.text?.trim()) {
    content.push({
      type: "input_text",
      text: `Testo utente/annuncio:\n${params.text.trim()}`,
    });
  }

  if (params.image) {
    content.push({
      type: "input_text",
      text: "Estrai OCR e dati immobiliari dallo screenshot allegato.",
    });
    content.push({
      type: "input_image",
      image_url: `data:${params.image.mimeType};base64,${params.image.base64}`,
      detail: "high",
    });
  }

  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.aiSettings.apiKey}`,
    },
    body: JSON.stringify({
      model: params.aiSettings.model,
      instructions: AI_EXTRACTION_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content,
        },
      ],
    }),
  });

  const payload = (await response.json()) as { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message || "Errore nella chiamata AI.");
  }

  return tryParseAIJson(payload);
}

async function requestLocalImageOcrText(image: PickedImage): Promise<string> {
  const result = (await TextRecognition.recognize(image.uri)) as {
    text?: string;
    blocks?: Array<{
      text?: string;
      lines?: Array<{ text?: string }>;
    }>;
  };

  const directText = typeof result?.text === "string" ? result.text.trim() : "";
  if (directText) return directText;

  const fallback = Array.isArray(result?.blocks)
    ? result.blocks
        .map((block) => {
          if (typeof block?.text === "string" && block.text.trim()) return block.text.trim();
          if (!Array.isArray(block?.lines)) return "";
          return block.lines
            .map((line) => (typeof line?.text === "string" ? line.text.trim() : ""))
            .filter(Boolean)
            .join(" ");
        })
        .filter(Boolean)
        .join("\n")
        .trim()
    : "";

  if (!fallback) {
    throw new Error("OCR locale non ha trovato testo leggibile nello screenshot.");
  }

  return fallback;
}

const Pill = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => {
  const tx = useContext(TranslationContext);
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, selected && styles.pillSelected]}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{tx(label)}</Text>
    </TouchableOpacity>
  );
};

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = "#8a8174",
  keyboardType = "default",
  multiline = false,
  secureTextEntry = false,
  helperText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
  secureTextEntry?: boolean;
  helperText?: string;
}) => {
  const tx = useContext(TranslationContext);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{tx(label)}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textAreaInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ? tx(placeholder) : undefined}
        keyboardType={keyboardType}
        placeholderTextColor={placeholderTextColor}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        textAlignVertical={multiline ? "top" : "center"}
      />
      {helperText ? <Text style={styles.helperText}>{tx(helperText)}</Text> : null}
    </View>
  );
};

const Header = ({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) => {
  const tx = useContext(TranslationContext);
  return (
    <View style={styles.header}>
      <View style={styles.headerGlow} />
      <View style={styles.headerTopRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={17} color="#0f4c5c" />
            <Text style={styles.backText}>{tx("Indietro")}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerTopSpacer} />
        )}
        <View style={styles.headerBadge}>
          <View style={styles.headerBadgeDot} />
          <Text style={styles.headerBadgeText}>AFFARE SUBITO</Text>
        </View>
      </View>
      <View style={styles.headerTitleRow}>
        <View style={styles.headerAccentBar} />
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{tx(title)}</Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{tx(subtitle)}</Text> : null}
        </View>
      </View>
    </View>
  );
};

const MetricTile = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) => {
  const tx = useContext(TranslationContext);
  return (
    <View style={styles.metricTile}>
      <View style={[styles.metricTileCard, accent && styles.metricTileCardAccent]}>
        <Text style={[styles.metricLabel, accent && styles.metricLabelAccent]}>{tx(label)}</Text>
        <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>{value}</Text>
      </View>
    </View>
  );
};

const IssueCard = ({ report }: { report: ValidationReport }) => {
  const tx = useContext(TranslationContext);
  if (report.errors.length === 0 && report.warnings.length === 0) {
    return (
      <View style={[styles.card, styles.successCard]}>
        <Text style={styles.cardTitle}>{tx("Controlli")}</Text>
        <Text style={styles.cardText}>{tx("Nessun blocco: i dati sono coerenti per un primo calcolo.")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, report.errors.length > 0 ? styles.warningCard : styles.noticeCard]}>
      <Text style={styles.cardTitle}>{tx("Controlli live")}</Text>
      {report.errors.map((issue) => (
        <Text key={issue} style={styles.issueError}>
          • {tx(issue)}
        </Text>
      ))}
      {report.warnings.map((issue) => (
        <Text key={issue} style={styles.issueWarning}>
          • {tx(issue)}
        </Text>
      ))}
    </View>
  );
};

const BarRow = ({
  label,
  valueLabel,
  ratio,
  color,
}: {
  label: string;
  valueLabel: string;
  ratio: number;
  color: string;
}) => {
  const tx = useContext(TranslationContext);
  return (
    <View style={styles.barRow}>
      <View style={styles.barRowText}>
        <Text style={styles.barLabel}>{tx(label)}</Text>
        <Text style={styles.barValue}>{tx(valueLabel)}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(6, Math.min(100, ratio * 100))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

function FormSections({
  form,
  settings,
  support,
  updateField,
  verifiedMarketData,
  isMarketDataLoading,
  marketDataError,
  onRefreshMarketData,
  i18n,
}: {
  form: PropertyForm;
  settings: InvestorSettings;
  support: AnalysisSupport;
  updateField: <K extends keyof PropertyForm>(key: K, value: PropertyForm[K]) => void;
  verifiedMarketData: VerifiedMarketData | null;
  isMarketDataLoading: boolean;
  marketDataError: string;
  onRefreshMarketData: () => void;
  i18n: {
    updateLocalData: string;
    updatingLocalData: string;
    noVerifiedData: string;
  };
}) {
  const tx = useContext(TranslationContext);

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tx("Anagrafica immobile")}</Text>
        <Field label="Titolo immobile" value={form.title} onChangeText={(value) => updateField("title", value)} />
        <Field label="Provincia" value={form.province} onChangeText={(value) => updateField("province", value)} placeholder="MI o Milano" />
        <Field label="Citta'" value={form.city} onChangeText={(value) => updateField("city", value)} />
        <Field label="Paese" value={form.country} onChangeText={(value) => updateField("country", value)} placeholder="Italia, Germania, Francia..." />
        <Field label="Zona / quartiere" value={form.zone} onChangeText={(value) => updateField("zone", value)} />
        <Field
          label="Tipologia"
          value={form.propertyType}
          onChangeText={(value) => updateField("propertyType", value)}
          placeholder="bilocale, trilocale, loft..."
        />
        <Field label="Metri quadri" value={form.sqm} onChangeText={(value) => updateField("sqm", value)} keyboardType="numeric" />
        <Field label="Numero camere" value={form.bedrooms} onChangeText={(value) => updateField("bedrooms", value)} keyboardType="numeric" />
        <Field label="Numero bagni" value={form.bathrooms} onChangeText={(value) => updateField("bathrooms", value)} keyboardType="numeric" />
        <Field
          label="Piano"
          value={form.floor}
          onChangeText={(value) => updateField("floor", value)}
          keyboardType="numeric"
          helperText="Usa 0 per piano terra e -1 per seminterrato."
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>{tx("Ascensore")}</Text>
          <Switch value={form.hasElevator} onValueChange={(value) => updateField("hasElevator", value)} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>{tx("Cantina")}</Text>
          <Switch value={form.hasCellar} onValueChange={(value) => updateField("hasCellar", value)} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>{tx("Garage / box auto")}</Text>
          <Switch value={form.hasGarage} onValueChange={(value) => updateField("hasGarage", value)} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>{tx("Giardino")}</Text>
          <Switch value={form.hasGarden} onValueChange={(value) => updateField("hasGarden", value)} />
        </View>

        <Text style={styles.label}>{tx("Stato immobile")}</Text>
        <View style={styles.pillRow}>
          <Pill label="Pronto" selected={form.condition === "pronto"} onPress={() => updateField("condition", "pronto")} />
          <Pill label="Abitabile" selected={form.condition === "abitabile"} onPress={() => updateField("condition", "abitabile")} />
          <Pill
            label="Da rinfrescare"
            selected={form.condition === "da_rinfrescare"}
            onPress={() => updateField("condition", "da_rinfrescare")}
          />
          <Pill
            label="Da ristrutturare"
            selected={form.condition === "da_ristrutturare"}
            onPress={() => updateField("condition", "da_ristrutturare")}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tx("Scenario d'investimento")}</Text>
        <Field
          label="Prezzo richiesto (€)"
          value={form.askingPrice}
          onChangeText={(value) => updateField("askingPrice", value)}
          keyboardType="numeric"
        />

        <Text style={styles.label}>{tx("Obiettivo")}</Text>
        <View style={styles.pillRow}>
          <Pill label="Rivendita" selected={form.goal === "flip"} onPress={() => updateField("goal", "flip")} />
          <Pill label="Affitto" selected={form.goal === "rent"} onPress={() => updateField("goal", "rent")} />
        </View>

        {form.goal === "flip" ? (
          <Field
            label="Prezzo rivendita stimato (€)"
            value={form.resalePrice}
            onChangeText={(value) => updateField("resalePrice", value)}
            placeholder={formatNumericPlaceholder(support.suggestedResalePrice)}
            placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
            keyboardType="numeric"
            helperText={`Precompilato rapido: ${formatCurrency(support.suggestedResalePrice)} (modificabile)`}
          />
        ) : (
          <Field
            label="Canone mensile stimato (€)"
            value={form.monthlyRent}
            onChangeText={(value) => updateField("monthlyRent", value)}
            placeholder={formatNumericPlaceholder(support.suggestedMonthlyRent)}
            placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
            keyboardType="numeric"
            helperText={`Precompilato rapido: ${formatCurrency(support.suggestedMonthlyRent)}/mese (modificabile)`}
          />
        )}

        <Text style={styles.label}>{tx("Livello lavori")}</Text>
        <View style={styles.pillRow}>
          <Pill label="Nessuno" selected={form.renovationLevel === "nessuno"} onPress={() => updateField("renovationLevel", "nessuno")} />
          <Pill label="Leggero" selected={form.renovationLevel === "leggero"} onPress={() => updateField("renovationLevel", "leggero")} />
          <Pill label="Medio" selected={form.renovationLevel === "medio"} onPress={() => updateField("renovationLevel", "medio")} />
          <Pill label="Pesante" selected={form.renovationLevel === "pesante"} onPress={() => updateField("renovationLevel", "pesante")} />
          <Pill
            label="Personalizzato"
            selected={form.renovationLevel === "personalizzato"}
            onPress={() => updateField("renovationLevel", "personalizzato")}
          />
        </View>
        <Text style={styles.cardMuted}>{tx(`Stima lavori guidata: ${formatCurrency(support.suggestedRenovationCost)}`)}</Text>
        {support.suggestedRenovationCost <= 0 ? (
          <Text style={styles.cardMuted}>
            {tx("Nessuna fonte verificata per costi ristrutturazione locali: inserisci un costo personalizzato o valori €/mq nelle impostazioni.")}
          </Text>
        ) : null}

        {form.renovationLevel === "personalizzato" ? (
          <Field
            label="Costo lavori personalizzato (€)"
            value={form.renovationCost}
            onChangeText={(value) => updateField("renovationCost", value)}
            placeholder={formatNumericPlaceholder(support.suggestedRenovationCost)}
            placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
            keyboardType="numeric"
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tx("Benchmark area e mutuo")}</Text>
        <TouchableOpacity style={[styles.secondaryButton, isMarketDataLoading && styles.buttonDisabled]} onPress={onRefreshMarketData} disabled={isMarketDataLoading}>
          <Text style={styles.secondaryButtonText}>{isMarketDataLoading ? i18n.updatingLocalData : i18n.updateLocalData}</Text>
        </TouchableOpacity>
        {verifiedMarketData ? (
          <Text style={styles.cardMuted}>
            {tx("Fonte locale")}: {verifiedMarketData.canonicalCity}, {verifiedMarketData.countryName} • {tx("Prezzi")} {verifiedMarketData.areaUpdatedAt || tx("data n/d")} • {tx("Tassi")} {verifiedMarketData.ratesUpdatedAt || tx("ultimo disponibile")}
            {verifiedMarketData.transferCostUpdatedAt ? ` • ${tx("Imposte")} ${verifiedMarketData.transferCostUpdatedAt}` : ""}
          </Text>
        ) : (
          <Text style={styles.cardMuted}>{i18n.noVerifiedData}</Text>
        )}
        {marketDataError ? <Text style={styles.issueWarning}>• {tx(marketDataError)}</Text> : null}
        <Field
          label="Prezzo medio zona (€/mq)"
          value={form.areaAveragePricePerSqm}
          onChangeText={(value) => updateField("areaAveragePricePerSqm", value)}
          placeholder={formatNumericPlaceholder(support.suggestedAreaPricePerSqm)}
          placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
          keyboardType="numeric"
          helperText={
            support.suggestedAreaPricePerSqm > 0
              ? `Precompilato: ${formatCurrency(support.suggestedAreaPricePerSqm)}/mq • ${tx(support.areaBenchmarkLabel)}`
              : "Nessun prezzo locale verificato disponibile: inserisci un benchmark manuale."
          }
        />
        <Field
          label="Valore medio stimato immobile (€)"
          value={form.estimatedMarketValue}
          onChangeText={(value) => updateField("estimatedMarketValue", value)}
          placeholder={formatNumericPlaceholder(support.suggestedEstimatedMarketValue)}
          placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
          keyboardType="numeric"
          helperText={
            support.suggestedEstimatedMarketValue > 0
              ? `Precompilato: ${formatCurrency(support.suggestedEstimatedMarketValue)}`
              : "Inserisci mq e benchmark area per ottenere una stima guidata."
          }
        />
        <Text style={styles.cardMuted}>
          {tx("Delta rispetto al richiesto")}: {support.effectiveEstimatedMarketValue > 0 ? formatPercent(support.priceGapPct) : "-"}
        </Text>
        <Field
          label="Anticipo mutuo (%)"
          value={form.mortgageDownPaymentPct}
          onChangeText={(value) => updateField("mortgageDownPaymentPct", value)}
          placeholder={formatNumericPlaceholder(support.effectiveDownPaymentPct, 1)}
          placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
          keyboardType="numeric"
          helperText={`Precompilato mercato: ${formatPercent(settings.defaultDownPaymentPct)} • Anticipo stimato ${formatCurrency(support.downPaymentAmount)}`}
        />
        <Field
          label="Durata mutuo (anni)"
          value={form.mortgageYears}
          onChangeText={(value) => updateField("mortgageYears", value)}
          placeholder={formatNumericPlaceholder(support.effectiveMortgageYears)}
          placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
          keyboardType="numeric"
          helperText={`Precompilato mercato: ${settings.defaultMortgageYears} anni`}
        />
        <Field
          label="Tasso fisso (%)"
          value={form.fixedMortgageRate}
          onChangeText={(value) => updateField("fixedMortgageRate", value)}
          placeholder={formatNumericPlaceholder(support.effectiveFixedRate, 2)}
          placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
          keyboardType="numeric"
          helperText={
            support.effectiveFixedRate > 0
              ? `Precompilato da fonte verificata: ${formatPercent(support.effectiveFixedRate)}`
              : "Nessun tasso fisso verificato disponibile: inserisci un valore."
          }
        />
        <Field
          label="Tasso variabile (%)"
          value={form.variableMortgageRate}
          onChangeText={(value) => updateField("variableMortgageRate", value)}
          placeholder={formatNumericPlaceholder(support.effectiveVariableRate, 2)}
          placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
          keyboardType="numeric"
          helperText={
            support.effectiveVariableRate > 0
              ? `Precompilato da fonte verificata: ${formatPercent(support.effectiveVariableRate)}`
              : "Nessun tasso variabile verificato disponibile: inserisci un valore."
          }
        />
        <Text style={styles.cardText}>{tx("Capitale stimato finanziato")}: {formatCurrency(support.mortgagePrincipal)}</Text>
        <Text style={styles.cardText}>{tx("Rata fisso stimata")}: {formatCurrency(support.fixedMonthlyPayment)}/mese</Text>
        <Text style={styles.cardText}>{tx("Rata variabile stimata")}: {formatCurrency(support.variableMonthlyPayment)}/mese</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tx("Costi accessori e note")}</Text>
        <Field
          label="Imprevisti (%)"
          value={form.unexpectedPct}
          onChangeText={(value) => updateField("unexpectedPct", value)}
          placeholder={formatNumericPlaceholder(support.suggestedUnexpectedPct)}
          placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
          keyboardType="numeric"
          helperText={`Stima media: ${formatPercent(support.suggestedUnexpectedPct)} (${formatCurrency(support.suggestedUnexpectedValue)})`}
        />
        <Field
          label="Imposte e notaio (€)"
          value={form.taxesAndNotary}
          onChangeText={(value) => updateField("taxesAndNotary", value)}
          placeholder={formatNumericPlaceholder(support.suggestedTaxesAndNotary)}
          placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
          keyboardType="numeric"
          helperText={`Stima media: ${formatCurrency(support.suggestedTaxesAndNotary)}`}
        />
        <Field
          label="Commissione agenzia (€)"
          value={form.agencyFee}
          onChangeText={(value) => updateField("agencyFee", value)}
          placeholder={formatNumericPlaceholder(support.suggestedAgencyFee)}
          placeholderTextColor={PREFILL_PLACEHOLDER_COLOR}
          keyboardType="numeric"
          helperText={`Stima media: ${formatCurrency(support.suggestedAgencyFee)} (${formatPercent(settings.defaultAgencyPct)})`}
        />
        <Field label="Arredo (€)" value={form.furnitureCost} onChangeText={(value) => updateField("furnitureCost", value)} keyboardType="numeric" />
        <Field label="Altri costi (€)" value={form.otherCosts} onChangeText={(value) => updateField("otherCosts", value)} keyboardType="numeric" />
        <Text style={styles.cardMuted}>{tx(`Pacchetto costi medi guidati: ${formatCurrency(support.suggestedAccessoryCosts)}`)}</Text>
        <Field
          label="Note"
          value={form.notes}
          onChangeText={(value) => updateField("notes", value)}
          multiline
          placeholder="Appunti, ipotesi, criticita', timing..."
        />
      </View>
    </>
  );
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const [language, setLanguage] = useState<AppLanguage>(detectDefaultLanguage());
  const [history, setHistory] = useState<Screen[]>(["home"]);
  const [activeAcquisitionMode, setActiveAcquisitionMode] = useState<AcquisitionMode>("voice-guide");
  const [form, setForm] = useState<PropertyForm>(emptyForm());
  const [settings, setSettings] = useState<InvestorSettings>(defaultSettings);
  const [aiSettings, setAISettings] = useState<AISettings>(defaultAISettings);
  const [billingSettings, setBillingSettings] = useState<BillingSettings>(defaultBillingSettings);
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);
  const [aiText, setAiText] = useState("");
  const [descriptionCoachInput, setDescriptionCoachInput] = useState("");
  const [descriptionCoachMessages, setDescriptionCoachMessages] = useState<CoachMessage[]>([
    { id: "coach-welcome", role: "assistant", text: DESCRIPTION_COACH_WELCOME },
  ]);
  const [voiceGuideActive, setVoiceGuideActive] = useState(false);
  const [voiceGuideStepIndex, setVoiceGuideStepIndex] = useState(0);
  const [voiceGuideInput, setVoiceGuideInput] = useState("");
  const [voiceGuideMessages, setVoiceGuideMessages] = useState<CoachMessage[]>([]);
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState("");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoMarketRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoMarketLookupKeyRef = useRef("");
  const [isDataHydrated, setIsDataHydrated] = useState(false);
  const [verifiedMarketData, setVerifiedMarketData] = useState<VerifiedMarketData | null>(null);
  const [isMarketDataLoading, setIsMarketDataLoading] = useState(false);
  const [marketDataError, setMarketDataError] = useState("");
  const [budgetSliderDraft, setBudgetSliderDraft] = useState(defaultSettings.maxBudget);
  const [selectedImage, setSelectedImage] = useState<PickedImage | null>(null);
  const [extractionMeta, setExtractionMeta] = useState<ExtractionMeta | null>(null);
  const [isAiBusy, setIsAiBusy] = useState(false);
  const [isDebugOcrRegressionRunning, setIsDebugOcrRegressionRunning] = useState(false);
  const [debugOcrRegressionLines, setDebugOcrRegressionLines] = useState<string[]>([]);
  const [debugOcrImageRegressionLines, setDebugOcrImageRegressionLines] = useState<string[]>([]);
  const [compareIncludeCurrent, setCompareIncludeCurrent] = useState(false);
  const [isSpeechListening, setIsSpeechListening] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [freeListingMode, setFreeListingMode] = useState(false);
  const [freeListingDraft, setFreeListingDraft] = useState("");
  const [speechError, setSpeechError] = useState("");
  const voiceGuideActiveRef = useRef(false);
  const voiceSubmitLockRef = useRef(false);
  const freeListingModeRef = useRef(false);
  const freeListingDraftRef = useRef("");
  const freeListingCommittedRef = useRef("");
  const freeListingInterimRef = useRef("");

  const screen = history[history.length - 1] || "home";
  const activeTab = getMainTab(screen);
  const showTabBar = screen === "home" || screen === "archive" || screen === "settings";
  const showFloatingMic =
    screen === "manualForm" &&
    ((activeAcquisitionMode === "voice-guide" && (voiceGuideActive || isSpeechListening || isAssistantSpeaking)) ||
      (activeAcquisitionMode === "free-dictation" && (freeListingMode || isSpeechListening)));
  const isExtractionBusy = isAiBusy;
  const isProUnlocked = billingSettings.isProUnlocked;
  const savedCount = analyses.length;
  const freeRemainingSlots = Math.max(0, FREE_PLAN_MAX_ANALYSES - savedCount);
  const canSaveMoreInFree = savedCount < FREE_PLAN_MAX_ANALYSES;
  const t = (key: string, params?: Record<string, string | number>) => {
    const template = UI_TEXT[language]?.[key] ?? UI_TEXT.en[key] ?? UI_TEXT.it[key] ?? key;
    return formatUiText(template, params);
  };
  const tx = (text: string) => translateInlineText(language, text);
  const speechLocale = useMemo(() => {
    if (language === "en") return "en-US";
    if (language === "de") return "de-DE";
    if (language === "fr") return "fr-FR";
    if (language === "es") return "es-ES";
    return "it-IT";
  }, [language]);
  const scrollBottomInset = 28 + Math.max(insets.bottom, 14) + (showTabBar ? 152 : 0) + (showFloatingMic ? 74 : 0);
  const screenContentStyle = useMemo(() => [styles.screenContent, { paddingBottom: scrollBottomInset }], [scrollBottomInset]);
  const listContentStyle = useMemo(() => [styles.listContent, { paddingBottom: scrollBottomInset }], [scrollBottomInset]);
  const tabBarStyle = useMemo(() => [styles.tabBar, { bottom: 12 + insets.bottom }], [insets.bottom]);
  const floatingMicStyle = useMemo(
    () => [styles.floatingMicButton, { bottom: (showTabBar ? 96 : 22) + insets.bottom }],
    [insets.bottom, showTabBar]
  );

  function mapSpeechErrorMessage(errorCode: string, fallbackMessage: string): string {
    if (errorCode === "no-speech" || errorCode === "speech-timeout") {
      return "Non ho rilevato voce. Prova a parlare piu' vicino al microfono.";
    }
    if (errorCode === "network") {
      return "Connessione assente o instabile. Controlla rete e riprova.";
    }
    if (errorCode === "language-not-supported") {
      return "Lingua non supportata dal riconoscimento vocale del dispositivo.";
    }
    if (errorCode === "service-not-allowed") {
      return "Servizio vocale non disponibile sul telefono. Verifica App Google e motore vocale predefinito.";
    }
    if (errorCode === "not-allowed") {
      return "Permesso microfono negato.";
    }
    const trimmed = fallbackMessage.trim();
    return trimmed ? `${errorCode}: ${trimmed}` : errorCode;
  }

  function isSkipCommand(answer: string): boolean {
    const normalized = normalizeText(answer);
    return normalized === "salta" || normalized === "skip" || normalized === "passa";
  }

  useSpeechRecognitionEvent("start", () => {
    setIsAssistantSpeaking(false);
    setIsSpeechListening(true);
    setSpeechError("");
  });

  useSpeechRecognitionEvent("end", () => {
    setIsSpeechListening(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const results = event.results ?? [];
    const primary = results[0];
    const transcript = (primary?.transcript || "").trim();
    if (!transcript) return;
    const confidence = typeof primary?.confidence === "number" && Number.isFinite(primary.confidence) ? primary.confidence : -1;
    const likelyNoise = isLikelyNoiseTranscript(transcript, confidence);

    if (likelyNoise && !event.isFinal) {
      return;
    }
    if (likelyNoise && event.isFinal) {
      if (event.isFinal && voiceGuideActiveRef.current && !voiceSubmitLockRef.current) {
        setTimeout(() => {
          if (!voiceGuideActiveRef.current || voiceSubmitLockRef.current || isAssistantSpeaking) return;
          void startSpeechRecognition();
        }, 220);
      }
      return;
    }

    if (freeListingModeRef.current) {
      if (event.isFinal) {
        const committed = appendTranscript(freeListingCommittedRef.current, transcript);
        freeListingCommittedRef.current = committed;
        freeListingInterimRef.current = "";
        setFreeListingDraft(committed);
      } else {
        freeListingInterimRef.current = transcript;
        const preview = appendTranscript(freeListingCommittedRef.current, transcript);
        setFreeListingDraft(preview);
      }
      return;
    }

    if (!voiceGuideActiveRef.current) return;
    setVoiceGuideInput(transcript);
    if (event.isFinal && !voiceSubmitLockRef.current) {
      void handleVoiceGuideSubmit(transcript, "voice");
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setIsSpeechListening(false);
    if (event.error === "aborted") return;
    const message = mapSpeechErrorMessage(event.error, event.message);
    setSpeechError(message);
    if ((event.error === "no-speech" || event.error === "speech-timeout") && (voiceGuideActiveRef.current || freeListingModeRef.current)) {
      setTimeout(() => {
        if ((!voiceGuideActiveRef.current && !freeListingModeRef.current) || voiceSubmitLockRef.current || isAssistantSpeaking) return;
        if (freeListingModeRef.current) {
          void startSpeechRecognition({ continuous: true, interimResults: true });
          return;
        }
        void startSpeechRecognition();
      }, 450);
    }
  });

  useEffect(() => {
    voiceGuideActiveRef.current = voiceGuideActive;
  }, [voiceGuideActive]);

  useEffect(() => {
    freeListingModeRef.current = freeListingMode;
  }, [freeListingMode]);

  useEffect(() => {
    freeListingDraftRef.current = freeListingDraft;
  }, [freeListingDraft]);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const maybeUnlockFromUrl = (rawUrl: string | null) => {
      if (!rawUrl || !isStripeSuccessUrl(rawUrl)) return;
      if (billingSettings.isProUnlocked) return;
      setBillingSettings((current) => {
        if (current.isProUnlocked) return current;
        const next = { ...current, isProUnlocked: true };
        void AsyncStorage.setItem(STORAGE_KEYS.billing, JSON.stringify(next));
        return next;
      });
      Alert.alert("Pro sbloccato", "Pagamento Stripe confermato. Ora puoi salvare immobili illimitati.");
    };

    const subscription = Linking.addEventListener("url", (event) => maybeUnlockFromUrl(event.url));
    void Linking.getInitialURL().then(maybeUnlockFromUrl).catch(() => undefined);
    return () => {
      subscription.remove();
    };
  }, [billingSettings.isProUnlocked]);

  useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // no-op
      }
      void Speech.stop();
    };
  }, []);

  useEffect(() => {
    setBudgetSliderDraft(settings.maxBudget > 0 ? settings.maxBudget : defaultSettings.maxBudget);
  }, [settings.maxBudget]);

  useEffect(() => {
    if (!isDataHydrated) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      const payload: DraftPayload = {
        form,
        aiText,
        extractionMeta,
        updatedAt: new Date().toISOString(),
        verifiedMarketData,
      };

      void AsyncStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(payload))
        .then(() => setLastAutoSaveAt(payload.updatedAt))
        .catch((error) => console.log("Errore autosave bozza", error));
    }, 500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [form, aiText, extractionMeta, verifiedMarketData, isDataHydrated]);

  const liveResult = useMemo(() => calculateAnalysis(form, settings), [form, settings]);
  const analysisSupport = useMemo(
    () => buildAnalysisSupport(form, settings, analyses, verifiedMarketData),
    [form, settings, analyses, verifiedMarketData]
  );
  const validation = useMemo(() => getValidationReport(form, settings), [form, settings]);
  const stats = useMemo(() => {
    const green = analyses.filter((item) => item.result.color === "verde").length;
    const yellow = analyses.filter((item) => item.result.color === "giallo").length;
    const red = analyses.filter((item) => item.result.color === "rosso").length;
    return { green, yellow, red };
  }, [analyses]);
  const sortedAnalyses = useMemo(() => [...analyses].sort((a, b) => b.result.score - a.result.score), [analyses]);
  const archiveAnalyses = useMemo(
    () =>
      [...analyses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [analyses]
  );
  const bestAnalysis = sortedAnalyses[0] || null;
  const compareCandidateSet = useMemo(() => {
    const base = [...sortedAnalyses];
    if (compareIncludeCurrent && result) {
      const hasCurrentSavedVersion = base.some((item) => item.form.id === form.id);
      if (!hasCurrentSavedVersion) {
        base.push({
          id: `draft-${form.id}`,
          createdAt: new Date().toISOString(),
          form,
          result,
        });
      }
    }
    return base.sort((a, b) => b.result.score - a.result.score);
  }, [compareIncludeCurrent, form, result, sortedAnalyses]);
  const compareLimit = isProUnlocked ? 5 : 2;
  const compareSet = useMemo(() => compareCandidateSet.slice(0, compareLimit), [compareCandidateSet, compareLimit]);
  const hiddenCompareCount = Math.max(0, compareCandidateSet.length - compareSet.length);

  useEffect(() => {
    if (!isDataHydrated) return;
    setForm((current) => {
      const patch: Partial<PropertyForm> = {};
      const askingPrice = toNumber(current.askingPrice);
      const sqm = toNumber(current.sqm);
      if (!current.title.trim()) {
        patch.title = buildAutoPropertyTitle(analyses, current.id);
      }
      if (!current.unexpectedPct.trim() && analysisSupport.suggestedUnexpectedPct > 0) {
        patch.unexpectedPct = String(Math.round(analysisSupport.suggestedUnexpectedPct * 10) / 10);
      }
      if (!current.agencyFee.trim() && analysisSupport.suggestedAgencyFee > 0) {
        patch.agencyFee = String(Math.round(analysisSupport.suggestedAgencyFee));
      }
      if (!current.taxesAndNotary.trim() && analysisSupport.suggestedTaxesAndNotary > 0) {
        patch.taxesAndNotary = String(Math.round(analysisSupport.suggestedTaxesAndNotary));
      }
      if (!current.furnitureCost.trim() && sqm > 0) {
        const suggestedFurniture = Math.round(sqm * (current.goal === "rent" ? 120 : 45));
        if (suggestedFurniture > 0) patch.furnitureCost = String(suggestedFurniture);
      }
      if (!current.otherCosts.trim() && askingPrice > 0) {
        const suggestedOther = Math.round(askingPrice * 0.004);
        if (suggestedOther > 0) patch.otherCosts = String(suggestedOther);
      }
      if (!current.mortgageDownPaymentPct.trim() && settings.defaultDownPaymentPct > 0) {
        patch.mortgageDownPaymentPct = String(Math.round(settings.defaultDownPaymentPct * 10) / 10);
      }
      if (!current.mortgageYears.trim() && settings.defaultMortgageYears > 0) {
        patch.mortgageYears = String(Math.round(settings.defaultMortgageYears));
      }
      if (!current.fixedMortgageRate.trim() && analysisSupport.effectiveFixedRate > 0) {
        patch.fixedMortgageRate = analysisSupport.effectiveFixedRate.toFixed(2);
      }
      if (!current.variableMortgageRate.trim() && analysisSupport.effectiveVariableRate > 0) {
        patch.variableMortgageRate = analysisSupport.effectiveVariableRate.toFixed(2);
      }
      if (current.goal === "flip" && !current.resalePrice.trim() && analysisSupport.suggestedResalePrice > 0) {
        patch.resalePrice = String(Math.round(analysisSupport.suggestedResalePrice));
      }
      if (current.goal === "rent" && !current.monthlyRent.trim() && analysisSupport.suggestedMonthlyRent > 0) {
        patch.monthlyRent = String(Math.round(analysisSupport.suggestedMonthlyRent));
      }
      if (!current.notes.trim() && (toNumber(current.askingPrice) > 0 || toNumber(current.sqm) > 0)) {
        patch.notes = buildAutoAccessoryAndMarketNotes(current, analysisSupport, verifiedMarketData);
      }
      if (Object.keys(patch).length === 0) return current;
      return { ...current, ...patch };
    });
  }, [
    analyses,
    analysisSupport.suggestedUnexpectedPct,
    analysisSupport.suggestedAgencyFee,
    analysisSupport.suggestedTaxesAndNotary,
    analysisSupport.effectiveFixedRate,
    analysisSupport.effectiveVariableRate,
    settings.defaultDownPaymentPct,
    settings.defaultMortgageYears,
    verifiedMarketData,
    isDataHydrated,
  ]);

  useEffect(() => {
    if (!isDataHydrated) return;

    if (autoMarketRefreshTimerRef.current) {
      clearTimeout(autoMarketRefreshTimerRef.current);
    }

    const lookupKey = buildMarketLookupKey(form);
    if (!form.city.trim()) {
      lastAutoMarketLookupKeyRef.current = "";
      return;
    }
    if (lookupKey === lastAutoMarketLookupKeyRef.current) {
      return;
    }

    autoMarketRefreshTimerRef.current = setTimeout(() => {
      lastAutoMarketLookupKeyRef.current = lookupKey;
      void handleRefreshVerifiedMarketData({ silent: true });
    }, 900);

    return () => {
      if (autoMarketRefreshTimerRef.current) {
        clearTimeout(autoMarketRefreshTimerRef.current);
      }
    };
  }, [form.city, form.country, form.zone, form.province, isDataHydrated]);

  async function loadData() {
    try {
      const settingsRaw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
      const aiSettingsRaw = await AsyncStorage.getItem(STORAGE_KEYS.aiSettings);
      const billingRaw = await AsyncStorage.getItem(STORAGE_KEYS.billing);
      const analysesRaw = await AsyncStorage.getItem(STORAGE_KEYS.analyses);
      const draftRaw = await AsyncStorage.getItem(STORAGE_KEYS.draft);
      const languageRaw = await AsyncStorage.getItem(STORAGE_KEYS.language);
      const debugBootScreenRaw = await AsyncStorage.getItem(STORAGE_KEYS.debugBootScreen);

      const nextSettings = settingsRaw ? { ...defaultSettings, ...JSON.parse(settingsRaw) } : defaultSettings;
      const nextAISettings = aiSettingsRaw ? { ...defaultAISettings, ...JSON.parse(aiSettingsRaw) } : defaultAISettings;
      const nextBillingSettings = billingRaw ? { ...defaultBillingSettings, ...JSON.parse(billingRaw) } : defaultBillingSettings;
      const nextAnalyses = analysesRaw
        ? (JSON.parse(analysesRaw) as unknown[])
            .map((item) => normalizeLoadedAnalysis(item, nextSettings))
            .filter((item): item is SavedAnalysis => Boolean(item))
        : [];
      const parsedDraft = draftRaw ? normalizeDraftPayload(JSON.parse(draftRaw)) : null;
      const nextLanguage =
        languageRaw && SUPPORTED_LANGUAGES.includes(languageRaw as AppLanguage)
          ? (languageRaw as AppLanguage)
          : detectDefaultLanguage();
      const debugBootScreen = normalizeDebugBootScreen(debugBootScreenRaw);

      setSettings(nextSettings);
      setAISettings(nextAISettings);
      setBillingSettings(nextBillingSettings);
      setAnalyses(nextAnalyses);
      setLanguage(nextLanguage);
      setSelectedAnalysis(null);
      if (parsedDraft) {
        setForm(parsedDraft.form);
        setAiText(parsedDraft.aiText);
        setExtractionMeta(parsedDraft.extractionMeta);
        setLastAutoSaveAt(parsedDraft.updatedAt);
        setVerifiedMarketData(parsedDraft.verifiedMarketData ?? null);
      }

      if (debugBootScreen === "detail") {
        const firstAnalysis = nextAnalyses[0] || null;
        setSelectedAnalysis(firstAnalysis);
        setHistory(firstAnalysis ? ["archive", "detail"] : ["archive"]);
      } else if (debugBootScreen) {
        setHistory([debugBootScreen]);
      } else if (parsedDraft) {
        setHistory(["manualForm"]);
      }
    } catch (error) {
      console.log("Errore caricamento dati", error);
    } finally {
      setIsDataHydrated(true);
    }
  }

  async function persistAnalyses(nextAnalyses: SavedAnalysis[]) {
    setAnalyses(nextAnalyses);
    await AsyncStorage.setItem(STORAGE_KEYS.analyses, JSON.stringify(nextAnalyses));
  }

  async function persistSettings(nextSettings: InvestorSettings) {
    setSettings(nextSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(nextSettings));
  }

  async function persistAISettings(nextAISettings: AISettings) {
    setAISettings(nextAISettings);
    await AsyncStorage.setItem(STORAGE_KEYS.aiSettings, JSON.stringify(nextAISettings));
  }

  async function persistBillingSettings(nextBillingSettings: BillingSettings) {
    setBillingSettings(nextBillingSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.billing, JSON.stringify(nextBillingSettings));
  }

  async function persistLanguage(nextLanguage: AppLanguage) {
    setLanguage(nextLanguage);
    await AsyncStorage.setItem(STORAGE_KEYS.language, nextLanguage);
  }

  function updateField<K extends keyof PropertyForm>(key: K, value: PropertyForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "province" || key === "city" || key === "country" || key === "zone") {
      setVerifiedMarketData(null);
      setMarketDataError("");
      lastAutoMarketLookupKeyRef.current = "";
    }
  }

  function pushScreen(nextScreen: Screen) {
    setHistory((current) => (current[current.length - 1] === nextScreen ? current : [...current, nextScreen]));
  }

  function resetDraft(baseAnalyses: SavedAnalysis[] = analyses) {
    stopSpeechRecognition();
    void stopAssistantSpeech();
    const nextForm = emptyForm();
    nextForm.title = buildAutoPropertyTitle(baseAnalyses);
    setForm(nextForm);
    setResult(null);
    setAiText("");
    setDescriptionCoachInput("");
    setDescriptionCoachMessages([{ id: `coach-${Date.now()}`, role: "assistant", text: DESCRIPTION_COACH_WELCOME }]);
    setSelectedImage(null);
    setSelectedAnalysis(null);
    setExtractionMeta(null);
    setVoiceGuideActive(false);
    setVoiceGuideStepIndex(0);
    setVoiceGuideInput("");
    setVoiceGuideMessages([]);
    setFreeListingMode(false);
    setFreeListingDraft("");
    setSpeechError("");
    setVerifiedMarketData(null);
    setMarketDataError("");
    setActiveAcquisitionMode("voice-guide");
    setCompareIncludeCurrent(false);
    lastAutoMarketLookupKeyRef.current = "";
    voiceGuideActiveRef.current = false;
    voiceSubmitLockRef.current = false;
    freeListingModeRef.current = false;
    freeListingDraftRef.current = "";
    freeListingCommittedRef.current = "";
    freeListingInterimRef.current = "";
  }

  function handleClearCurrentPropertyData() {
    Alert.alert(
      tx("Pulisci dati immobile"),
      tx("Azzero la scheda corrente, il testo annuncio, lo screenshot e le dettature in corso. Vuoi continuare?"),
      [
        { text: tx("Annulla"), style: "cancel" },
        {
          text: tx("Pulisci dati immobile"),
          style: "destructive",
          onPress: () => resetDraft(),
        },
      ]
    );
  }

  function openTab(tab: MainTab) {
    if (tab === "home") {
      setHistory(["home"]);
      return;
    }
    if (tab === "analyze") {
      setActiveAcquisitionMode("voice-guide");
      setHistory(["manualForm"]);
      return;
    }
    if (tab === "archive") {
      setHistory(["archive"]);
      return;
    }
    setHistory(["settings"]);
  }

  function goBack() {
    setHistory((current) => {
      if (current.length <= 1) return ["home"];
      return current.slice(0, -1);
    });
  }

  function startManualAnalysis() {
    resetDraft();
    setActiveAcquisitionMode("voice-guide");
    setHistory(["manualForm"]);
  }

  function startAIAnalysis() {
    resetDraft();
    setActiveAcquisitionMode("paste-text");
    setHistory(["aiInput"]);
  }

  function switchAcquisitionMode(mode: AcquisitionMode) {
    if (mode !== "voice-guide" && voiceGuideActiveRef.current) {
      handleStopVoiceGuide();
    }
    if (mode !== "free-dictation" && freeListingModeRef.current) {
      handleStopFreeListingMode(false);
    }
    setActiveAcquisitionMode(mode);
    if (mode === "voice-guide" || mode === "free-dictation") {
      setHistory(["manualForm"]);
      return;
    }
    setHistory(["aiInput"]);
  }

  function applyLocalExtraction(rawText: string, source: ExtractionMeta["source"], confidence: number, note: string, extraNote = "") {
    const parsed = parseAdTextToForm(rawText, form);
    setVerifiedMarketData(null);
    setMarketDataError("");
    setForm({
      ...parsed,
      notes: appendNotes(parsed.notes, extraNote),
    });
    setAiText(rawText);
    setExtractionMeta({
      source,
      confidence,
      note,
      rawText: rawText.trim(),
    });
    setHistory(["manualForm", "aiInput", "aiReview"]);
  }

  function handleLocalParse() {
    if (isExtractionBusy) return;

    if (!aiText.trim()) {
      Alert.alert(tx("Annuncio mancante"), tx("Incolla prima il testo dell'annuncio."));
      return;
    }

    const preparedText = sanitizeDictationText(aiText);
    if (!preparedText) {
      Alert.alert(tx("Annuncio mancante"), tx("Il testo incollato non contiene dati utili da analizzare."));
      return;
    }

    applyLocalExtraction(
      preparedText,
      "local_text",
      55,
      "Parser locale avanzato: buono per bozza, meno affidabile dell'AI su annunci sporchi."
    );
  }

  function handleDescriptionCoachSend() {
    const message = descriptionCoachInput.trim();
    if (!message) {
      Alert.alert(tx("Messaggio mancante"), tx("Scrivi una richiesta per la guida descrizione."));
      return;
    }

    const assistantReply = buildDescriptionCoachReply(message, form);
    setDescriptionCoachMessages((current) => [
      ...current.slice(-6),
      { id: `user-${Date.now()}`, role: "user", text: message },
      { id: `assistant-${Date.now() + 1}`, role: "assistant", text: assistantReply },
    ]);
    setDescriptionCoachInput("");
  }

  function handleInsertGuidedDescription() {
    const draft = buildGuidedDescriptionDraft(form);
    setAiText((current) => (current.trim() ? `${current.trim()}\n\n${draft}` : draft));
    setDescriptionCoachMessages((current) => [
      ...current.slice(-6),
      {
        id: `assistant-draft-${Date.now()}`,
        role: "assistant",
        text: "Bozza inserita nel campo annuncio testuale. Puoi modificarla liberamente prima del parser.",
      },
    ]);
  }

  async function stopAssistantSpeech() {
    try {
      await Speech.stop();
    } catch {
      // no-op
    } finally {
      setIsAssistantSpeaking(false);
    }
  }

  async function speakAssistantMessage(text: string) {
    const spokenText = tx(text).trim();
    if (!spokenText) return;
    await stopAssistantSpeech();
    await new Promise<void>((resolve) => {
      let completed = false;
      const timeoutMs = Math.min(12000, Math.max(1800, spokenText.length * 70));
      const done = () => {
        if (completed) return;
        completed = true;
        setIsAssistantSpeaking(false);
        resolve();
      };
      setIsAssistantSpeaking(true);
      const timer = setTimeout(done, timeoutMs);
      Speech.speak(spokenText, {
        language: speechLocale,
        rate: 1.12,
        pitch: 1,
        onDone: () => {
          clearTimeout(timer);
          done();
        },
        onStopped: () => {
          clearTimeout(timer);
          done();
        },
        onError: () => {
          clearTimeout(timer);
          done();
        },
      });
    });
  }

  async function startSpeechRecognition(options?: { continuous?: boolean; interimResults?: boolean }): Promise<boolean> {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setSpeechError("Permesso microfono negato.");
        Alert.alert(tx("Permesso microfono negato"), tx("Abilita il microfono per usare l'assistente vocale."));
        return false;
      }

      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        const androidServices =
          Platform.OS === "android" ? ExpoSpeechRecognitionModule.getSpeechRecognitionServices().filter(Boolean) : [];
        const unavailableMessage =
          Platform.OS === "android" && androidServices.length > 0
            ? `Riconoscimento vocale non disponibile sul dispositivo. Servizi trovati: ${androidServices.join(", ")}`
            : "Riconoscimento vocale non disponibile sul dispositivo.";
        setSpeechError(unavailableMessage);
        Alert.alert(tx("Microfono non disponibile"), tx(unavailableMessage));
        return false;
      }

      let recognitionServicePackage: string | undefined;
      if (Platform.OS === "android") {
        const services = ExpoSpeechRecognitionModule.getSpeechRecognitionServices().filter(Boolean);
        const defaultService = ExpoSpeechRecognitionModule.getDefaultRecognitionService().packageName;
        if (defaultService) {
          recognitionServicePackage = defaultService;
        } else if (services.length > 0) {
          recognitionServicePackage = services[0];
        }
      }
      setSpeechError("");
      ExpoSpeechRecognitionModule.start({
        lang: speechLocale,
        interimResults: options?.interimResults ?? true,
        continuous: options?.continuous ?? false,
        maxAlternatives: 1,
        addsPunctuation: true,
        contextualStrings: VOICE_CONTEXT_STRINGS,
        volumeChangeEventOptions: {
          enabled: true,
          intervalMillis: 180,
        },
        ...(recognitionServicePackage ? { androidRecognitionServicePackage: recognitionServicePackage } : {}),
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore avvio dettatura.";
      setSpeechError(message);
      Alert.alert(tx("Microfono non disponibile"), tx(message));
      return false;
    }
  }

  function stopSpeechRecognition() {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      ExpoSpeechRecognitionModule.abort();
    } finally {
      setIsSpeechListening(false);
    }
  }

  async function promptVoiceGuide(question: string, options?: { speak?: boolean }) {
    stopSpeechRecognition();
    const shouldSpeak = options?.speak ?? true;
    if (shouldSpeak) {
      await speakAssistantMessage(question);
      if (!voiceGuideActiveRef.current) return;
    }
    await startSpeechRecognition();
  }

  async function handleStartVoiceGuide() {
    const firstStep = VOICE_GUIDE_STEPS[0];
    const firstQuestion = voiceGuideQuestion(firstStep, form);
    freeListingModeRef.current = false;
    setFreeListingMode(false);
    setFreeListingDraft("");
    voiceGuideActiveRef.current = true;
    setVoiceGuideActive(true);
    setVoiceGuideStepIndex(0);
    setVoiceGuideInput("");
    setSpeechError("");
    setVoiceGuideMessages([
      {
        id: `voice-start-${Date.now()}`,
        role: "assistant",
        text: firstQuestion,
      },
    ]);
    await promptVoiceGuide(firstQuestion, { speak: true });
  }

  function handleStopVoiceGuide() {
    voiceGuideActiveRef.current = false;
    voiceSubmitLockRef.current = false;
    stopSpeechRecognition();
    void stopAssistantSpeech();
    setVoiceGuideActive(false);
    setVoiceGuideStepIndex(0);
    setVoiceGuideInput("");
    setSpeechError("");
    setVoiceGuideMessages((current) => [
      ...current.slice(-6),
      {
        id: `voice-stop-${Date.now()}`,
        role: "assistant",
        text: "Assistente vocale fermato. Puoi riattivarlo dal pulsante microfono.",
      },
    ]);
  }

  async function handleVoiceGuideSkip() {
    if (!voiceGuideActiveRef.current) return;
    stopSpeechRecognition();
    setVoiceGuideInput("");
    const nextIndex = voiceGuideStepIndex + 1;
    if (nextIndex >= VOICE_GUIDE_STEPS.length) {
      const doneMessage = "Percorso guidato completato. Controlla i campi in basso e modifica dove serve.";
      voiceGuideActiveRef.current = false;
      setVoiceGuideActive(false);
      setVoiceGuideStepIndex(0);
      setSpeechError("");
      setVoiceGuideMessages((current) => [
        ...current.slice(-6),
        {
          id: `voice-end-skip-${Date.now()}`,
          role: "assistant",
          text: doneMessage,
        },
      ]);
      await speakAssistantMessage(doneMessage);
      return;
    }

    const nextStep = VOICE_GUIDE_STEPS[nextIndex];
    const nextQuestion = voiceGuideQuestion(nextStep, form);
    setVoiceGuideStepIndex(nextIndex);
    setVoiceGuideMessages((current) => [
      ...current.slice(-6),
      {
        id: `voice-skip-${Date.now()}`,
        role: "assistant",
        text: nextQuestion,
      },
    ]);
    await promptVoiceGuide(nextQuestion, { speak: true });
  }

  async function handleVoiceGuideSubmit(answerOverride?: string, source: "manual" | "voice" = "manual") {
    if (!voiceGuideActiveRef.current) {
      await handleStartVoiceGuide();
      return;
    }
    if (voiceSubmitLockRef.current) return;

    const answer = (answerOverride ?? voiceGuideInput).trim();
    if (!answer) {
      if (source !== "voice") {
        Alert.alert(tx("Risposta mancante"), tx("Inserisci o detta una risposta prima di continuare."));
      }
      return;
    }

    voiceSubmitLockRef.current = true;
    try {
      stopSpeechRecognition();
      if (isSkipCommand(answer)) {
        setVoiceGuideInput("");
        await handleVoiceGuideSkip();
        return;
      }

      const currentStep = VOICE_GUIDE_STEPS[Math.min(voiceGuideStepIndex, VOICE_GUIDE_STEPS.length - 1)];
      const answerPatch = buildVoiceGuideAnswerPatch(form, currentStep, answer);
      const isResolved = isVoiceGuideAnswerResolved(currentStep, answerPatch);

      if (!isResolved) {
        const retryMessage = voiceGuideRetryMessage(currentStep, form);
        setVoiceGuideMessages((current) => [
          ...current.slice(-6),
          { id: `voice-user-${Date.now()}`, role: "user", text: answer },
          { id: `voice-retry-${Date.now() + 1}`, role: "assistant", text: retryMessage },
        ]);
        setVoiceGuideInput("");
        setSpeechError("");
        await promptVoiceGuide(retryMessage, { speak: true });
        return;
      }

      if (currentStep === "province" || currentStep === "city" || currentStep === "zone") {
        setVerifiedMarketData(null);
        setMarketDataError("");
      }

      const nextForm = applyVoiceGuideAnswer(form, currentStep, answer);
      setForm(nextForm);

      const nextIndex = voiceGuideStepIndex + 1;
      const isDone = nextIndex >= VOICE_GUIDE_STEPS.length;
      const nextMessage = isDone
        ? "Scheda precompilata. Verifica i dati nelle sezioni sotto e correggi solo dove serve."
        : voiceGuideQuestion(VOICE_GUIDE_STEPS[nextIndex], nextForm);

      setVoiceGuideMessages((current) => [
        ...current.slice(-6),
        { id: `voice-user-${Date.now()}`, role: "user", text: answer },
        { id: `voice-assistant-${Date.now() + 1}`, role: "assistant", text: nextMessage },
      ]);

      setVoiceGuideInput("");
      if (isDone) {
        voiceGuideActiveRef.current = false;
        setVoiceGuideActive(false);
        setVoiceGuideStepIndex(0);
        setSpeechError("");
        await speakAssistantMessage(nextMessage);
      } else {
        setVoiceGuideStepIndex(nextIndex);
        await promptVoiceGuide(nextMessage, { speak: true });
      }
    } finally {
      voiceSubmitLockRef.current = false;
    }
  }

  function applyFreeListingTextToForm(rawText: string) {
    const cleaned = sanitizeDictationText(rawText);
    if (!cleaned) return;
    setVerifiedMarketData(null);
    setMarketDataError("");
    setForm((current) => ({
      ...parseAdTextToForm(cleaned, current),
      notes: appendNotes(cleanArchiveNotes(current.notes), cleanArchiveNotes(cleaned)),
    }));
    setAiText(cleaned);
    setExtractionMeta({
      source: "local_text",
      confidence: 60,
      note: "Annuncio libero dettato: parser locale automatico.",
      rawText: cleaned,
    });
  }

  async function handleStartFreeListingMode() {
    stopSpeechRecognition();
    voiceGuideActiveRef.current = false;
    voiceSubmitLockRef.current = false;
    setVoiceGuideActive(false);
    setVoiceGuideInput("");
    setSpeechError("");
    setFreeListingDraft("");
    freeListingDraftRef.current = "";
    freeListingCommittedRef.current = "";
    freeListingInterimRef.current = "";
    freeListingModeRef.current = true;
    setFreeListingMode(true);
    await speakAssistantMessage(
      "Modalita' annuncio libero attiva. Descrivi l'immobile in modo naturale. Premi stop per autocompilare la scheda."
    );
    if (!freeListingModeRef.current) return;
    await startSpeechRecognition({ continuous: true, interimResults: true });
  }

  function handleStopFreeListingMode(apply = true) {
    freeListingModeRef.current = false;
    setFreeListingMode(false);
    stopSpeechRecognition();
    const mergedTranscript = appendTranscript(
      appendTranscript(freeListingCommittedRef.current, freeListingInterimRef.current),
      freeListingDraftRef.current
    );
    const finalTranscript = sanitizeDictationText(mergedTranscript);
    if (apply && finalTranscript) {
      applyFreeListingTextToForm(finalTranscript);
      Alert.alert(tx("Scheda aggiornata"), tx("Annuncio libero acquisito. Verifica i campi e correggi dove serve."));
    }
    if (apply && !finalTranscript) {
      Alert.alert(tx("Nessun testo rilevato"), tx("Detta almeno una descrizione prima di fermare la modalita' annuncio libero."));
    }
    freeListingCommittedRef.current = "";
    freeListingInterimRef.current = "";
  }

  async function handleFloatingMicToggle() {
    if (isAssistantSpeaking) {
      await stopAssistantSpeech();
      return;
    }
    if (isSpeechListening && !voiceGuideActiveRef.current && !freeListingModeRef.current) {
      stopSpeechRecognition();
      return;
    }
    if (freeListingModeRef.current) {
      handleStopFreeListingMode(true);
      return;
    }
    if (voiceGuideActiveRef.current) {
      handleStopVoiceGuide();
      return;
    }
    if (screen !== "manualForm") {
      setHistory(["manualForm"]);
      setTimeout(() => {
        void handleStartVoiceGuide();
      }, 180);
      return;
    }
    await handleStartVoiceGuide();
  }

  async function handleOpenStripeCheckout() {
    const checkoutUrl = billingSettings.stripeCheckoutUrl.trim();
    if (!checkoutUrl) {
      Alert.alert(
        tx("Checkout Stripe mancante"),
        tx("Inserisci nelle impostazioni l'URL Stripe Checkout (2,49€) con success_url affaresubito://billing/success?pro=1.")
      );
      return;
    }
    try {
      await Linking.openURL(checkoutUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossibile aprire Stripe Checkout.";
      Alert.alert(tx("Errore apertura Stripe"), tx(message));
    }
  }

  function handleOpenAiImport(mode: Extract<AcquisitionMode, "paste-text" | "screenshot"> = "screenshot") {
    setActiveAcquisitionMode(mode);
    setHistory(["manualForm", "aiInput"]);
  }

  function renderAcquisitionMethodOverview() {
    const methods = [
      {
        key: "voice-guide",
        title: "Assistente vocale guidato",
        description: "Una domanda alla volta: ascolta la risposta, compila i campi e passa subito alla successiva.",
        onPress: () => switchAcquisitionMode("voice-guide"),
      },
      {
        key: "free-dictation",
        title: "Dettatura libera dati immobile",
        description: "Detta l'annuncio in modo naturale: il parser estrae i dati e precompila la scheda.",
        onPress: () => switchAcquisitionMode("free-dictation"),
      },
      {
        key: "screenshot",
        title: "Usa screenshot annuncio",
        description: "Carica uno screenshot: l'OCR estrae i dati e compila automaticamente i campi.",
        onPress: () => switchAcquisitionMode("screenshot"),
      },
      {
        key: "paste-text",
        title: "Copia/incolla testo annuncio",
        description: "Incolla il testo dell'annuncio o appunti operativi e compila i campi dal parser.",
        onPress: () => switchAcquisitionMode("paste-text"),
      },
    ] as const;
    const activeMethod = methods.find((method) => method.key === activeAcquisitionMode) || methods[0];

    return (
      <View style={styles.segmentCard}>
        <Text style={styles.segmentTitle}>{tx("Metodo di acquisizione")}</Text>
        <View style={styles.acquisitionButtonGrid}>
          {methods.map((method) => (
            <TouchableOpacity
              key={method.key}
              style={[
                styles.acquisitionButton,
                activeAcquisitionMode === method.key && styles.acquisitionButtonActive,
              ]}
              onPress={method.onPress}
            >
              <Text
                style={[
                  styles.acquisitionButtonText,
                  activeAcquisitionMode === method.key && styles.acquisitionButtonTextActive,
                ]}
              >
                {tx(method.title)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.acquisitionMethodHint}>{tx(activeMethod.description)}</Text>
      </View>
    );
  }

  function renderClearPropertyCard() {
    return (
      <View style={[styles.card, styles.warningCard]}>
        <Text style={styles.cardTitle}>{tx("Pulisci dati immobile")}</Text>
        <Text style={styles.cardText}>{tx("Azzera bozza corrente, testo annuncio, screenshot OCR e dettature per ripartire pulito.")}</Text>
        <TouchableOpacity style={styles.secondaryButtonDanger} onPress={handleClearCurrentPropertyData}>
          <Text style={styles.secondaryButtonDangerText}>{tx("Pulisci dati immobile")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleRefreshVerifiedMarketData(options?: { silent?: boolean; force?: boolean }) {
    if (isMarketDataLoading) return;

    if (!form.city.trim()) {
      if (!options?.silent) {
        Alert.alert(tx("Citta' mancante"), tx("Inserisci almeno la citta' per scaricare dati locali verificati."));
      }
      return;
    }

    const lookupKey = buildMarketLookupKey(form);
    if (lookupKey && (options?.force || options?.silent)) {
      lastAutoMarketLookupKeyRef.current = lookupKey;
    }

    setIsMarketDataLoading(true);
    setMarketDataError("");

    try {
      const fetched = await fetchVerifiedMarketData(form.city, form.country);
      const suggestedAreaPrice = pickVerifiedAreaPricePerSqm(fetched, form.zone);
      const hasAreaPrice = Boolean(suggestedAreaPrice > 0);

      setVerifiedMarketData(fetched);
      if (!hasAreaPrice) {
        setMarketDataError("Prezzi locali non disponibili o temporaneamente bloccati (403). Tassi mutuo aggiornati se disponibili.");
      }
      setForm((current) => {
        const sqm = toNumber(current.sqm);
        const askingPrice = toNumber(current.askingPrice);
        const next: PropertyForm = { ...current };
        if (!next.country.trim()) next.country = fetched.countryName;
        if (!next.areaAveragePricePerSqm.trim() && hasAreaPrice) {
          next.areaAveragePricePerSqm = String(Math.round(suggestedAreaPrice));
        }
        if (!next.estimatedMarketValue.trim() && hasAreaPrice && sqm > 0) {
          next.estimatedMarketValue = String(Math.round(suggestedAreaPrice * sqm));
        }
        if (!next.fixedMortgageRate.trim() && fetched.mortgageFixedPct && fetched.mortgageFixedPct > 0) {
          next.fixedMortgageRate = fetched.mortgageFixedPct.toFixed(2);
        }
        if (!next.variableMortgageRate.trim() && fetched.mortgageVariablePct && fetched.mortgageVariablePct > 0) {
          next.variableMortgageRate = fetched.mortgageVariablePct.toFixed(2);
        }
        if (!next.taxesAndNotary.trim() && fetched.transferCostPct && fetched.transferCostPct > 0 && askingPrice > 0) {
          next.taxesAndNotary = String(Math.round((askingPrice * fetched.transferCostPct) / 100));
        }

        const sourceLines: string[] = [];
        if (fetched.areaSourceUrl) {
          sourceLines.push(`Fonte prezzi locali: ${fetched.areaSourceUrl} (${fetched.areaUpdatedAt || "data non dichiarata"})`);
        } else {
          sourceLines.push("Fonte prezzi locali non disponibile: inserire benchmark area manuale.");
        }
        if (fetched.ratesSourceUrl) {
          sourceLines.push(`Fonte tassi mutuo: ${fetched.ratesSourceUrl} (${fetched.ratesUpdatedAt || "ultimo dato disponibile"})`);
        }
        if (fetched.transferCostSourceUrl) {
          sourceLines.push(`Fonte imposte/registrazione: ${fetched.transferCostSourceUrl} (${fetched.transferCostUpdatedAt || "ultimo dato disponibile"})`);
        }
        if (sourceLines.length > 0) {
          next.notes = appendNotes(next.notes, sourceLines.join("\n"));
        }

        if (!next.agencyFee.trim() && askingPrice > 0) {
          next.agencyFee = String(Math.round(askingPrice * (settings.defaultAgencyPct / 100)));
        }
        if (!next.unexpectedPct.trim() && settings.defaultUnexpectedPct > 0) {
          next.unexpectedPct = String(Math.round(settings.defaultUnexpectedPct * 10) / 10);
        }
        if (!next.title.trim()) {
          next.title = buildAutoPropertyTitle(analyses, next.id);
        }
        if (!next.notes.trim()) {
          next.notes = buildAutoAccessoryAndMarketNotes(next, analysisSupport, fetched);
        }
        const refreshedSupport = buildAnalysisSupport(next, settings, analyses, fetched);
        if (!next.resalePrice.trim() && refreshedSupport.suggestedResalePrice > 0) {
          next.resalePrice = String(Math.round(refreshedSupport.suggestedResalePrice));
        }
        if (!next.monthlyRent.trim() && refreshedSupport.suggestedMonthlyRent > 0) {
          next.monthlyRent = String(Math.round(refreshedSupport.suggestedMonthlyRent));
        }
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore aggiornamento dati locali.";
      setMarketDataError(message);
      if (!options?.silent) {
        Alert.alert(tx("Dati locali non disponibili"), tx(message));
      }
    } finally {
      setIsMarketDataLoading(false);
    }
  }

  async function pickScreenshot() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(tx("Permesso negato"), tx("Serve accesso alle immagini per leggere uno screenshot."));
      return;
    }

    const picker = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      base64: true,
      allowsMultipleSelection: false,
    });

    if (picker.canceled || picker.assets.length === 0) return;

    const asset = picker.assets[0];
    if (!asset.base64) {
      Alert.alert(tx("Immagine non leggibile"), tx("Seleziona un'immagine valida."));
      return;
    }

    setSelectedImage({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType || "image/jpeg",
      fileName: asset.fileName || "screenshot.jpg",
    });
  }

  async function runDebugOcrRegressionSuite() {
    if (isDebugOcrRegressionRunning) return;

    setIsDebugOcrRegressionRunning(true);
    setDebugOcrRegressionLines(["Test OCR locale in corso..."]);

    try {
      const nextLines: string[] = [];

      for (const testCase of DEV_OCR_REGRESSION_CASES) {
        const ocrText = sanitizeOcrText(testCase.ocrText);
        const parsed = parseAdTextToForm(ocrText, emptyForm());
        const failures = Object.entries(testCase.expected)
          .map(([field, expected]) => {
            const actual = parsed[field as keyof DevOcrRegressionExpectation];
            return compareDevOcrRegressionValue(actual, expected) ? "" : `${field}=${formatDevOcrRegressionValue(actual)}!=${formatDevOcrRegressionValue(expected)}`;
          })
          .filter(Boolean);

        const status = failures.length === 0 ? "OK" : "KO";
        nextLines.push(`${status} ${testCase.label} | ${summarizeDevOcrRegressionResult(parsed)}${failures.length ? ` | ${failures.join(", ")}` : ""}`);
      }

      setDebugOcrRegressionLines(nextLines);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore test OCR locale.";
      setDebugOcrRegressionLines([`KO test OCR locale | ${message}`]);
    } finally {
      setIsDebugOcrRegressionRunning(false);
    }
  }

  async function runDebugOcrImageRegressionSuite() {
    if (isDebugOcrRegressionRunning) return;

    setIsDebugOcrRegressionRunning(true);
    setDebugOcrImageRegressionLines(["Test OCR immagini reali in corso..."]);

    try {
      const nextLines: string[] = [];

      for (const testCase of DEV_OCR_REGRESSION_CASES) {
        if (!testCase.imageFileName) continue;

        const image: PickedImage = {
          uri: `${DEBUG_OCR_DEVICE_IMAGE_DIR}/${testCase.imageFileName}`,
          base64: "",
          mimeType: "image/jpeg",
          fileName: testCase.imageFileName,
        };
        const localOcrRaw = await requestLocalImageOcrText(image);
        const localOcrText = sanitizeOcrText(localOcrRaw);
        const parsed = parseAdTextToForm(localOcrText, emptyForm());
        const failures = Object.entries(testCase.expected)
          .map(([field, expected]) => {
            const actual = parsed[field as keyof DevOcrRegressionExpectation];
            return compareDevOcrRegressionValue(actual, expected) ? "" : `${field}=${formatDevOcrRegressionValue(actual)}!=${formatDevOcrRegressionValue(expected)}`;
          })
          .filter(Boolean);
        const status = failures.length === 0 ? "OK" : "KO";
        nextLines.push(`${status} ${testCase.label} | ${summarizeDevOcrRegressionResult(parsed)}${failures.length ? ` | ${failures.join(", ")}` : ""}`);
      }

      setDebugOcrImageRegressionLines(nextLines);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore test OCR immagini.";
      setDebugOcrImageRegressionLines([`KO test OCR immagini | ${message}`]);
    } finally {
      setIsDebugOcrRegressionRunning(false);
    }
  }

  async function handleAIExtraction(source: "text" | "image") {
    if (source === "text" && !aiSettings.apiKey.trim()) {
      Alert.alert(tx("API key mancante"), tx("Inserisci una chiave API nelle impostazioni AI."));
      return;
    }

    if (source === "text" && !aiText.trim()) {
      Alert.alert(tx("Annuncio mancante"), tx("Incolla prima il testo dell'annuncio."));
      return;
    }

    if (source === "image" && !selectedImage) {
      Alert.alert(tx("Screenshot mancante"), tx("Seleziona prima uno screenshot."));
      return;
    }

    setIsAiBusy(true);

    try {
      const baseDraft = source === "text" ? parseAdTextToForm(aiText, form) : form;
      if (source === "image" && selectedImage) {
        const localOcrRaw = await requestLocalImageOcrText(selectedImage);
        const localOcrText = sanitizeOcrText(localOcrRaw);
        if (!localOcrText.trim()) {
          throw new Error("OCR locale non ha rilevato testo utile.");
        }

        const localMerged = parseAdTextToForm(localOcrText, baseDraft);
        setForm((current) => ({
          ...localMerged,
          id: current.id,
          notes: appendNotes(current.notes, localMerged.notes || ""),
        }));
        setAiText(localOcrText);

        if (!aiSettings.apiKey.trim()) {
          setExtractionMeta({
            source: "local_image",
            confidence: 66,
            note: "OCR locale gratuito completato: verifica e correggi i campi suggeriti.",
            rawText: localOcrText,
          });
          setHistory(["manualForm", "aiInput", "aiReview"]);
          return;
        }

        try {
          const aiPayload = await requestAIExtraction({
            aiSettings,
            text: localOcrText,
          });
          const aiMerged = mergeFormWithPatch(localMerged, buildPatchFromAI(aiPayload));
          setForm((current) => ({
            ...aiMerged,
            id: current.id,
            notes: appendNotes(current.notes, aiMerged.notes || ""),
          }));
          setExtractionMeta({
            source: "ai_image",
            confidence: aiPayload.confidence || 78,
            note: aiPayload.reasoningNotes || "OCR locale + rifinitura AI completati.",
            rawText: aiPayload.rawText?.trim() || localOcrText,
          });
        } catch {
          setExtractionMeta({
            source: "local_image",
            confidence: 66,
            note: "OCR locale completato. Rifinitura AI non disponibile, campi compilati in locale.",
            rawText: localOcrText,
          });
        }

        setHistory(["manualForm", "aiInput", "aiReview"]);
        return;
      }

      const payload = await requestAIExtraction({
        aiSettings,
        text: aiText,
      });
      const merged = mergeFormWithPatch(baseDraft, buildPatchFromAI(payload));
      const rawText = payload.rawText?.trim() || aiText.trim();

      setForm((current) => ({
        ...merged,
        id: current.id,
        notes: appendNotes(current.notes, merged.notes || ""),
      }));
      setExtractionMeta({
        source: "ai_text",
        confidence: payload.confidence || 75,
        note: payload.reasoningNotes || "Estrazione AI completata.",
        rawText,
      });
      setHistory(["manualForm", "aiInput", "aiReview"]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore OCR/AI sconosciuto.";
      Alert.alert(tx("Estrazione AI fallita"), tx(message));
    } finally {
      setIsAiBusy(false);
    }
  }

  function handleCalculate() {
    if (validation.errors.length > 0) {
      Alert.alert(tx("Correggi i blocchi"), validation.errors.map((item) => tx(item)).join("\n"));
      return;
    }

    setResult(liveResult);
    pushScreen("result");
  }

  async function handleSaveAnalysis() {
    if (!result) return;
    const cleanedForm: PropertyForm = {
      ...form,
      notes: cleanArchiveNotes(form.notes),
    };
    const alreadySaved = analyses.some((analysis) => analysis.id === cleanedForm.id);
    if (alreadySaved) {
      cleanedForm.id = `${Date.now()}`;
      if (!cleanedForm.title.trim() || extractAutoPropertyTitleIndex(cleanedForm.title) !== null) {
        cleanedForm.title = buildAutoPropertyTitle(analyses, cleanedForm.id);
      }
    }
    if (!cleanedForm.title.trim()) {
      cleanedForm.title = buildAutoPropertyTitle(analyses, cleanedForm.id);
    }

    if (!isProUnlocked && analyses.length >= FREE_PLAN_MAX_ANALYSES) {
      Alert.alert(
        tx("Limite piano Free"),
        tx("Nella versione gratuita puoi salvare massimo 2 immobili. Sblocca Pro a 2,49 € con Stripe."),
        [
          { text: tx("Annulla"), style: "cancel" },
          {
            text: tx("Sblocca Pro"),
            onPress: () => void handleOpenStripeCheckout(),
          },
        ]
      );
      return;
    }

    const item: SavedAnalysis = {
      id: cleanedForm.id || String(Date.now()),
      createdAt: new Date().toISOString(),
      form: cleanedForm,
      result,
    };

    const next = [item, ...analyses];
    await persistAnalyses(next);
    resetDraft(next);
    setHistory(["manualForm"]);

    Alert.alert(tx("Analisi salvata"), `${tx("L'immobile e' stato archiviato.")}\n${cleanedForm.title}`);
  }

  async function handleDeleteSelected() {
    if (!selectedAnalysis) return;
    const next = analyses.filter((analysis) => analysis.id !== selectedAnalysis.id);
    await persistAnalyses(next);
    setSelectedAnalysis(null);
    setHistory(["archive"]);
  }

  function openComparison(includeCurrent = false) {
    const currentDraftCountsForComparison =
      includeCurrent && Boolean(result) && !analyses.some((item) => item.form.id === form.id);
    const comparableCount = analyses.length + (currentDraftCountsForComparison ? 1 : 0);

    if (comparableCount < 2) {
      Alert.alert(tx("Confronto non disponibile"), tx("Salva almeno due immobili per confrontarli."));
      return;
    }
    setCompareIncludeCurrent(currentDraftCountsForComparison);
    pushScreen("compare");
  }

  function getSavedMemory(item: SavedAnalysis): SavedMemorySnapshot {
    return buildSavedMemorySnapshot(item, settings, analyses);
  }

  function renderHome() {
    const total = Math.max(analyses.length, 1);
    const comparePreview = sortedAnalyses.slice(0, 2);
    const comparisonStatus =
      analyses.length >= 2 ? tx("Confronto pronto") : analyses.length === 1 ? tx("Serve 1 salvataggio") : tx("Archivio da avviare");
    const archiveCapacityLabel = isProUnlocked ? tx("Salvataggi illimitati") : tx(`${freeRemainingSlots} slot liberi`);

    return (
      <ScrollView contentContainerStyle={screenContentStyle} keyboardShouldPersistTaps="handled">
        <Header title="Dashboard investitore" subtitle="Vista rapida, archivio e flussi di acquisizione." />

        <View style={styles.heroCard}>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Text style={styles.heroMetaPillText}>{isProUnlocked ? "PRO FLOW" : "FREE FLOW"}</Text>
            </View>
            <View style={[styles.heroMetaPill, styles.heroMetaPillWarm]}>
              <Text style={[styles.heroMetaPillText, styles.heroMetaPillTextWarm]}>{comparisonStatus}</Text>
            </View>
          </View>
          <Text style={styles.heroEyebrow}>Pipeline Android-ready</Text>
          <Text style={styles.heroTitle}>{tx("Analizza immobili, pulisci i dati e confronta le opportunita'.")}</Text>
          <Text style={styles.heroText}>
            {tx("Parser locale piu' robusto, revisione AI/OCR e criteri piu' severi prima del calcolo.")}
          </Text>

          <View style={styles.heroInsightGrid}>
            <View style={styles.heroInsightCard}>
              <Text style={styles.heroInsightLabel}>{tx("Analisi live")}</Text>
              <Text style={styles.heroInsightValue}>{analyses.length}</Text>
              <Text style={styles.heroInsightMeta}>{tx("schede in archivio")}</Text>
            </View>
            <View style={styles.heroInsightCard}>
              <Text style={styles.heroInsightLabel}>{tx("Piano attivo")}</Text>
              <Text style={styles.heroInsightValue}>{isProUnlocked ? "Pro" : "Free"}</Text>
              <Text style={styles.heroInsightMeta}>{archiveCapacityLabel}</Text>
            </View>
            <View style={[styles.heroInsightCard, styles.heroInsightCardWide]}>
              <Text style={styles.heroInsightLabel}>{tx("Confronto immobiliare")}</Text>
              <Text style={styles.heroInsightValue}>{analyses.length >= 2 ? compareLimit : Math.min(1, compareLimit)}</Text>
              <Text style={styles.heroInsightMeta}>
                {analyses.length >= 2 ? tx("immobili pronti al testa a testa") : tx("serve un altro immobile salvato")}
              </Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.primaryButton} onPress={startManualAnalysis}>
              <Text style={styles.primaryButtonText}>{tx("Nuova analisi manuale")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={startAIAnalysis}>
              <Text style={styles.secondaryButtonText}>{tx("Parser AI / OCR")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <MetricTile label="Analisi" value={String(analyses.length)} accent />
          <MetricTile label="Budget max" value={formatCurrency(settings.maxBudget)} />
          <MetricTile label="Margine min" value={formatPercent(settings.minFlipMarginPct)} />
          <MetricTile label="Rendimento min" value={formatPercent(settings.minRentYieldPct)} />
        </View>

        {comparePreview.length >= 2 ? (
          <View style={styles.compareSpotlightCard}>
            <Text style={styles.compareSpotlightEyebrow}>Confronto sempre visibile</Text>
            <Text style={styles.compareSpotlightTitle}>Apri il testa a testa tra i due immobili principali</Text>
            <Text style={styles.compareSpotlightText}>
              Score, investimento, prezzo al mq e rata sono allineati in una sola schermata invece di restare nascosti nell'archivio.
            </Text>
            <View style={styles.compareSpotlightPair}>
              {comparePreview.map((item, index) => {
                const palette = COMPARE_CARD_PALETTE[index % COMPARE_CARD_PALETTE.length];
                return (
                  <View
                    key={`${item.id}-home-compare`}
                    style={[
                      styles.compareSpotlightMiniCard,
                      { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
                    ]}
                  >
                    <Text style={[styles.compareSpotlightMiniBadge, { backgroundColor: palette.accentColor }]}>{`Score ${item.result.score}`}</Text>
                    <Text style={[styles.compareSpotlightMiniTitle, { color: palette.textColor }]} numberOfLines={2}>
                      {buildPropertyDisplayTitle(item.form, index + 1)}
                    </Text>
                    <Text style={styles.compareSpotlightMiniMeta} numberOfLines={2}>
                      {formatLocationLabel(item.form) || item.form.propertyType || "Immobile"}
                    </Text>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => openComparison()}>
              <Text style={styles.primaryButtonText}>{tx("Apri confronto immobili")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Distribuzione archivio")}</Text>
          <BarRow label="Verdi" valueLabel={`${stats.green}`} ratio={stats.green / total} color="#2f855a" />
          <BarRow label="Gialli" valueLabel={`${stats.yellow}`} ratio={stats.yellow / total} color="#b7791f" />
          <BarRow label="Rossi" valueLabel={`${stats.red}`} ratio={stats.red / total} color="#c53030" />
        </View>

        {bestAnalysis ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tx("Miglior immobile salvato")}</Text>
            <Text style={styles.cardText}>{buildPropertyDisplayTitle(bestAnalysis.form, 1)}</Text>
            <Text style={styles.cardMuted}>
              {bestAnalysis.form.city}
              {bestAnalysis.form.zone ? ` - ${bestAnalysis.form.zone}` : ""}
            </Text>
            <Text style={[styles.scoreChip, { color: scoreColorHex(bestAnalysis.result.color) }]}>
              {tx(scoreColorLabel(bestAnalysis.result.color))} • Score {bestAnalysis.result.score}/100
            </Text>
            <Text style={styles.cardText}>{tx(getPerformanceLabel(bestAnalysis))}</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setSelectedAnalysis(bestAnalysis);
                setHistory(["archive", "detail"]);
              }}
            >
              <Text style={styles.secondaryButtonText}>{tx("Apri dettaglio")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tx("Archivio ancora vuoto")}</Text>
            <Text style={styles.cardText}>{tx("Dopo il primo salvataggio vedrai trend, confronti e benchmark interni.")}</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderManualForm() {
    return (
      <ScrollView contentContainerStyle={screenContentStyle} keyboardShouldPersistTaps="handled">
        <Header title={t("manualTitle")} subtitle={t("manualSubtitle")} onBack={() => openTab("home")} />

        {renderAcquisitionMethodOverview()}
        {renderClearPropertyCard()}

        {activeAcquisitionMode === "voice-guide" ? (
          <View style={styles.card}>
            <View style={styles.voiceGuideHeader}>
              <Text style={styles.cardTitle}>{tx("Assistente vocale guidato")}</Text>
              <TouchableOpacity
                style={[styles.micButton, (voiceGuideActive || freeListingMode || isSpeechListening || isAssistantSpeaking) && styles.micButtonActive]}
                onPress={freeListingMode ? () => handleStopFreeListingMode(true) : voiceGuideActive ? handleStopVoiceGuide : () => void handleStartVoiceGuide()}
              >
                <MaterialIcons
                  name="keyboard-voice"
                  size={20}
                  color={voiceGuideActive || freeListingMode || isSpeechListening || isAssistantSpeaking ? "#fff7ea" : "#9b1c1c"}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.cardText}>
              {tx("Una domanda alla volta: l'assistente legge la domanda successiva, ascolta la risposta e compila i campi principali.")}
            </Text>
            <Text style={styles.cardMuted}>
              {t("autosaveActive")}
              {lastAutoSaveAt ? ` • ${tx(`ultimo salvataggio ${formatDate(lastAutoSaveAt)}`)}` : ""}
            </Text>
            {voiceGuideMessages.length === 0 ? (
              <Text style={styles.helperText}>{tx("Premi il microfono per iniziare la compilazione guidata e passare automaticamente alla domanda successiva.")}</Text>
            ) : null}

            {voiceGuideMessages.length > 0 && !freeListingMode ? (
              <View style={styles.voiceGuidePanel}>
                {voiceGuideMessages.slice(-4).map((message) => (
                  <View key={message.id} style={[styles.coachBubble, message.role === "assistant" ? styles.coachBubbleAssistant : styles.coachBubbleUser]}>
                    <Text style={[styles.coachBubbleRole, message.role === "assistant" ? styles.coachBubbleRoleAssistant : styles.coachBubbleRoleUser]}>
                      {message.role === "assistant" ? tx("Assistente") : tx("Tu")}
                    </Text>
                    <Text style={styles.coachBubbleText}>{tx(message.text)}</Text>
                  </View>
                ))}
                <TextInput
                  style={styles.input}
                  value={voiceGuideInput}
                  onChangeText={setVoiceGuideInput}
                  placeholder={tx('Rispondi alla domanda (oppure scrivi "salta")')}
                  placeholderTextColor="#8a8174"
                />
                <Text style={styles.helperText}>
                  {isAssistantSpeaking
                    ? tx("Assistente sta parlando...")
                    : isSpeechListening
                      ? tx("Dettatura attiva...")
                      : tx("Tocca il microfono per dettare la risposta")}
                </Text>
                {speechError ? <Text style={styles.issueWarning}>• {tx(speechError)}</Text> : null}
                <View style={styles.coachActions}>
                  <TouchableOpacity
                    style={styles.secondaryButtonCompact}
                    onPress={() =>
                      void (voiceGuideActive
                        ? isAssistantSpeaking
                          ? stopAssistantSpeech()
                          : isSpeechListening
                            ? Promise.resolve(stopSpeechRecognition())
                            : startSpeechRecognition()
                        : handleStartVoiceGuide())
                    }
                  >
                    <Text style={styles.secondaryButtonText}>
                      {isAssistantSpeaking
                        ? tx("Interrompi voce assistente")
                        : isSpeechListening
                          ? tx("Interrompi dettatura")
                          : tx("Detta risposta")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButtonCompact} onPress={() => void handleVoiceGuideSkip()}>
                    <Text style={styles.secondaryButtonText}>{tx("Salta")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryButtonCompact} onPress={() => void handleVoiceGuideSubmit()}>
                    <Text style={styles.primaryButtonText}>{tx("Continua")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        ) : activeAcquisitionMode === "free-dictation" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tx("Dettatura libera dati immobile")}</Text>
            <Text style={styles.cardText}>{tx("Detta un annuncio completo: testo libero, parser automatico e campi precompilati con un solo passaggio.")}</Text>
            <View style={styles.voiceGuidePanel}>
              <TextInput
                style={[styles.input, styles.textAreaInput]}
                multiline
                value={freeListingDraft}
                onChangeText={setFreeListingDraft}
                placeholder={tx("Trascrizione annuncio libero...")}
                placeholderTextColor="#8a8174"
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                {freeListingMode
                  ? tx("Dettatura annuncio libero attiva...")
                  : tx("Premi Avvia e detta tutto l'annuncio. Premi Stop per autocompilare.")}
              </Text>
              <View style={styles.coachActions}>
                <TouchableOpacity
                  style={styles.secondaryButtonCompact}
                  onPress={() => void (freeListingMode ? handleStopFreeListingMode(true) : handleStartFreeListingMode())}
                >
                  <Text style={styles.secondaryButtonText}>
                    {freeListingMode ? tx("Stop annuncio libero") : tx("Avvia annuncio libero")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButtonCompact, !freeListingDraft.trim() && styles.buttonDisabled]}
                  disabled={!freeListingDraft.trim()}
                  onPress={() => applyFreeListingTextToForm(freeListingDraft)}
                >
                  <Text style={styles.primaryButtonText}>{tx("Applica testo")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        <IssueCard report={validation} />

        <View style={styles.previewBand}>
          <MetricTile label="Investimento" value={formatCurrency(liveResult.totalInvestment)} accent />
          <MetricTile label="Prezzo/mq" value={formatCurrency(pricePerSqm(form) || 0)} />
          <MetricTile
            label={form.goal === "flip" ? "Margine %" : "Rendimento netto"}
            value={formatPercent(form.goal === "flip" ? liveResult.grossMarginPct : liveResult.netYieldPct)}
          />
        </View>

        <FormSections
          form={form}
          settings={settings}
          support={analysisSupport}
          updateField={updateField}
          verifiedMarketData={verifiedMarketData}
          isMarketDataLoading={isMarketDataLoading}
          marketDataError={marketDataError}
          onRefreshMarketData={() => void handleRefreshVerifiedMarketData({ force: true })}
          i18n={{
            updateLocalData: t("updateLocalData"),
            updatingLocalData: t("updatingLocalData"),
            noVerifiedData: t("noVerifiedData"),
          }}
        />

        <TouchableOpacity
          style={[styles.primaryButton, validation.errors.length > 0 && styles.buttonDisabled]}
          onPress={handleCalculate}
          disabled={validation.errors.length > 0}
        >
          <Text style={styles.primaryButtonText}>{t("calculate")}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderAIInput() {
    const aiConfigured = aiSettings.apiKey.trim().length > 0;

    return (
      <ScrollView contentContainerStyle={screenContentStyle} keyboardShouldPersistTaps="handled">
        <Header title={t("aiInputTitle")} subtitle={t("aiInputSubtitle")} onBack={() => openTab("home")} />

        {renderAcquisitionMethodOverview()}
        {renderClearPropertyCard()}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Stato integrazione AI")}</Text>
          <Text style={styles.cardText}>
            {aiConfigured
              ? tx(`Configurata con modello ${aiSettings.model}.`)
              : tx("Nessuna API key salvata: parser locale e guida descrizione gratis funzionano comunque.")}
          </Text>
          <Text style={styles.cardMuted}>{tx("La chiave serve solo per estrazione AI remota/OCR e viene salvata localmente via AsyncStorage.")}</Text>
        </View>

        {activeAcquisitionMode === "paste-text" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tx("Copia/incolla testo annuncio")}</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={10}
              value={aiText}
              onChangeText={setAiText}
              placeholder={tx("Incolla qui un annuncio o una tua descrizione operativa...")}
              placeholderTextColor="#8a8174"
              textAlignVertical="top"
            />
            <View style={styles.coachCard}>
              <Text style={styles.segmentTitle}>{tx("Guida descrizione AI (gratis)")}</Text>
              <Text style={styles.cardMuted}>{tx("Nessuna API key: risposte locali guidate e bozza pronta da inserire.")}</Text>
              <View style={styles.coachMessages}>
                {descriptionCoachMessages.slice(-4).map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.coachBubble,
                      message.role === "assistant" ? styles.coachBubbleAssistant : styles.coachBubbleUser,
                    ]}
                  >
                    <Text
                      style={[
                        styles.coachBubbleRole,
                        message.role === "assistant" ? styles.coachBubbleRoleAssistant : styles.coachBubbleRoleUser,
                      ]}
                    >
                      {message.role === "assistant" ? tx("AI gratis") : tx("Tu")}
                    </Text>
                    <Text style={styles.coachBubbleText}>{tx(message.text)}</Text>
                  </View>
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={descriptionCoachInput}
                onChangeText={setDescriptionCoachInput}
                placeholder={tx('Es: "genera bozza", "come valorizzo la zona?"')}
                placeholderTextColor="#8a8174"
              />
              <View style={styles.coachActions}>
                <TouchableOpacity style={styles.secondaryButtonCompact} onPress={handleDescriptionCoachSend}>
                  <Text style={styles.secondaryButtonText}>{tx("Invia")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButtonCompact} onPress={handleInsertGuidedDescription}>
                  <Text style={styles.primaryButtonText}>{tx("Inserisci bozza")}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={[styles.secondaryButton, isExtractionBusy && styles.buttonDisabled]} onPress={handleLocalParse} disabled={isExtractionBusy}>
              <Text style={styles.secondaryButtonText}>{tx("Parser locale avanzato")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, (!aiConfigured || isExtractionBusy) && styles.buttonDisabled]}
              onPress={() => void handleAIExtraction("text")}
              disabled={!aiConfigured || isExtractionBusy}
            >
              <Text style={styles.primaryButtonText}>{isAiBusy ? tx("Analisi AI in corso...") : tx("Estrai con AI vera")}</Text>
            </TouchableOpacity>
          </View>
        ) : activeAcquisitionMode === "screenshot" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tx("Usa screenshot annuncio")}</Text>
            <Text style={styles.cardText}>{tx("Seleziona uno screenshot: l'OCR estrae i dati e compila automaticamente i campi, con AI opzionale se hai API key.")}</Text>
            {selectedImage ? (
              <View style={styles.imagePreviewCard}>
                <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                <View style={styles.imagePreviewMeta}>
                  <Text style={styles.cardText}>{selectedImage.fileName}</Text>
                  <Text style={styles.cardMuted}>{tx("Pronto per l'estrazione.")}</Text>
                </View>
              </View>
            ) : null}
            <TouchableOpacity style={[styles.secondaryButton, isExtractionBusy && styles.buttonDisabled]} onPress={() => void pickScreenshot()} disabled={isExtractionBusy}>
              <Text style={styles.secondaryButtonText}>{tx("Seleziona screenshot")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, (!selectedImage || isExtractionBusy) && styles.buttonDisabled]}
              onPress={() => void handleAIExtraction("image")}
              disabled={!selectedImage || isExtractionBusy}
            >
              <Text style={styles.primaryButtonText}>
                {isAiBusy ? tx("OCR AI in corso...") : aiConfigured ? tx("Leggi screenshot con OCR + AI") : tx("Leggi screenshot con OCR locale")}
              </Text>
            </TouchableOpacity>
            <View style={[styles.card, styles.noticeCard]}>
              <Text style={styles.cardTitle}>Test OCR locale</Text>
              <Text style={styles.cardText}>Esegue una regressione sui 5 screenshot di test inclusi nell'app, sia sul parser locale sia sull'OCR reale da file sul device.</Text>
              <TouchableOpacity
                style={[styles.secondaryButton, isDebugOcrRegressionRunning && styles.buttonDisabled]}
                onPress={() => void runDebugOcrRegressionSuite()}
                disabled={isDebugOcrRegressionRunning}
              >
                <Text style={styles.secondaryButtonText}>{isDebugOcrRegressionRunning ? "Test parser in corso..." : "Esegui test parser 5 screenshot"}</Text>
              </TouchableOpacity>
              {debugOcrRegressionLines.map((line, index) => (
                <Text key={`ocr-debug-${index}`} style={styles.cardMuted}>
                  {line}
                </Text>
              ))}
              <TouchableOpacity
                style={[styles.secondaryButton, isDebugOcrRegressionRunning && styles.buttonDisabled]}
                onPress={() => void runDebugOcrImageRegressionSuite()}
                disabled={isDebugOcrRegressionRunning}
              >
                <Text style={styles.secondaryButtonText}>{isDebugOcrRegressionRunning ? "Test OCR immagini in corso..." : "Esegui OCR reale 5 screenshot"}</Text>
              </TouchableOpacity>
              {debugOcrImageRegressionLines.map((line, index) => (
                <Text key={`ocr-image-debug-${index}`} style={styles.cardMuted}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    );
  }

  function renderAIReview() {
    return (
      <ScrollView contentContainerStyle={screenContentStyle} keyboardShouldPersistTaps="handled">
        <Header title="Revisione estrazione" subtitle="Controlla i campi estratti e chiudi gli ultimi buchi." onBack={goBack} />

        {extractionMeta ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tx("Esito estrazione")}</Text>
            <Text style={styles.cardText}>{tx("Fonte")}: {tx(extractionSourceLabel(extractionMeta.source))}</Text>
            <Text style={styles.cardText}>{tx("Affidabilita' stimata")}: {Math.round(extractionMeta.confidence)}/100</Text>
            <Text style={styles.cardMuted}>{tx(extractionMeta.note)}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Prossima domanda")}</Text>
          <Text style={styles.cardText}>{tx(nextQuestion(form, validation))}</Text>
        </View>

        <IssueCard report={validation} />

        <View style={styles.previewBand}>
          <MetricTile label="Investimento" value={formatCurrency(liveResult.totalInvestment)} accent />
          <MetricTile label="Lavori" value={formatCurrency(liveResult.renovationCost)} />
          <MetricTile
            label={form.goal === "flip" ? "Margine %" : "Rendimento netto"}
            value={formatPercent(form.goal === "flip" ? liveResult.grossMarginPct : liveResult.netYieldPct)}
          />
        </View>

        <FormSections
          form={form}
          settings={settings}
          support={analysisSupport}
          updateField={updateField}
          verifiedMarketData={verifiedMarketData}
          isMarketDataLoading={isMarketDataLoading}
          marketDataError={marketDataError}
          onRefreshMarketData={() => void handleRefreshVerifiedMarketData({ force: true })}
          i18n={{
            updateLocalData: t("updateLocalData"),
            updatingLocalData: t("updatingLocalData"),
            noVerifiedData: t("noVerifiedData"),
          }}
        />

        <TouchableOpacity
          style={[styles.primaryButton, validation.errors.length > 0 && styles.buttonDisabled]}
          onPress={handleCalculate}
          disabled={validation.errors.length > 0}
        >
          <Text style={styles.primaryButtonText}>{t("calculate")}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderResult() {
    if (!result) return null;
    const support = buildAnalysisSupport(form, settings, analyses, verifiedMarketData);
    const featureSummary = buildPropertyFeatureSummary(form);

    return (
      <ScrollView contentContainerStyle={screenContentStyle} keyboardShouldPersistTaps="handled">
        <Header title="Risultato analisi" subtitle="Score, numeri chiave e confronto con il tuo archivio." onBack={goBack} />

        <View
          style={[
            styles.resultCard,
            result.color === "verde" ? styles.green : result.color === "giallo" ? styles.yellow : styles.red,
          ]}
        >
          <Text style={styles.resultTitle}>{tx(scoreColorLabel(result.color))}</Text>
          <Text style={styles.resultScore}>Score {result.score}/100</Text>
          <Text style={styles.resultSummary}>{tx(result.summary)}</Text>
          <Text style={styles.resultMicro}>
            {tx("Budget delta")}: {tx(result.totalInvestment > settings.maxBudget ? "oltre limite" : "entro limite")} • {formatCurrency(result.totalInvestment - settings.maxBudget)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Immobile")}</Text>
          <Text style={styles.cardText}>{buildPropertyDisplayTitle(form, analyses.length + 1)}</Text>
          <Text style={styles.cardMuted}>
            {formatLocationLabel(form)}
          </Text>
          <Text style={styles.cardMuted}>
            {form.propertyType || tx("Tipologia non indicata")} • {tx(conditionLabel(form.condition))} • {tx(renovationLabel(form.renovationLevel))}
          </Text>
          {featureSummary ? <Text style={styles.cardMuted}>{featureSummary}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Numeri chiave")}</Text>
          <Text style={styles.cardText}>{tx("Investimento totale")}: {formatCurrency(result.totalInvestment)}</Text>
          <Text style={styles.cardText}>{tx("Costo lavori")}: {formatCurrency(result.renovationCost)}</Text>
          <Text style={styles.cardText}>{tx("Costi accessori")}: {formatCurrency(result.accessoryCosts)}</Text>
          <Text style={styles.cardText}>{tx("Prezzo al mq")}: {formatCurrency(pricePerSqm(form) || 0)}</Text>
          {form.goal === "flip" ? (
            <>
              <Text style={styles.cardText}>{tx("Margine lordo")}: {formatCurrency(result.grossMargin)}</Text>
              <Text style={styles.cardText}>{tx("Margine %")}: {formatPercent(result.grossMarginPct)}</Text>
              {!toNumber(form.resalePrice) ? (
                <Text style={styles.cardMuted}>{tx("Prezzo rivendita auto-stimato")}: {formatCurrency(support.suggestedResalePrice)}</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.cardText}>{tx("Canone annuo")}: {formatCurrency(result.annualRent)}</Text>
              <Text style={styles.cardText}>{tx("Rendimento lordo")}: {formatPercent(result.grossYieldPct)}</Text>
              <Text style={styles.cardText}>{tx("Rendimento netto stimato")}: {formatPercent(result.netYieldPct)}</Text>
              {!toNumber(form.monthlyRent) ? (
                <Text style={styles.cardMuted}>{tx("Canone mensile auto-stimato")}: {formatCurrency(support.suggestedMonthlyRent)}</Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Benchmark area e mutuo")}</Text>
          <Text style={styles.cardText}>{tx("Benchmark zona")}: {formatCurrency(support.effectiveAreaPricePerSqm)}/mq</Text>
          <Text style={styles.cardText}>{tx("Valore medio stimato")}: {formatCurrency(support.effectiveEstimatedMarketValue)}</Text>
          <Text style={styles.cardText}>{tx("Delta vs richiesto")}: {formatPercent(support.priceGapPct)}</Text>
          <Text style={styles.cardMuted}>{tx(support.areaBenchmarkLabel)}</Text>
          {verifiedMarketData ? (
            <Text style={styles.cardMuted}>
              {tx("Fonti")}: {verifiedMarketData.areaSourceUrl} • {verifiedMarketData.ratesSourceUrl}
            </Text>
          ) : null}
          <Text style={styles.cardText}>{tx("Capitale mutuo stimato")}: {formatCurrency(support.mortgagePrincipal)}</Text>
          <Text style={styles.cardText}>{tx("Rata fisso")}: {formatCurrency(support.fixedMonthlyPayment)}/mese</Text>
          <Text style={styles.cardText}>{tx("Rata variabile")}: {formatCurrency(support.variableMonthlyPayment)}/mese</Text>
        </View>

        {bestAnalysis ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tx("Confronto rapido archivio")}</Text>
            <Text style={styles.cardText}>
              {tx("Migliore salvato")}: {buildPropertyDisplayTitle(bestAnalysis.form, 1)} • Score {bestAnalysis.result.score}/100
            </Text>
            <Text style={styles.cardMuted}>{tx(getPerformanceLabel(bestAnalysis))}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => openComparison(true)}>
              <Text style={styles.secondaryButtonText}>{tx("Apri confronto immobili")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSaveAnalysis()}>
          <Text style={styles.primaryButtonText}>{t("saveAnalysis")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={goBack}>
          <Text style={styles.secondaryButtonText}>{tx("Torna ai dati")}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderArchive() {
    const freeUsagePct = Math.max(0, Math.min(1, savedCount / FREE_PLAN_MAX_ANALYSES));
    const archiveHeader = (
      <View style={styles.archiveHeaderBlock}>
        <Header title="Archivio immobili" subtitle="Cronologia analisi, benchmark e accesso ai confronti." />
        <View style={[styles.planCard, isProUnlocked ? styles.planCardPro : styles.planCardFree]}>
          <View style={styles.planCardTopRow}>
            <View style={styles.planCardCopy}>
              <Text style={styles.planEyebrow}>{tx("Stato archivio")}</Text>
              <Text style={styles.planTitle}>{isProUnlocked ? tx("Piano Pro attivo") : tx("Piano Free")}</Text>
            </View>
            <View style={[styles.planBadge, isProUnlocked ? styles.planBadgePro : styles.planBadgeFree]}>
              <Text style={[styles.planBadgeText, isProUnlocked ? styles.planBadgeTextPro : styles.planBadgeTextFree]}>
                {isProUnlocked ? "PRO" : "FREE"}
              </Text>
            </View>
          </View>
          <Text style={styles.planBody}>
            {isProUnlocked
              ? tx("Salvataggi illimitati sbloccati. Il confronto puo' includere fino a 5 immobili.")
              : tx(`Salvataggi disponibili: ${freeRemainingSlots}/${FREE_PLAN_MAX_ANALYSES}`)}
          </Text>
          <View style={styles.planProgressTrack}>
            <View
              style={[
                styles.planProgressFill,
                isProUnlocked ? styles.planProgressFillPro : null,
                { width: `${Math.max(12, Math.round((isProUnlocked ? 1 : freeUsagePct) * 100))}%` },
              ]}
            />
          </View>
          <View style={styles.planMetaRow}>
            <View style={styles.planMetaChip}>
              <Text style={styles.planMetaText}>{tx(`Confronto fino a ${compareLimit} immobili`)}</Text>
            </View>
            <View style={styles.planMetaChip}>
              <Text style={styles.planMetaText}>{isProUnlocked ? tx("Upgrade completato") : tx("Upgrade disponibile")}</Text>
            </View>
          </View>
          {!isProUnlocked ? (
            <TouchableOpacity style={styles.secondaryButtonCompact} onPress={() => void handleOpenStripeCheckout()}>
              <Text style={styles.secondaryButtonText}>{tx("Sblocca Pro 2,49€ con Stripe")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.archiveActions}>
          <TouchableOpacity
            style={analyses.length >= 2 ? styles.primaryButtonCompact : styles.secondaryButtonCompact}
            onPress={() => openComparison()}
          >
            <Text style={analyses.length >= 2 ? styles.primaryButtonText : styles.secondaryButtonText}>{tx("Confronta immobili")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={analyses.length >= 2 ? styles.secondaryButtonCompact : styles.primaryButtonCompact}
            onPress={startManualAnalysis}
          >
            <Text style={analyses.length >= 2 ? styles.secondaryButtonText : styles.primaryButtonText}>{tx("Nuova analisi")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

    return (
      <FlatList
        style={styles.listScreen}
        data={archiveAnalyses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={archiveHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.cardTitle}>{tx("Archivio vuoto")}</Text>
            <Text style={styles.cardText}>{tx("Salva almeno un'analisi per visualizzare storico e confronti.")}</Text>
          </View>
        }
        contentContainerStyle={listContentStyle}
        renderItem={({ item, index }) => {
          const memory = getSavedMemory(item);
          const surface = scoreSurface(item.result.color);
          return (
            <TouchableOpacity
              style={[styles.archiveItem, { backgroundColor: surface.backgroundColor, borderColor: surface.borderColor }]}
              onPress={() => {
                setSelectedAnalysis(item);
                setHistory(["archive", "detail"]);
              }}
            >
              <View style={styles.archiveMain}>
                <Text style={styles.archiveTitle} numberOfLines={2}>
                  {buildPropertyDisplayTitle(item.form, index + 1)}
                </Text>
                <Text style={styles.archiveSub} numberOfLines={1}>
                  {`#${index + 1}`}
                </Text>
                <Text style={styles.archiveSub} numberOfLines={2}>
                  {formatLocationLabel(item.form)}
                </Text>
                <Text style={styles.archiveSub} numberOfLines={1}>
                  {tx(goalLabel(item.form.goal))} • {tx(scoreColorLabel(item.result.color))}
                </Text>
                <Text style={styles.archiveSub} numberOfLines={1}>
                  {tx("Investimento totale")}: {formatCurrency(item.result.totalInvestment)} • {tx(getPerformanceLabel(item))}
                </Text>
                <Text style={styles.archiveMemory} numberOfLines={2}>
                  {tx("Memoria confronto")}: {formatOptionalCurrency(memory.askingPrice)} • {Math.round(memory.sqm || 0) || "-"} mq •{" "}
                  {formatOptionalCurrency(memory.pricePerSqm)}/mq
                </Text>
                <Text style={styles.archiveMemory} numberOfLines={2}>
                  {tx("Mutuo memoria")}: {formatOptionalPercent(memory.downPaymentPct)} ({formatOptionalCurrency(memory.downPaymentAmount)}) •{" "}
                  {formatOptionalPercent(memory.fixedRatePct)} / {formatOptionalPercent(memory.variableRatePct)}
                </Text>
                <Text style={styles.archiveSub} numberOfLines={1}>
                  {tx("Salvato il")} {formatDate(item.createdAt)}
                </Text>
              </View>
              <View style={styles.archiveRight}>
                <View style={[styles.archiveScoreBadge, { backgroundColor: surface.accentColor }]}>
                  <Text style={styles.archiveScoreValue}>{item.result.score}</Text>
                </View>
                <Text style={[styles.archiveScoreLabel, { color: surface.textColor }]} numberOfLines={2}>
                  {tx(scoreColorLabel(item.result.color))}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    );
  }

  function renderDetail() {
    if (!selectedAnalysis) return null;
    const support = buildAnalysisSupport(selectedAnalysis.form, settings, analyses, null);
    const memory = getSavedMemory(selectedAnalysis);
    const cleanedNotes = cleanArchiveNotes(selectedAnalysis.form.notes);
    const featureSummary = buildPropertyFeatureSummary(selectedAnalysis.form);

    return (
      <ScrollView contentContainerStyle={screenContentStyle} keyboardShouldPersistTaps="handled">
        <Header title="Dettaglio analisi" subtitle="Contesto, outcome e confronto col resto del portafoglio." onBack={goBack} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{buildPropertyDisplayTitle(selectedAnalysis.form, 1)}</Text>
          <Text style={styles.cardText}>
            {formatLocationLabel(selectedAnalysis.form)}
          </Text>
          <Text style={styles.cardMuted}>
            {selectedAnalysis.form.propertyType || tx("Tipologia non indicata")} • {tx(conditionLabel(selectedAnalysis.form.condition))}
          </Text>
          {featureSummary ? <Text style={styles.cardMuted}>{featureSummary}</Text> : null}
          <Text style={styles.cardText}>{tx("Prezzo richiesto")}: {formatCurrency(toNumber(selectedAnalysis.form.askingPrice))}</Text>
          <Text style={styles.cardText}>{tx("MQ")}: {selectedAnalysis.form.sqm || "-"}</Text>
          <Text style={styles.cardText}>{tx("Obiettivo")}: {tx(goalLabel(selectedAnalysis.form.goal))}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Esito")}</Text>
          <Text style={[styles.scoreChip, { color: scoreColorHex(selectedAnalysis.result.color) }]}>
            {tx(scoreColorLabel(selectedAnalysis.result.color))} • Score {selectedAnalysis.result.score}/100
          </Text>
          <Text style={styles.cardText}>{tx(selectedAnalysis.result.summary)}</Text>
          <Text style={styles.cardMuted}>{tx(getPerformanceLabel(selectedAnalysis))}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Benchmark area e mutuo")}</Text>
          <Text style={styles.cardText}>{tx("Benchmark zona")}: {formatCurrency(support.effectiveAreaPricePerSqm)}/mq</Text>
          <Text style={styles.cardText}>{tx("Valore medio stimato")}: {formatCurrency(support.effectiveEstimatedMarketValue)}</Text>
          <Text style={styles.cardText}>{tx("Delta vs richiesto")}: {formatPercent(support.priceGapPct)}</Text>
          <Text style={styles.cardText}>{tx("Rata fisso")}: {formatCurrency(support.fixedMonthlyPayment)}/mese</Text>
          <Text style={styles.cardText}>{tx("Rata variabile")}: {formatCurrency(support.variableMonthlyPayment)}/mese</Text>
          <Text style={styles.cardMuted}>{tx(support.areaBenchmarkLabel)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Memoria immobile")}</Text>
          <Text style={styles.cardText}>
            {tx("Prezzo / mq")}: {formatOptionalCurrency(memory.askingPrice)} • {Math.round(memory.sqm || 0) || "-"} mq • {formatOptionalCurrency(memory.pricePerSqm)}/mq
          </Text>
          <Text style={styles.cardText}>{tx("Benchmark zona")}: {formatOptionalCurrency(memory.areaBenchmarkPerSqm)}/mq</Text>
          <Text style={styles.cardText}>
            {tx("Mutuo memoria")}: {formatOptionalPercent(memory.downPaymentPct)} ({formatOptionalCurrency(memory.downPaymentAmount)}) • {formatOptionalPercent(memory.fixedRatePct)} /{" "}
            {formatOptionalPercent(memory.variableRatePct)}
          </Text>
          <Text style={styles.cardText}>
            {tx("Rate stimate")}: {formatOptionalCurrency(memory.fixedMonthlyPayment)}/mese • {formatOptionalCurrency(memory.variableMonthlyPayment)}/mese
          </Text>
          <Text style={styles.cardMuted}>
            {tx("Investimento totale")}: {formatCurrency(memory.totalInvestment)} • {tx(getPerformanceLabel(selectedAnalysis))}
          </Text>
        </View>

        {cleanedNotes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tx("Note")}</Text>
            <Text style={styles.cardText}>{cleanedNotes}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.secondaryButton} onPress={() => openComparison()}>
          <Text style={styles.secondaryButtonText}>{tx("Confronta con archivio")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButtonDanger} onPress={() => void handleDeleteSelected()}>
          <Text style={styles.secondaryButtonDangerText}>{tx("Elimina analisi")}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderCompare() {
    if (compareSet.length < 2) {
      return (
        <ScrollView contentContainerStyle={screenContentStyle}>
          <Header title="Confronto immobili" subtitle="Serve almeno una seconda analisi salvata." onBack={goBack} />
          <View style={styles.card}>
            <Text style={styles.cardText}>{tx("Salva almeno due immobili per vedere il confronto.")}</Text>
          </View>
        </ScrollView>
      );
    }

    const maxInvestment = Math.max(...compareSet.map((item) => item.result.totalInvestment), 1);
    const maxScore = 100;
    const maxPerformance = Math.max(...compareSet.map((item) => Math.max(Math.abs(getPerformanceValue(item)), 1)));
    const bestByInvestment = [...compareSet].sort((a, b) => a.result.totalInvestment - b.result.totalInvestment)[0];
    const comparePalette = compareSet.map((_, index) => COMPARE_CARD_PALETTE[index % COMPARE_CARD_PALETTE.length]);
    const compareEntries = compareSet.map((item, index) => {
      const palette = comparePalette[index];
      const locationLabel =
        formatLocationLabel({
          city: item.form.city,
          province: item.form.province,
          zone: item.form.zone,
          country: item.form.country,
        }) || item.form.propertyType || tx("Immobile");
      return {
        item,
        index,
        palette,
        locationLabel,
        performance: getPerformanceValue(item),
        support: buildAnalysisSupport(item.form, settings, analyses, null),
        title: buildPropertyDisplayTitle(item.form, index + 1),
      };
    });
    const headToHeadEntries = compareEntries.slice(0, 2);
    const headToHeadRows = [
      {
        label: "Prezzo richiesto",
        render: (entry: (typeof compareEntries)[number]) => formatCurrency(toNumber(entry.item.form.askingPrice)),
      },
      {
        label: "MQ / piano",
        render: (entry: (typeof compareEntries)[number]) =>
          `${Math.round(toNumber(entry.item.form.sqm)) || "-"} mq • ${floorLabelForDescription(entry.item.form.floor)}`,
      },
      {
        label: "Camere / bagni",
        render: (entry: (typeof compareEntries)[number]) =>
          `${Math.round(toNumber(entry.item.form.bedrooms)) || "-"} camere • ${Math.round(toNumber(entry.item.form.bathrooms)) || "-"} bagni`,
      },
      {
        label: "Prezzo / mq",
        render: (entry: (typeof compareEntries)[number]) => `${formatCurrency(pricePerSqm(entry.item.form) || 0)}/mq`,
      },
      {
        label: "Investimento totale",
        render: (entry: (typeof compareEntries)[number]) => formatCurrency(entry.item.result.totalInvestment),
      },
      {
        label: "Output atteso",
        render: (entry: (typeof compareEntries)[number]) =>
          entry.item.form.goal === "flip"
            ? `Rivendita ${formatCurrency(toNumber(entry.item.form.resalePrice) || entry.support.suggestedResalePrice)}`
            : `Affitto ${formatCurrency(toNumber(entry.item.form.monthlyRent) || entry.support.suggestedMonthlyRent)}/mese`,
      },
      {
        label: "Margine / rendimento",
        render: (entry: (typeof compareEntries)[number]) =>
          entry.item.form.goal === "flip"
            ? `${formatPercent(entry.item.result.grossMarginPct)} margine`
            : `${formatPercent(entry.item.result.netYieldPct)} netto`,
      },
      {
        label: "Rata fisso",
        render: (entry: (typeof compareEntries)[number]) => `${formatCurrency(entry.support.fixedMonthlyPayment)}/mese`,
      },
      {
        label: "Benchmark zona",
        render: (entry: (typeof compareEntries)[number]) => `${formatCurrency(entry.support.effectiveAreaPricePerSqm)}/mq`,
      },
      {
        label: "Ascensore",
        render: (entry: (typeof compareEntries)[number]) => (entry.item.form.hasElevator ? "Si" : "No"),
      },
      {
        label: "Extra",
        render: (entry: (typeof compareEntries)[number]) => buildPropertyAccessorySummary(entry.item.form) || "-",
      },
    ];

    return (
      <ScrollView contentContainerStyle={screenContentStyle} keyboardShouldPersistTaps="handled">
        <Header title="Confronto immobili" subtitle="Testa a testa immediato prima dei dettagli completi." onBack={goBack} />

        <View style={styles.metricsGrid}>
          <MetricTile label="Miglior score" value={`${compareSet[0].result.score}/100`} accent />
          <MetricTile label="Investimento min" value={formatCurrency(bestByInvestment.result.totalInvestment)} />
          <MetricTile label="Immobili" value={String(compareSet.length)} />
          <MetricTile label="Top perf." value={formatPercent(getPerformanceValue(compareSet[0]))} />
        </View>

        {!isProUnlocked && hiddenCompareCount > 0 ? (
          <View style={[styles.card, styles.warningCard]}>
            <Text style={styles.cardTitle}>Confronto Free limitato</Text>
            <Text style={styles.cardText}>
              Stai vedendo i 2 immobili principali. Sblocca Pro per confrontare anche gli altri {hiddenCompareCount} immobili salvati.
            </Text>
          </View>
        ) : null}

        {headToHeadEntries.length >= 2 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Testa a testa immediato</Text>
            <Text style={styles.cardMuted}>Le due schede principali sono allineate riga per riga per leggere subito differenze reali.</Text>

            <View style={styles.compareImmediateHeader}>
              {headToHeadEntries.map((entry) => (
                <View
                  key={`${entry.item.id}-head`}
                  style={[
                    styles.compareImmediateHeaderCard,
                    { backgroundColor: entry.palette.backgroundColor, borderColor: entry.palette.borderColor },
                  ]}
                >
                  <Text style={[styles.compareImmediateHeaderLabel, { color: entry.palette.accentColor }]} numberOfLines={2}>
                    {entry.title}
                  </Text>
                  <Text style={[styles.compareImmediateHeaderScore, { color: entry.palette.accentColor }]}>{entry.item.result.score}/100</Text>
                  <Text style={[styles.compareImmediateHeaderMeta, { color: entry.palette.textColor }]} numberOfLines={2}>
                    {entry.locationLabel}
                  </Text>
                  <Text style={[styles.compareImmediateHeaderSummary, { color: entry.palette.textColor }]}>
                    {entry.item.form.goal === "flip"
                      ? `Margine ${formatPercent(entry.item.result.grossMarginPct)}`
                      : `Yield ${formatPercent(entry.item.result.netYieldPct)}`}
                  </Text>
                </View>
              ))}
            </View>

            {headToHeadRows.map((row) => (
              <View key={row.label} style={styles.compareImmediateMetric}>
                <Text style={styles.compareImmediateMetricLabel}>{row.label}</Text>
                <View style={styles.compareImmediateMetricValues}>
                  {headToHeadEntries.map((entry) => (
                    <View
                      key={`${entry.item.id}-${row.label}`}
                      style={[
                        styles.compareImmediateValueCard,
                        { backgroundColor: entry.palette.backgroundColor, borderColor: entry.palette.borderColor },
                      ]}
                    >
                      <Text style={[styles.compareImmediateValueText, { color: entry.palette.textColor }]}>{row.render(entry)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.comparePropertyGrid}>
          {compareEntries.map((entry) => (
            <View
              key={`${entry.item.id}-summary`}
              style={[
                styles.comparePropertyCard,
                { backgroundColor: entry.palette.backgroundColor, borderColor: entry.palette.borderColor },
              ]}
            >
              <View style={styles.comparePropertyTop}>
                <Text style={[styles.comparePropertyBadge, { backgroundColor: entry.palette.accentColor }]}>
                  {tx(goalLabel(entry.item.form.goal))}
                </Text>
                <Text style={[styles.comparePropertyScore, { color: entry.palette.accentColor }]}>{entry.item.result.score}/100</Text>
              </View>
              <Text style={[styles.comparePropertyTitle, { color: entry.palette.textColor }]}>{entry.title}</Text>
              <Text style={styles.comparePropertyMeta}>{entry.locationLabel}</Text>
              <Text style={[styles.comparePropertyLine, { color: entry.palette.textColor }]}>
                {tx("Investimento totale")}: {formatCurrency(entry.item.result.totalInvestment)}
              </Text>
              <Text style={[styles.comparePropertyLine, { color: entry.palette.textColor }]}>
                {entry.item.form.goal === "flip" ? tx("Margine %") : tx("Rendimento netto stimato")}: {formatPercent(entry.performance)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Score comparato")}</Text>
          {compareEntries.map((entry) => (
            <BarRow
              key={`${entry.item.id}-score`}
              label={entry.title}
              valueLabel={`${entry.item.result.score}/100`}
              ratio={entry.item.result.score / maxScore}
              color={entry.palette.accentColor}
            />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Investimento totale")}</Text>
          {compareEntries.map((entry) => (
            <BarRow
              key={`${entry.item.id}-investment`}
              label={entry.title}
              valueLabel={formatCurrency(entry.item.result.totalInvestment)}
              ratio={entry.item.result.totalInvestment / maxInvestment}
              color={entry.palette.accentColor}
            />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Margine / rendimento")}</Text>
          {compareEntries.map((entry) => {
            return (
              <BarRow
                key={`${entry.item.id}-performance`}
                label={entry.title}
                valueLabel={formatPercent(entry.performance)}
                ratio={Math.abs(entry.performance) / maxPerformance}
                color={entry.palette.accentColor}
              />
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Memoria confronto immobili")}</Text>
          {compareEntries.map((entry) => {
            const memory = getSavedMemory(entry.item);
            return (
              <View
                key={`${entry.item.id}-memory`}
                style={[
                  styles.compareMemoryItem,
                  { backgroundColor: entry.palette.backgroundColor, borderColor: entry.palette.borderColor },
                ]}
              >
                <Text style={[styles.compareMemoryTitle, { color: entry.palette.textColor }]}>
                  {entry.title}
                </Text>
                <Text style={styles.compareMemoryLine}>
                  {tx("Prezzo / mq")}: {formatOptionalCurrency(memory.askingPrice)} • {Math.round(memory.sqm || 0) || "-"} mq •{" "}
                  {formatOptionalCurrency(memory.pricePerSqm)}/mq
                </Text>
                <Text style={styles.compareMemoryLine}>
                  {tx("Mutuo memoria")}: {formatOptionalPercent(memory.downPaymentPct)} ({formatOptionalCurrency(memory.downPaymentAmount)}) •{" "}
                  {formatOptionalPercent(memory.fixedRatePct)} / {formatOptionalPercent(memory.variableRatePct)}
                </Text>
                <Text style={styles.compareMemoryLine}>
                  {tx("Rate stimate")}: {formatOptionalCurrency(memory.fixedMonthlyPayment)}/mese • {formatOptionalCurrency(memory.variableMonthlyPayment)}/mese
                </Text>
                <Text style={styles.compareMemoryLineMuted}>
                  {tx("Investimento totale")}: {formatCurrency(memory.totalInvestment)} • {tx(getPerformanceLabel(entry.item))}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  function renderSettings() {
    const updateSetting = (key: keyof InvestorSettings, value: string) => {
      const num = Number(value.replace(",", "."));
      const normalized = Number.isFinite(num) ? Math.max(0, num) : 0;
      const next = { ...settings, [key]: normalized };
      if (key === "maxBudget") {
        setBudgetSliderDraft(normalized);
      }
      void persistSettings(next);
    };

    const updateAISetting = (key: keyof AISettings, value: string) => {
      const next = { ...aiSettings, [key]: value };
      void persistAISettings(next);
    };

    const updateBillingSetting = <K extends keyof BillingSettings>(key: K, value: BillingSettings[K]) => {
      const next: BillingSettings = { ...billingSettings, [key]: value };
      void persistBillingSettings(next);
    };

    const budgetMin = 50000;
    const budgetMax = 1000000;
    const budgetCurrent = Math.max(budgetMin, Math.min(budgetMax, budgetSliderDraft || settings.maxBudget || budgetMin));
    const budgetRatio = liveResult.totalInvestment > 0 ? liveResult.totalInvestment / Math.max(1, budgetCurrent) : 0;
    const budgetFill = Math.max(6, Math.min(100, budgetRatio * 100));
    const budgetSafePad = Math.max(0, Math.min(14, Math.max(insets.left, insets.right)));
    const budgetSliderWrapStyle = [styles.budgetSliderWrap, { paddingLeft: 12 + budgetSafePad, paddingRight: 12 + budgetSafePad }];

    const commitBudgetSlider = (raw: number) => {
      const stepped = Math.round(raw / 5000) * 5000;
      const clamped = Math.max(budgetMin, Math.min(budgetMax, stepped));
      setBudgetSliderDraft(clamped);
      const next = { ...settings, maxBudget: clamped };
      void persistSettings(next);
    };

    return (
      <ScrollView contentContainerStyle={screenContentStyle} keyboardShouldPersistTaps="handled">
        <Header title={t("settingsTitle")} subtitle={t("settingsSubtitle")} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("investorParams")}</Text>
          <Text style={styles.cardMuted}>{tx("Nessun preset statico: usa \"Aggiorna dati locali verificati\" nella scheda immobile per prezzi/tassi da fonti web.")}</Text>
          <Text style={styles.label}>{t("languageTitle")}</Text>
          <View style={styles.pillRow}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Pill key={lang} label={lang.toUpperCase()} selected={language === lang} onPress={() => void persistLanguage(lang)} />
            ))}
          </View>
          <Field label="Margine minimo rivendita (%)" value={String(settings.minFlipMarginPct)} onChangeText={(value) => updateSetting("minFlipMarginPct", value)} keyboardType="numeric" />
          <Field label="Rendimento minimo affitto (%)" value={String(settings.minRentYieldPct)} onChangeText={(value) => updateSetting("minRentYieldPct", value)} keyboardType="numeric" />
          <Field label="Budget massimo (€)" value={String(settings.maxBudget)} onChangeText={(value) => updateSetting("maxBudget", value)} keyboardType="numeric" />
          <View style={budgetSliderWrapStyle}>
            <View style={styles.budgetSliderTop}>
              <Text style={styles.budgetSliderLabel}>{tx("Budget rapido a scorrimento")}</Text>
              <Text style={styles.budgetSliderValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                {formatCurrency(budgetCurrent)}
              </Text>
            </View>
            <Slider
              minimumValue={budgetMin}
              maximumValue={budgetMax}
              step={5000}
              value={budgetCurrent}
              onValueChange={(value) => setBudgetSliderDraft(Math.round(value / 5000) * 5000)}
              onSlidingComplete={commitBudgetSlider}
              minimumTrackTintColor="#c53030"
              maximumTrackTintColor="#f3d3d3"
              thumbTintColor="#9b1c1c"
              style={styles.budgetSlider}
            />
            <View style={styles.budgetSliderScale}>
              <Text style={styles.budgetScaleText}>50k</Text>
              <Text style={styles.budgetScaleText}>1M</Text>
            </View>
            <Text style={styles.budgetHint}>{tx("Soglia rispetto alla bozza corrente")} ({formatCurrency(liveResult.totalInvestment)}):</Text>
            <View style={styles.budgetPressureTrack}>
              <View
                style={[
                  styles.budgetPressureFill,
                  {
                    width: `${budgetFill}%`,
                    backgroundColor: budgetRatio > 1 ? "#9b1c1c" : budgetRatio > 0.85 ? "#c53030" : "#e57373",
                  },
                ]}
              />
            </View>
            <Text style={[styles.budgetPressureText, budgetRatio > 1 && styles.budgetPressureTextDanger]}>
              {budgetRatio > 1
                ? tx(`Sforamento stimato: ${formatCurrency(liveResult.totalInvestment - budgetCurrent)}`)
                : tx(`Margine disponibile: ${formatCurrency(budgetCurrent - liveResult.totalInvestment)}`)}
            </Text>
          </View>
          <Field label="Benchmark area fallback €/mq" value={String(settings.defaultAreaPricePerSqm)} onChangeText={(value) => updateSetting("defaultAreaPricePerSqm", value)} keyboardType="numeric" />
          <Field label="Imprevisti standard (%)" value={String(settings.defaultUnexpectedPct)} onChangeText={(value) => updateSetting("defaultUnexpectedPct", value)} keyboardType="numeric" />
          <Field label="Lavori leggeri €/mq" value={String(settings.lightRenovationPerSqm)} onChangeText={(value) => updateSetting("lightRenovationPerSqm", value)} keyboardType="numeric" />
          <Field label="Lavori medi €/mq" value={String(settings.mediumRenovationPerSqm)} onChangeText={(value) => updateSetting("mediumRenovationPerSqm", value)} keyboardType="numeric" />
          <Field label="Lavori pesanti €/mq" value={String(settings.heavyRenovationPerSqm)} onChangeText={(value) => updateSetting("heavyRenovationPerSqm", value)} keyboardType="numeric" />
          <Field label="Commissione agenzia standard (%)" value={String(settings.defaultAgencyPct)} onChangeText={(value) => updateSetting("defaultAgencyPct", value)} keyboardType="numeric" />
          <Field label="Imposte e notaio standard (€)" value={String(settings.defaultTaxesAndNotary)} onChangeText={(value) => updateSetting("defaultTaxesAndNotary", value)} keyboardType="numeric" />
          <Field label="Anticipo mutuo default (%)" value={String(settings.defaultDownPaymentPct)} onChangeText={(value) => updateSetting("defaultDownPaymentPct", value)} keyboardType="numeric" />
          <Field label="Durata mutuo default (anni)" value={String(settings.defaultMortgageYears)} onChangeText={(value) => updateSetting("defaultMortgageYears", value)} keyboardType="numeric" />
          <Field label="Tasso fisso default (%)" value={String(settings.defaultFixedRatePct)} onChangeText={(value) => updateSetting("defaultFixedRatePct", value)} keyboardType="numeric" />
          <Field label="Tasso variabile default (%)" value={String(settings.defaultVariableRatePct)} onChangeText={(value) => updateSetting("defaultVariableRatePct", value)} keyboardType="numeric" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("Piano e pagamenti")}</Text>
          <View style={styles.settingsStatusRow}>
            <View style={[styles.settingsStatusBadge, isProUnlocked ? styles.settingsStatusBadgePro : styles.settingsStatusBadgeFree]}>
              <Text style={[styles.settingsStatusBadgeText, isProUnlocked ? styles.settingsStatusBadgeTextPro : styles.settingsStatusBadgeTextFree]}>
                {isProUnlocked ? "PRO" : "FREE"}
              </Text>
            </View>
            <View style={styles.settingsStatusChip}>
              <Text style={styles.settingsStatusChipText}>{tx(`Confronto fino a ${compareLimit} immobili`)}</Text>
            </View>
          </View>
          <Text style={styles.cardText}>
            {isProUnlocked
              ? tx("Stato: Pro attivo (salvataggi illimitati).")
              : tx(`Stato: Free (${Math.min(savedCount, FREE_PLAN_MAX_ANALYSES)}/${FREE_PLAN_MAX_ANALYSES} immobili salvati).`)}
          </Text>
          <Text style={styles.cardMuted}>
            {tx("Configura Stripe Checkout a 2,49€ con success_url: affaresubito://billing/success?pro=1")}
          </Text>
          <Field
            label="Stripe Checkout URL Pro"
            value={billingSettings.stripeCheckoutUrl}
            onChangeText={(value) => updateBillingSetting("stripeCheckoutUrl", value)}
            placeholder="https://buy.stripe.com/..."
          />
          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleOpenStripeCheckout()}>
            <Text style={styles.primaryButtonText}>{tx(isProUnlocked ? "Gestisci abbonamento Stripe" : "Sblocca Pro 2,49€ con Stripe")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tx("AI reale")}</Text>
          <View style={styles.settingsStatusRow}>
            <View
              style={[
                styles.settingsStatusBadge,
                aiSettings.apiKey.trim() ? styles.settingsStatusBadgeInfo : styles.settingsStatusBadgeFree,
              ]}
            >
              <Text
                style={[
                  styles.settingsStatusBadgeText,
                  aiSettings.apiKey.trim() ? styles.settingsStatusBadgeTextInfo : styles.settingsStatusBadgeTextFree,
                ]}
              >
                {aiSettings.apiKey.trim() ? tx("API attiva") : tx("API assente")}
              </Text>
            </View>
            <View style={styles.settingsStatusChip}>
              <Text style={styles.settingsStatusChipText}>{tx(aiSettings.model || "gpt-4.1-mini")}</Text>
            </View>
          </View>
          <Field
            label="API key"
            value={aiSettings.apiKey}
            onChangeText={(value) => updateAISetting("apiKey", value)}
            secureTextEntry
            helperText="Salvata localmente sul device. Per produzione serve un backend proxy."
          />
          <Field label="Modello" value={aiSettings.model} onChangeText={(value) => updateAISetting("model", value)} placeholder="gpt-4.1-mini" />
          <Text style={styles.cardMuted}>{tx("L'app usa l'endpoint ufficiale Responses API con input testuale e immagine base64.")}</Text>
        </View>
      </ScrollView>
    );
  }

  function renderCurrentScreen() {
    if (screen === "home") return renderHome();
    if (screen === "manualForm") return renderManualForm();
    if (screen === "aiInput") return renderAIInput();
    if (screen === "aiReview") return renderAIReview();
    if (screen === "result") return renderResult();
    if (screen === "archive") return renderArchive();
    if (screen === "detail") return renderDetail();
    if (screen === "compare") return renderCompare();
    return renderSettings();
  }

  const tabItems: Array<{ key: MainTab; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
    { key: "home", label: t("homeTab"), icon: "home" },
    { key: "analyze", label: t("analyzeTab"), icon: "analytics" },
    { key: "archive", label: t("archiveTab"), icon: "inventory-2" },
    { key: "settings", label: t("settingsTab"), icon: "settings" },
  ];

  return (
    <TranslationContext.Provider value={tx}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.canvas}>
          <View pointerEvents="none" style={styles.orbOne} />
          <View pointerEvents="none" style={styles.orbTwo} />
          <View pointerEvents="none" style={styles.orbThree} />
          <View pointerEvents="none" style={styles.beamTop} />
          <View pointerEvents="none" style={styles.beamBottom} />
          <View key={screen} style={styles.contentFrame}>
            {renderCurrentScreen()}
          </View>
          {showFloatingMic ? (
            <TouchableOpacity
              style={[
                floatingMicStyle,
                (voiceGuideActive || freeListingMode || isSpeechListening || isAssistantSpeaking) && styles.floatingMicButtonActive,
              ]}
              onPress={() => void handleFloatingMicToggle()}
            >
              <MaterialIcons
                name={freeListingMode ? "graphic-eq" : "keyboard-voice"}
                size={24}
                color={voiceGuideActive || freeListingMode || isSpeechListening || isAssistantSpeaking ? "#fff7ea" : "#9b1c1c"}
              />
            </TouchableOpacity>
          ) : null}
          {showTabBar ? (
            <View style={tabBarStyle}>
              {tabItems.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.tabButton, activeTab === item.key && styles.tabButtonActive]}
                  onPress={() => openTab(item.key)}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={18}
                    style={[styles.tabIcon, activeTab === item.key && styles.tabIconActive]}
                  />
                  <Text
                    style={[styles.tabLabel, activeTab === item.key && styles.tabLabelActive]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.84}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </TranslationContext.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f6efe4",
  },
  canvas: {
    flex: 1,
    backgroundColor: "#f6efe4",
  },
  orbOne: {
    position: "absolute",
    top: -74,
    right: -28,
    width: 236,
    height: 236,
    borderRadius: 118,
    backgroundColor: "#f1c77f",
    opacity: 0.22,
  },
  orbTwo: {
    position: "absolute",
    bottom: 124,
    left: -62,
    width: 198,
    height: 198,
    borderRadius: 99,
    backgroundColor: "#0f4c5c",
    opacity: 0.09,
  },
  orbThree: {
    position: "absolute",
    top: 260,
    right: -56,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#c06b3f",
    opacity: 0.08,
  },
  beamTop: {
    position: "absolute",
    top: 104,
    left: -20,
    right: 46,
    height: 1,
    backgroundColor: "#ead8bf",
    opacity: 0.7,
    transform: [{ rotate: "-10deg" }],
  },
  beamBottom: {
    position: "absolute",
    bottom: 172,
    left: 120,
    right: -24,
    height: 1,
    backgroundColor: "#d5e1de",
    opacity: 0.7,
    transform: [{ rotate: "12deg" }],
  },
  contentFrame: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 110,
  },
  listScreen: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 22,
    padding: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#eadbc7",
    backgroundColor: "rgba(255, 250, 243, 0.94)",
    overflow: "hidden",
    shadowColor: "#7a5e3a",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 4,
  },
  headerGlow: {
    position: "absolute",
    top: -42,
    right: -24,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#f3d9a9",
    opacity: 0.38,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTopSpacer: {
    width: 92,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#f5ecde",
    borderWidth: 1,
    borderColor: "#e5d5be",
  },
  backText: {
    color: "#0f4c5c",
    fontWeight: "700",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#123e4b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: "#0f4c5c",
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  headerBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: "#f2c166",
  },
  headerBadgeText: {
    color: "#fff7ea",
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 1.2,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  headerAccentBar: {
    width: 5,
    height: 66,
    borderRadius: 999,
    backgroundColor: "#d4b078",
    marginRight: 14,
    marginTop: 4,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: "#14213d",
    marginBottom: 8,
  },
  headerSubtitle: {
    color: "#61584b",
    fontSize: 15,
    lineHeight: 23,
  },
  heroCard: {
    backgroundColor: "#16394b",
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "#2c5a69",
    marginBottom: 20,
    shadowColor: "#102935",
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 20,
    elevation: 8,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  heroMetaPill: {
    backgroundColor: "rgba(255, 247, 234, 0.12)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 247, 234, 0.18)",
  },
  heroMetaPillWarm: {
    backgroundColor: "#f5e8d3",
    borderColor: "#f5e8d3",
  },
  heroMetaPillText: {
    color: "#fff7ea",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroMetaPillTextWarm: {
    color: "#8f5d1e",
  },
  heroEyebrow: {
    color: "#f2c166",
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 1.4,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#fffaf2",
    marginBottom: 10,
  },
  heroText: {
    color: "#d0ddd8",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  heroInsightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
    marginBottom: 8,
  },
  heroInsightCard: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: 10,
  },
  heroInsightCardWide: {
    width: "100%",
  },
  heroInsightLabel: {
    color: "#9dc0c8",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroInsightValue: {
    color: "#fffaf2",
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "800",
    marginBottom: 3,
  },
  heroInsightMeta: {
    color: "#d0ddd8",
    fontSize: 13,
    lineHeight: 19,
  },
  heroActions: {
    gap: 10,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
    marginBottom: 10,
  },
  metricTile: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  metricTileCard: {
    minHeight: 112,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#eadbc7",
    backgroundColor: "rgba(255, 250, 243, 0.96)",
    shadowColor: "#74583a",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 3,
    justifyContent: "space-between",
  },
  metricTileCardAccent: {
    backgroundColor: "#0f4c5c",
    borderColor: "#0f4c5c",
    shadowColor: "#0f4c5c",
    shadowOpacity: 0.22,
  },
  metricLabel: {
    color: "#73685a",
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 18,
  },
  metricLabelAccent: {
    color: "#d5e7e2",
  },
  metricValue: {
    color: "#14213d",
    fontWeight: "800",
    fontSize: 24,
    lineHeight: 30,
  },
  metricValueAccent: {
    color: "#fff7ea",
  },
  card: {
    backgroundColor: "rgba(255, 250, 243, 0.96)",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eadbc7",
    marginBottom: 16,
    shadowColor: "#74583a",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 3,
  },
  successCard: {
    backgroundColor: "#f4fbf6",
    borderColor: "#bfdcc7",
  },
  warningCard: {
    backgroundColor: "#fff4e8",
    borderColor: "#efc9a2",
  },
  noticeCard: {
    backgroundColor: "#fff8ee",
    borderColor: "#eadbc7",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#14213d",
    marginBottom: 10,
  },
  cardText: {
    color: "#2b2a28",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  cardMuted: {
    color: "#746b60",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  helperText: {
    marginTop: 6,
    color: "#8a8174",
    fontSize: 12,
  },
  segmentCard: {
    backgroundColor: "#f2e7d5",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e1d2ba",
  },
  segmentTitle: {
    fontWeight: "800",
    color: "#14213d",
    marginBottom: 10,
  },
  acquisitionButtonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  acquisitionButton: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  acquisitionButtonActive: {
    transform: [{ translateY: -2 }],
  },
  acquisitionButtonText: {
    backgroundColor: "#fffaf3",
    color: "#544b41",
    textAlign: "center",
    fontWeight: "800",
    lineHeight: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#deceb8",
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 68,
  },
  acquisitionButtonTextActive: {
    backgroundColor: "#0f4c5c",
    borderColor: "#0f4c5c",
    color: "#fff7ea",
  },
  acquisitionMethodHint: {
    marginTop: 4,
    color: "#5f574b",
    lineHeight: 20,
  },
  previewBand: {
    marginBottom: 6,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    color: "#3c342c",
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#fffdf9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddceb9",
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#111827",
  },
  textAreaInput: {
    minHeight: 120,
  },
  textArea: {
    minHeight: 190,
    backgroundColor: "#fffefb",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d9cdb9",
    padding: 14,
    color: "#111827",
    marginBottom: 16,
  },
  textAreaCompact: {
    minHeight: 110,
    backgroundColor: "#fffefb",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d9cdb9",
    padding: 12,
    color: "#111827",
    marginBottom: 10,
  },
  voiceGuideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#efc1c1",
    backgroundColor: "#fff5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: {
    backgroundColor: "#9b1c1c",
    borderColor: "#9b1c1c",
  },
  voiceGuidePanel: {
    marginTop: 8,
    backgroundColor: "#fbf5ea",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#deceb8",
    padding: 12,
  },
  coachCard: {
    backgroundColor: "#fbf5ea",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#deceb8",
    padding: 12,
    marginBottom: 12,
  },
  coachMessages: {
    gap: 8,
    marginBottom: 10,
  },
  coachBubble: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  coachBubbleAssistant: {
    backgroundColor: "#fffefb",
    borderColor: "#d9cdb9",
  },
  coachBubbleUser: {
    backgroundColor: "#edf5ff",
    borderColor: "#c6d9f5",
  },
  coachBubbleRole: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  coachBubbleRoleAssistant: {
    color: "#0f4c5c",
  },
  coachBubbleRoleUser: {
    color: "#1f4b8f",
  },
  coachBubbleText: {
    color: "#2b2a28",
    lineHeight: 20,
  },
  coachActions: {
    flexDirection: "row",
    marginTop: 8,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  pill: {
    backgroundColor: "#fffdf9",
    borderWidth: 1,
    borderColor: "#ddceb9",
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  pillSelected: {
    backgroundColor: "#0f4c5c",
    borderColor: "#0f4c5c",
  },
  pillText: {
    color: "#3c342c",
    fontWeight: "700",
  },
  pillTextSelected: {
    color: "#fff7ea",
  },
  switchRow: {
    backgroundColor: "#fffdf9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddceb9",
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#0f4c5c",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#0f4c5c",
    shadowColor: "#0f4c5c",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
  },
  primaryButtonCompact: {
    backgroundColor: "#0f4c5c",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#0f4c5c",
    flex: 1,
  },
  primaryButtonText: {
    color: "#fff7ea",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: "#fffdf9",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddceb9",
  },
  secondaryButtonCompact: {
    backgroundColor: "#fffdf9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddceb9",
    flex: 1,
    marginRight: 10,
  },
  secondaryButtonText: {
    color: "#14213d",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButtonDanger: {
    backgroundColor: "#fff3f2",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#efc1c1",
  },
  secondaryButtonDangerText: {
    color: "#c53030",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.58,
  },
  issueError: {
    color: "#b1440e",
    marginBottom: 5,
    lineHeight: 21,
  },
  issueWarning: {
    color: "#8b5a1a",
    marginBottom: 5,
    lineHeight: 21,
  },
  resultCard: {
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
  },
  green: {
    backgroundColor: "#e6f6ea",
    borderColor: "#b6debf",
    borderWidth: 1,
  },
  yellow: {
    backgroundColor: "#fff5db",
    borderColor: "#ebd08f",
    borderWidth: 1,
  },
  red: {
    backgroundColor: "#fff0ee",
    borderColor: "#f0c5bf",
    borderWidth: 1,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#14213d",
    marginBottom: 6,
  },
  resultScore: {
    fontSize: 18,
    fontWeight: "800",
    color: "#14213d",
    marginBottom: 10,
  },
  resultSummary: {
    color: "#2b2a28",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  resultMicro: {
    color: "#5f574b",
    fontSize: 13,
  },
  scoreChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#f2e8d8",
    fontWeight: "800",
    marginBottom: 8,
  },
  planCard: {
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: "#7a5e3a",
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 3,
  },
  planCardFree: {
    backgroundColor: "#fff8ee",
    borderColor: "#edcfaa",
  },
  planCardPro: {
    backgroundColor: "#eef8f6",
    borderColor: "#bfd8d3",
  },
  planCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  planCardCopy: {
    flex: 1,
    paddingRight: 12,
  },
  planEyebrow: {
    color: "#8b6a3f",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  planTitle: {
    color: "#14213d",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  planBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  planBadgeFree: {
    backgroundColor: "#fff0de",
    borderColor: "#efc9a2",
  },
  planBadgePro: {
    backgroundColor: "#e0f1ed",
    borderColor: "#8fc4b9",
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  planBadgeTextFree: {
    color: "#a05a1d",
  },
  planBadgeTextPro: {
    color: "#146356",
  },
  planBody: {
    color: "#3b332b",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  planProgressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#efe2cc",
    overflow: "hidden",
    marginBottom: 12,
  },
  planProgressFill: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#d99149",
  },
  planProgressFillPro: {
    backgroundColor: "#2f8577",
  },
  planMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  planMetaChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: "rgba(255, 250, 243, 0.7)",
    borderWidth: 1,
    borderColor: "#eadbc7",
  },
  planMetaText: {
    color: "#5f574b",
    fontSize: 12,
    fontWeight: "700",
  },
  archiveActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  archiveHeaderBlock: {
    paddingTop: 18,
  },
  archiveItem: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#6f5538",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 3,
  },
  archiveMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  archiveTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#14213d",
    marginBottom: 6,
    lineHeight: 21,
    flexShrink: 1,
  },
  archiveSub: {
    color: "#6f665b",
    marginBottom: 3,
    lineHeight: 18,
    flexShrink: 1,
  },
  archiveMemory: {
    color: "#41392f",
    marginBottom: 3,
    lineHeight: 18,
    fontWeight: "700",
    flexShrink: 1,
  },
  archiveRight: {
    alignItems: "center",
    marginLeft: 12,
    minWidth: 84,
    justifyContent: "center",
  },
  archiveScoreBadge: {
    minWidth: 54,
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  archiveScoreValue: {
    color: "#fffaf2",
    fontSize: 20,
    fontWeight: "800",
  },
  archiveScoreLabel: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  emptyState: {
    backgroundColor: "#fffaf3",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e4d8c4",
  },
  imagePreviewCard: {
    flexDirection: "row",
    backgroundColor: "#fffefb",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d9cdb9",
    overflow: "hidden",
    marginBottom: 12,
  },
  imagePreview: {
    width: 86,
    height: 86,
  },
  imagePreviewMeta: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  barRow: {
    marginBottom: 12,
  },
  barRowText: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  barLabel: {
    color: "#14213d",
    fontWeight: "700",
    flex: 1,
    marginRight: 12,
  },
  barValue: {
    color: "#5f574b",
    fontWeight: "700",
  },
  barTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#efe2cc",
    overflow: "hidden",
  },
  barFill: {
    height: 12,
    borderRadius: 999,
  },
  compareSpotlightCard: {
    backgroundColor: "#fff7ef",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#efc8a8",
    padding: 18,
    marginBottom: 14,
  },
  compareSpotlightEyebrow: {
    color: "#b55d24",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  compareSpotlightTitle: {
    color: "#14213d",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 25,
    marginBottom: 8,
  },
  compareSpotlightText: {
    color: "#5f574b",
    lineHeight: 21,
    marginBottom: 14,
  },
  compareSpotlightPair: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  compareSpotlightMiniCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  compareSpotlightMiniBadge: {
    color: "#fff7ea",
    fontWeight: "800",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  compareSpotlightMiniTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 20,
  },
  compareSpotlightMiniMeta: {
    color: "#5f574b",
    lineHeight: 18,
  },
  compareImmediateHeader: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  compareImmediateHeaderCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  compareImmediateHeaderLabel: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
    marginBottom: 4,
  },
  compareImmediateHeaderScore: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  compareImmediateHeaderMeta: {
    lineHeight: 18,
    marginBottom: 4,
  },
  compareImmediateHeaderSummary: {
    fontWeight: "700",
    lineHeight: 18,
  },
  compareImmediateMetric: {
    marginBottom: 10,
  },
  compareImmediateMetricLabel: {
    color: "#5f574b",
    fontWeight: "800",
    marginBottom: 6,
  },
  compareImmediateMetricValues: {
    flexDirection: "row",
    gap: 10,
  },
  compareImmediateValueCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    minHeight: 54,
    justifyContent: "center",
  },
  compareImmediateValueText: {
    fontWeight: "700",
    lineHeight: 18,
  },
  comparePropertyGrid: {
    gap: 12,
    marginBottom: 14,
  },
  comparePropertyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  comparePropertyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  comparePropertyBadge: {
    color: "#fff7ea",
    fontWeight: "800",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  comparePropertyScore: {
    fontSize: 20,
    fontWeight: "800",
  },
  comparePropertyTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  comparePropertyMeta: {
    color: "#5f574b",
    marginBottom: 8,
    lineHeight: 19,
  },
  comparePropertyLine: {
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 3,
  },
  compareMemoryItem: {
    backgroundColor: "#fffefb",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4d8c4",
    padding: 12,
    marginBottom: 10,
  },
  compareMemoryTitle: {
    color: "#14213d",
    fontWeight: "800",
    marginBottom: 6,
  },
  compareMemoryLine: {
    color: "#3f382f",
    lineHeight: 19,
    marginBottom: 3,
  },
  compareMemoryLineMuted: {
    color: "#6f665b",
    lineHeight: 19,
  },
  settingsStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  settingsStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
  },
  settingsStatusBadgeFree: {
    backgroundColor: "#fff0de",
    borderColor: "#efc9a2",
  },
  settingsStatusBadgePro: {
    backgroundColor: "#e0f1ed",
    borderColor: "#8fc4b9",
  },
  settingsStatusBadgeInfo: {
    backgroundColor: "#e8f1ff",
    borderColor: "#bfd7f6",
  },
  settingsStatusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  settingsStatusBadgeTextFree: {
    color: "#a05a1d",
  },
  settingsStatusBadgeTextPro: {
    color: "#146356",
  },
  settingsStatusBadgeTextInfo: {
    color: "#1f4b8f",
  },
  settingsStatusChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: "#f6eee1",
    borderWidth: 1,
    borderColor: "#e7d7c1",
  },
  settingsStatusChipText: {
    color: "#5f574b",
    fontSize: 12,
    fontWeight: "700",
  },
  budgetSliderWrap: {
    backgroundColor: "#fff5f5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#efc1c1",
    padding: 12,
    marginBottom: 12,
  },
  budgetSliderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  budgetSliderLabel: {
    color: "#7f1d1d",
    fontWeight: "800",
    flex: 1,
    flexShrink: 1,
    paddingRight: 10,
  },
  budgetSliderValue: {
    color: "#9b1c1c",
    fontWeight: "800",
    minWidth: 104,
    textAlign: "right",
    flexShrink: 0,
  },
  budgetSlider: {
    width: "100%",
    height: 36,
    marginBottom: 2,
  },
  budgetSliderScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  budgetScaleText: {
    color: "#9f6a6a",
    fontSize: 12,
    fontWeight: "700",
  },
  budgetHint: {
    color: "#7f1d1d",
    fontSize: 13,
    marginBottom: 6,
  },
  budgetPressureTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#f6dede",
    overflow: "hidden",
  },
  budgetPressureFill: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#e57373",
  },
  budgetPressureText: {
    marginTop: 6,
    color: "#7f1d1d",
    fontWeight: "700",
  },
  budgetPressureTextDanger: {
    color: "#9b1c1c",
  },
  floatingMicButton: {
    position: "absolute",
    right: 20,
    bottom: 96,
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: "#efc1c1",
    backgroundColor: "#fff8f7",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 12,
    elevation: 10,
    shadowColor: "#7f1d1d",
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
  },
  floatingMicButtonActive: {
    backgroundColor: "#9b1c1c",
    borderColor: "#9b1c1c",
  },
  tabBar: {
    position: "absolute",
    left: 14,
    right: 14,
    backgroundColor: "rgba(255, 250, 243, 0.98)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#eadbc7",
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 76,
    alignItems: "stretch",
    shadowColor: "#73583a",
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 2,
    borderRadius: 20,
    minWidth: 0,
  },
  tabButtonActive: {
    backgroundColor: "#efe4d1",
  },
  tabIcon: {
    color: "#8a8174",
    marginBottom: 4,
  },
  tabIconActive: {
    color: "#0f4c5c",
  },
  tabLabel: {
    color: "#766d61",
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 13,
    textAlign: "center",
    width: "100%",
  },
  tabLabelActive: {
    color: "#0f4c5c",
  },
});
