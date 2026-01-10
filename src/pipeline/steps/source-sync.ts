import type { PipelineStep, PipelineContext } from "../types.js";
import type { LocalizationEntry } from "../../file-handlers/types.js";
import { getFileHandler } from "../../file-handlers/registry.js";
import { resolvePath } from "../../utils/fs.js";
import { logger } from "../../utils/logger.js";
import { hasKeyNormalized, findKeyNormalized } from "../../utils/strings.js";

/**
 * Source sync step - ensures all extracted keys exist in the source file
 * Adds missing keys with their key as the value (for source language)
 */
export class SourceSyncStep implements PipelineStep {
  name = "source-sync";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, baseDir, extractedKeys, dryRun } = context;

    const sourcePath = resolvePath(config.source.path, baseDir);
    const handler = getFileHandler(config.source.type);

    // Read existing entries
    const existingEntries = await handler.read(sourcePath);
    const entriesMap = new Map<string, LocalizationEntry>();

    for (const entry of existingEntries) {
      entriesMap.set(entry.key, entry);
    }

    logger.info(`Source file has ${entriesMap.size} existing entries`);

    const newKeys: string[] = [];
    for (const key of extractedKeys) {
      if (!hasKeyNormalized(entriesMap, key)) {
        newKeys.push(key);
        entriesMap.set(key, { key, value: key });
      }
    }

    if (newKeys.length > 0) {
      logger.info(`Adding ${newKeys.length} new keys to source file`);

      if (!dryRun) {
        const sortedEntries = Array.from(entriesMap.values()).sort((a, b) =>
          a.key.localeCompare(b.key)
        );
        await handler.write(sourcePath, sortedEntries);
        logger.success(`Updated source file: ${sourcePath}`);
      } else {
        logger.info(`[DRY RUN] Would add keys: ${newKeys.join(", ")}`);
      }
    } else {
      logger.info("No new keys to add to source file");
    }

    context.sourceEntries = entriesMap;
    context.newSourceKeys = newKeys;

    return context;
  }
}
