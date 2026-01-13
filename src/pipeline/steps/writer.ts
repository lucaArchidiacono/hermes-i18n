import type { PipelineStep, PipelineContext } from "../types.js";
import type { LocalizationEntry } from "../../file-handlers/types.js";
import { getFileHandler } from "../../file-handlers/registry.js";
import { resolvePath, replaceLanguagePlaceholder } from "../../utils/fs.js";
import { logger } from "../../utils/logger.js";
import { normalize } from "../../utils/strings.js";

/**
 * Writer step - writes translated entries to output files
 */
export class WriterStep implements PipelineStep {
  name = "writer";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, baseDir, translations, sourceEntries, dryRun } = context;

    for (const [language, langTranslations] of translations) {
      // Merge existing translations with new ones
      const mergedEntries = new Map<string, LocalizationEntry>(
        langTranslations.existing
      );

      // Add successful translations
      for (const [key, result] of langTranslations.results) {
        if (result.status !== "failed") {
          const normalizedKey = normalize(key);
          const normalizedValue = normalize(result.finalValue);
          mergedEntries.set(normalizedKey, {
            key: normalizedKey,
            value: normalizedValue,
          });
        }
      }

      // Ensure all source keys exist (even if translation failed)
      for (const [key, sourceEntry] of sourceEntries) {
        const normalizedKey = normalize(key);
        if (!mergedEntries.has(normalizedKey)) {
          // Keep the source value as placeholder
          const normalizedValue = normalize(sourceEntry.value);
          mergedEntries.set(normalizedKey, {
            key: normalizedKey,
            value: normalizedValue,
          });
        }
      }

      // Sort entries by key
      const sortedEntries = Array.from(mergedEntries.values()).sort((a, b) =>
        a.key.localeCompare(b.key)
      );

      // Write to each output format for this language
      for (const output of config.outputs) {
        const outputPath = resolvePath(
          replaceLanguagePlaceholder(output.path, language),
          baseDir
        );

        if (!dryRun) {
          const handler = getFileHandler(output.type);
          await handler.write(outputPath, sortedEntries);
          logger.success(
            `Wrote ${sortedEntries.length} entries to: ${outputPath}`
          );
        } else {
          logger.info(
            `[DRY RUN] Would write ${sortedEntries.length} entries to: ${outputPath}`
          );
        }
      }
    }

    return context;
  }
}
