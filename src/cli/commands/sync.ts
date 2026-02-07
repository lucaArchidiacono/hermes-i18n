import { Command } from "commander";
import { loadConfig } from "../../config/loader.js";
import { createPipeline } from "../../pipeline/index.js";
import { createPipelineContext } from "../../pipeline/types.js";
import { ExtractorStep } from "../../pipeline/steps/extractor.js";
import { SourceSyncStep } from "../../pipeline/steps/source-sync.js";
import { MissingFinderStep } from "../../pipeline/steps/missing-finder.js";
import { TranslationStep } from "../../pipeline/steps/translator.js";
import { AIRefinerStep } from "../../pipeline/steps/ai-refiner.js";
import { WriterStep } from "../../pipeline/steps/writer.js";
import { logger, setVerbose } from "../../utils/logger.js";

/**
 * Create the sync command
 */
export function syncCommand(): Command {
  const command = new Command("sync");

  command
    .description("Extract, sync, and translate localization strings")
    .option("-c, --config <path>", "Path to stryngz.config.json file")
    .option("-d, --dry-run", "Preview changes without writing files", false)
    .option("-v, --verbose", "Verbose output", false)
    .option("-l, --language <langs...>", "Only process specific language(s)")
    .action(async (options) => {
      try {
        if (options.verbose) {
          setVerbose(true);
        }

        logger.info("Starting Stryngz sync...");

        // Load configuration
        const { config, configDir } = await loadConfig(options.config);

        // Filter languages if specified
        if (options.language && options.language.length > 0) {
          const requestedLangs = options.language as string[];
          const validLangs = requestedLangs.filter((lang) =>
            config.targetLanguages.includes(lang)
          );

          if (validLangs.length === 0) {
            logger.error(
              `None of the specified languages (${requestedLangs.join(", ")}) are in targetLanguages`
            );
            process.exit(1);
          }

          config.targetLanguages = validLangs;
          logger.info(`Processing languages: ${validLangs.join(", ")}`);
        }

        // Create pipeline context
        const context = createPipelineContext(config, configDir, options.dryRun);

        if (options.dryRun) {
          logger.info("Running in DRY RUN mode - no files will be modified");
        }

        // Build and execute pipeline
        const pipeline = createPipeline()
          .addStep(new ExtractorStep())
          .addStep(new SourceSyncStep())
          .addStep(new MissingFinderStep())
          .addStep(new TranslationStep())
          .addStep(new AIRefinerStep())
          .addStep(new WriterStep());

        const result = await pipeline.execute(context);

        // Print summary
        printSummary(result);

        // Exit with error code if there were failures
        if (result.translationsFailed > 0) {
          process.exit(1);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Sync failed: ${message}`);
        process.exit(1);
      }
    });

  return command;
}

/**
 * Print execution summary
 */
function printSummary(context: {
  extractedKeys: string[];
  newSourceKeys: string[];
  translationsAttempted: number;
  translationsSucceeded: number;
  translationsFailed: number;
  errors: { step: string; message: string; key?: string; language?: string }[];
  dryRun: boolean;
}): void {
  logger.box(
    [
      "Stryngz Sync Complete",
      "",
      `Keys extracted: ${context.extractedKeys.length}`,
      `New source keys: ${context.newSourceKeys.length}`,
      `Translations attempted: ${context.translationsAttempted}`,
      `Translations succeeded: ${context.translationsSucceeded}`,
      `Translations failed: ${context.translationsFailed}`,
      context.dryRun ? "\n[DRY RUN - no files were modified]" : "",
    ].join("\n")
  );

  if (context.errors.length > 0) {
    logger.warn(`\n${context.errors.length} errors occurred:`);
    for (const error of context.errors.slice(0, 10)) {
      const location = [error.language, error.key].filter(Boolean).join("/");
      logger.warn(`  [${error.step}] ${location ? `${location}: ` : ""}${error.message}`);
    }
    if (context.errors.length > 10) {
      logger.warn(`  ... and ${context.errors.length - 10} more errors`);
    }
  }
}
