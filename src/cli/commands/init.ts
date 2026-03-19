import { Command } from "commander";
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { logger } from "../../utils/logger.js";

/**
 * Default config file content
 */
const DEFAULT_CONFIG = `{
  "sourceLanguage": "en",
  "targetLanguages": ["de", "fr", "es", "it"],
  "source": {
    "path": "./locales/en/Localizable.strings",
    "type": "strings"
  },
  "outputs": [
    {
      "type": "strings",
      "path": "./locales/{lang}/Localizable.strings"
    },
    {
      "type": "json",
      "path": "./locales/{lang}/Localizable.json"
    }
  ],
  "include": ["./src/**/*.{ts,tsx,js,jsx}"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/build/**"],
  "translations": [
    { "provider": "deepl", "formality": "default" },
    { "provider": "google-translate" }
  ],
  "refiner": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
`;

/**
 * Create the init command
 */
export function initCommand(): Command {
  const command = new Command("init");

  command
    .description("Create a stryngz.config.json file in the current directory")
    .option("-f, --force", "Overwrite existing config file", false)
    .action(async (options) => {
      const configPath = resolve(process.cwd(), "stryngz.config.json");

      if (existsSync(configPath) && !options.force) {
        logger.error("stryngz.config.json already exists. Use --force to overwrite.");
        process.exit(1);
      }

      try {
        writeFileSync(configPath, DEFAULT_CONFIG, "utf-8");
        logger.success(`Created ${configPath}`);
        logger.info("");
        logger.info("Next steps:");
        logger.info("  1. Edit stryngz.config.json to match your project structure");
        logger.info("  2. Configure your translation providers in the 'translations' array");
        logger.info("  3. Set up environment variables for API keys:");
        logger.info("     - DEEPL_API_KEY (for DeepL translations)");
        logger.info("     - GOOGLE_TRANSLATE_API_KEY (for Google Translate)");
        logger.info("     - OPENAI_API_KEY (or other provider key for AI refiner)");
        logger.info("  4. Run 'stryngz sync' to extract and translate strings");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to create config file: ${message}`);
        process.exit(1);
      }
    });

  return command;
}
