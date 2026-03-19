export type {
  FileType,
  AIProviderName,
  MachineTranslationProviderName,
  SourceConfig,
  OutputConfig,
  DeepLTranslationConfig,
  GoogleTranslateTranslationConfig,
  AITranslationConfig,
  TranslationConfig,
  ResolvedDeepLTranslationConfig,
  ResolvedGoogleTranslateTranslationConfig,
  ResolvedAITranslationConfig,
  ResolvedTranslationConfig,
  RefinerConfig,
  ResolvedRefinerConfig,
  StryngzConfig,
  ResolvedStryngzConfig,
} from "./types.js";

export { loadConfig, findConfigFile } from "./loader.js";

export {
  DEFAULT_EXTRACT_PATTERN,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_AI_SYSTEM_PROMPT,
  getAIProviderEnvKey,
  resolveTranslationConfig,
  resolveRefinerConfig,
} from "./defaults.js";
