import type { DeepLConfig, GoogleTranslateConfig, AIConfig, TranslationProvider } from "./types.js";

/**
 * Extraction pattern for _("key"), _('key'), and _(`key`) function calls.
 *
 * Pattern breakdown: _\(\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)\s*\)
 *
 * Structure:
 * - _\(         - matches _( literally
 * - \s*         - allows optional whitespace after opening paren
 * - (?:...|...|...) - non-capturing group with three alternatives:
 *
 *   Alternative 1 (double quotes):
 *   - "           - opening double quote
 *   - ([^"\\]*(?:\\.[^"\\]*)*) - capture group 1: string content
 *     - [^"\\]*   - any chars except " and \
 *     - (?:\\.[^"\\]*)* - followed by any number of: escape sequence (\.) + more chars
 *   - "           - closing double quote
 *
 *   Alternative 2 (single quotes):
 *   - '           - opening single quote
 *   - ([^'\\]*(?:\\.[^'\\]*)*) - capture group 2: string content (same logic)
 *   - '           - closing single quote
 *
 *   Alternative 3 (backticks):
 *   - `           - opening backtick
 *   - ([^`\\]*(?:\\.[^`\\]*)*) - capture group 3: string content (same logic)
 *   - `           - closing backtick
 *
 * - \s*\)       - optional whitespace before closing paren
 *
 * This pattern properly handles:
 * - Multi-line function calls: _(\n  "text"\n)
 * - Escape sequences: _("Hello\nWorld"), _('path\\to\\file')
 * - Escaped quotes: _("Say \"Hi\""), _('It\'s fine')
 * - Special characters: _("Price: $100"), _(`Value: ${escaped}`)
 * - Mixed content: _("Special: $var \n \t \" ' `")
 */
export const DEFAULT_EXTRACT_PATTERN =
  /_\(\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)\s*\)/g;

/**
 * Default exclude patterns
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
];

/**
 * Default translation provider
 */
export const DEFAULT_TRANSLATOR: TranslationProvider = "deepl";

/**
 * Default DeepL configuration
 */
export const DEFAULT_DEEPL_CONFIG: Required<DeepLConfig> = {
  apiKey: process.env.DEEPL_API_KEY ?? "",
  formality: "default",
};

/**
 * Default Google Translate configuration
 */
export const DEFAULT_GOOGLE_TRANSLATE_CONFIG: Required<GoogleTranslateConfig> = {
  apiKey: process.env.GOOGLE_TRANSLATE_API_KEY ?? "",
};

/**
 * Default AI system prompt for translation
 */
export const DEFAULT_AI_SYSTEM_PROMPT = `You are a professional translator.
You receive a source text, its language, the target language, and optionally a machine translation reference.
Your task is to provide the best possible translation.

Guidelines:
- Keep the tone and style consistent with the source text
- Preserve any placeholders exactly as they appear (e.g., {name}, %s, %@, %d, {{variable}})
- Use natural, fluent language appropriate for the target locale
- If a reference translation is provided, use it as a reference but improve it if needed
- Return ONLY the translated text, nothing else - no explanations, no quotes, just the translation`;

/**
 * Get the environment variable name for an AI provider's API key
 */
export function getAIProviderEnvKey(provider: string): string {
  const envKeys: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
    mistral: "MISTRAL_API_KEY",
  };
  return envKeys[provider] ?? `${provider.toUpperCase()}_API_KEY`;
}

/**
 * Get default AI configuration
 */
export function getDefaultAIConfig(
  provider: string,
  model: string
): Required<AIConfig> {
  const envKey = getAIProviderEnvKey(provider);
  return {
    provider: provider as AIConfig["provider"],
    model,
    apiKey: process.env[envKey] ?? "",
    systemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
  };
}
