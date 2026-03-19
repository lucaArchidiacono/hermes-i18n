/**
 * File type for localization files
 */
export type FileType = "strings" | "json";

/**
 * Machine translation provider names
 */
export type MachineTranslationProviderName = "deepl" | "google-translate";

/**
 * AI provider names
 */
export type AIProviderName = "openai" | "anthropic" | "google-ai" | "mistral";

/**
 * Source file configuration
 */
export interface SourceConfig {
  /** Path to the source localization file */
  path: string;
  /** Type of the source file */
  type: FileType;
}

/**
 * Output file configuration
 */
export interface OutputConfig {
  /** Type of the output file */
  type: FileType;
  /** Path pattern with {lang} placeholder, e.g., "./locales/{lang}/messages.json" */
  path: string;
}

// --- Translation provider configs (discriminated union) ---

/**
 * DeepL translation provider config
 */
export interface DeepLTranslationConfig {
  provider: "deepl";
  /** DeepL API key (defaults to DEEPL_API_KEY env variable) */
  apiKey?: string;
  /** Formality preference for translations */
  formality?: "default" | "more" | "less" | "prefer_more" | "prefer_less";
}

/**
 * Google Translate provider config
 */
export interface GoogleTranslateTranslationConfig {
  provider: "google-translate";
  /** Google Cloud API key (defaults to GOOGLE_TRANSLATE_API_KEY env variable) */
  apiKey?: string;
}

/**
 * AI translation provider config (used as a direct translator in the fallback chain)
 */
export interface AITranslationConfig {
  provider: AIProviderName;
  /** Model name (e.g., "gpt-4o-mini", "claude-sonnet-4-20250514") */
  model: string;
  /** API key (defaults to provider-specific env variable) */
  apiKey?: string;
  /** System prompt for the AI translator */
  systemPrompt?: string;
}

/**
 * Union of all translation provider configs
 */
export type TranslationConfig =
  | DeepLTranslationConfig
  | GoogleTranslateTranslationConfig
  | AITranslationConfig;

// --- Resolved translation provider configs (all defaults applied) ---

export interface ResolvedDeepLTranslationConfig {
  provider: "deepl";
  apiKey: string;
  formality: "default" | "more" | "less" | "prefer_more" | "prefer_less";
}

export interface ResolvedGoogleTranslateTranslationConfig {
  provider: "google-translate";
  apiKey: string;
}

export interface ResolvedAITranslationConfig {
  provider: AIProviderName;
  model: string;
  apiKey: string;
  systemPrompt: string;
}

export type ResolvedTranslationConfig =
  | ResolvedDeepLTranslationConfig
  | ResolvedGoogleTranslateTranslationConfig
  | ResolvedAITranslationConfig;

// --- AI Refiner config (optional, separate from translation chain) ---

/**
 * AI refiner configuration - refines translations produced by the translation chain
 */
export interface RefinerConfig {
  /** AI provider to use */
  provider: AIProviderName;
  /** Model name */
  model: string;
  /** API key (defaults to provider-specific env variable) */
  apiKey?: string;
  /** System prompt for the AI refiner */
  systemPrompt?: string;
}

export interface ResolvedRefinerConfig {
  provider: AIProviderName;
  model: string;
  apiKey: string;
  systemPrompt: string;
}

// --- Main config ---

/**
 * Main Stryngz configuration
 */
export interface StryngzConfig {
  /** Source language code (e.g., "en") */
  sourceLanguage: string;
  /** Target language codes to translate into */
  targetLanguages: string[];
  /** Source file configuration (source of truth) */
  source: SourceConfig;
  /** Output file configurations */
  outputs: OutputConfig[];
  /** Glob patterns for files to scan for translation keys */
  include: string[];
  /** Glob patterns for files to exclude from scanning */
  exclude?: string[];
  /** Regex pattern to extract translation keys as a string (default: /_\(["'`](.+?)["'`]\)/g) */
  extractPattern?: string;
  /** Ordered array of translation providers (tried in order, first success wins) */
  translations: TranslationConfig[];
  /** Optional AI refiner to improve translations after the translation chain */
  refiner?: RefinerConfig;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedStryngzConfig
  extends Omit<StryngzConfig, "extractPattern" | "translations" | "refiner"> {
  exclude: string[];
  extractPattern: RegExp;
  translations: ResolvedTranslationConfig[];
  refiner?: ResolvedRefinerConfig;
}
