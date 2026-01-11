import type {
  PipelineStep,
  PipelineContext,
  LanguageTranslations,
} from "../types.js";
import type { LocalizationEntry } from "../../file-handlers/types.js";
import { getFileHandler } from "../../file-handlers/registry.js";
import { resolvePath, replaceLanguagePlaceholder } from "../../utils/fs.js";
import { logger } from "../../utils/logger.js";
import { findKey } from "../../utils/strings.js";

/**
 * Missing finder step - identifies keys that need translation for each target language
 */
export class MissingFinderStep implements PipelineStep {
  name = "missing-finder";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, baseDir, sourceEntries } = context;

    let totalMissing = 0;

    for (const language of config.targetLanguages) {
      const langTranslations: LanguageTranslations = {
        language,
        existing: new Map(),
        missing: new Map(),
        results: new Map(),
      };

      // Read existing translations from all output files for this language
      for (const output of config.outputs) {
        const outputPath = resolvePath(
          replaceLanguagePlaceholder(output.path, language),
          baseDir
        );

        const handler = getFileHandler(output.type);
        const entries = await handler.read(outputPath);

        for (const entry of entries) {
          langTranslations.existing.set(entry.key, entry);
        }
      }

      // Find keys that are missing or have empty values
      // Use normalized comparison for escape sequence handling
      for (const [sourceKey, sourceEntry] of sourceEntries) {
        const existingEntry = findKey(langTranslations.existing, sourceKey);

        if (
          !existingEntry ||
          existingEntry.value === "" ||
          existingEntry.value === sourceKey
        ) {
          langTranslations.missing.set(sourceKey, sourceEntry.value);
        }
      }

      totalMissing += langTranslations.missing.size;

      if (langTranslations.missing.size > 0) {
        logger.info(
          `[${language}] Found ${langTranslations.missing.size} keys needing translation`
        );
      } else {
        logger.debug(`[${language}] All keys are translated`);
      }

      context.translations.set(language, langTranslations);
    }

    logger.info(`Total translations needed: ${totalMissing}`);

    return context;
  }
}
