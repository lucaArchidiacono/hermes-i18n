import type { HermesConfig } from "hermes-i18n";

const config: HermesConfig = {
  // Source language (keys are written in this language)
  sourceLanguage: "en",

  // Target languages to translate into
  targetLanguages: ["de", "fr", "es", "it"],

  // Source file (source of truth, keys get auto-added here)
  source: {
    path: "./locales/en/Localizable.strings",
    type: "strings",
  },

  // Output files per language (use {lang} placeholder)
  outputs: [
    {
      type: "strings",
      path: "./locales/{lang}/Localizable.strings",
    },
    {
      type: "json",
      path: "./locales/{lang}/Localizable.json",
    },
    // Uncomment for Android XML support:
    // {
    //   type: "xml",
    //   path: "./locales/{lang}/strings.xml",
    // },
  ],

  // Files to scan for translation keys
  include: ["./src/**/*.{ts,tsx,js,jsx}"],

  // Files to exclude from scanning
  exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],

  // Optional: Custom extraction pattern (default shown)
  // extractPattern: /_\(["'`](.+?)["'`]\)/g,

  // DeepL configuration (optional)
  deepl: {
    // API key (defaults to DEEPL_API_KEY env variable)
    // apiKey: process.env.DEEPL_API_KEY,
    formality: "default", // "default" | "more" | "less" | "prefer_more" | "prefer_less"
  },

  // AI configuration (required)
  ai: {
    provider: "openai", // "openai" | "anthropic" | "google" | "mistral"
    model: "gpt-4o-mini",
    // API key (defaults to provider-specific env variable, e.g., OPENAI_API_KEY)
    // apiKey: process.env.OPENAI_API_KEY,

    // Optional: Custom system prompt
    // systemPrompt: "You are a professional translator...",
  },
};

export default config;
