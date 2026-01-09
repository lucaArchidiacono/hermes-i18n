/**
 * File type for localization files
 */
export type FileType = "strings" | "json" | "xml";

/**
 * Supported AI providers via Vercel AI SDK
 */
export type AIProvider = "openai" | "anthropic" | "google" | "mistral";

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

/**
 * DeepL API configuration
 */
export interface DeepLConfig {
  /** DeepL API key (defaults to DEEPL_API_KEY env variable) */
  apiKey?: string;
  /** Formality preference for translations */
  formality?: "default" | "more" | "less" | "prefer_more" | "prefer_less";
}

/**
 * AI configuration for translation refinement
 */
export interface AIConfig {
  /** AI provider to use */
  provider: AIProvider;
  /** Model name (e.g., "gpt-4o-mini", "claude-3-haiku-20240307") */
  model: string;
  /** API key (defaults to provider-specific env variable) */
  apiKey?: string;
  /** System prompt for the AI translator */
  systemPrompt?: string;
}

/**
 * Main Hermes configuration
 */
export interface HermesConfig {
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
  /** DeepL configuration */
  deepl?: DeepLConfig;
  /** AI configuration */
  ai: AIConfig;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedHermesConfig
  extends Omit<HermesConfig, "extractPattern"> {
  exclude: string[];
  extractPattern: RegExp;
  deepl: Required<DeepLConfig>;
  ai: Required<AIConfig>;
}
