import type { PipelineStep, PipelineContext, TranslationResult } from "../types.js";
import { DeepLService } from "../../services/deepl.js";
import { logger } from "../../utils/logger.js";

/**
 * DeepL translation step - translates missing entries using DeepL API
 */
export class DeepLStep implements PipelineStep {
  name = "deepl-translate";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, translations } = context;

    const service = new DeepLService(config.deepl);

    if (!service.isConfigured()) {
      logger.warn("DeepL API key not configured, skipping DeepL translation step");
      return context;
    }

    for (const [language, langTranslations] of translations) {
      if (langTranslations.missing.size === 0) {
        continue;
      }

      logger.info(`[${language}] Translating ${langTranslations.missing.size} keys via DeepL...`);

      // Process translations sequentially (not concurrent)
      for (const [key, sourceValue] of langTranslations.missing) {
        context.translationsAttempted++;

        const result = await service.translate(
          sourceValue,
          config.sourceLanguage,
          language
        );

        const translationResult: TranslationResult = {
          key,
          sourceValue,
          targetLanguage: language,
          finalValue: sourceValue, // Default to source value
          status: "failed",
        };

        if (result.success && result.translation) {
          translationResult.deeplResult = result.translation;
          translationResult.finalValue = result.translation;
          translationResult.status = "deepl_only";
          logger.debug(`[${language}] Translated: "${key}"`);
        } else if (result.skipped) {
          translationResult.error = result.skipReason;
          logger.debug(`[${language}] Skipped: "${key}" - ${result.skipReason}`);
        } else {
          translationResult.error = result.error;
          context.translationsFailed++;
          logger.debug(`[${language}] Failed: "${key}" - ${result.error}`);

          // Add to errors
          context.errors.push({
            step: this.name,
            message: result.error ?? "Unknown error",
            key,
            language,
          });
        }

        langTranslations.results.set(key, translationResult);
      }
    }

    return context;
  }
}
