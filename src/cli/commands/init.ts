import { Command } from "commander";
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { logger } from "../../utils/logger.js";

/**
 * Default config file content
 */
const DEFAULT_CONFIG = `import type { HermesConfig } from "hermes-i18n";

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
  // extractPattern: /_\\(["'\`](.+?)["'\`]\\)/g,

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
`;

/**
 * Create the init command
 */
export function initCommand(): Command {
  const command = new Command("init");

  command
    .description("Create a hermes.config.ts file in the current directory")
    .option("-f, --force", "Overwrite existing config file", false)
    .action(async (options) => {
      const configPath = resolve(process.cwd(), "hermes.config.ts");

      if (existsSync(configPath) && !options.force) {
        logger.error("hermes.config.ts already exists. Use --force to overwrite.");
        process.exit(1);
      }

      try {
        writeFileSync(configPath, DEFAULT_CONFIG, "utf-8");
        logger.success(`Created ${configPath}`);
        logger.info("");
        logger.info("Next steps:");
        logger.info("  1. Edit hermes.config.ts to match your project structure");
        logger.info("  2. Set up environment variables for API keys:");
        logger.info("     - DEEPL_API_KEY (optional, for DeepL translations)");
        logger.info("     - OPENAI_API_KEY (or other provider key for AI)");
        logger.info("  3. Run 'hermes sync' to extract and translate strings");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to create config file: ${message}`);
        process.exit(1);
      }
    });

  return command;
}
