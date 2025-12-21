import type { DeepLConfig, AIConfig } from "./types.js";

/**
 * Default extraction pattern for _("key") function calls
 */
export const DEFAULT_EXTRACT_PATTERN = /_\(["'`](.+?)["'`]\)/g;

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
 * Default DeepL configuration
 */
export const DEFAULT_DEEPL_CONFIG: Required<DeepLConfig> = {
  apiKey: process.env.DEEPL_API_KEY ?? "",
  formality: "default",
};

/**
 * Default AI system prompt for translation
 */
export const DEFAULT_AI_SYSTEM_PROMPT = `You are a professional translator.
You receive a source text, its language, the target language, and optionally a machine translation from DeepL.
Your task is to provide the best possible translation.

Guidelines:
- Keep the tone and style consistent with the source text
- Preserve any placeholders exactly as they appear (e.g., {name}, %s, %@, %d, {{variable}})
- Use natural, fluent language appropriate for the target locale
- If a DeepL translation is provided, use it as a reference but improve it if needed
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
