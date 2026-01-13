import type {
  PipelineStep,
  PipelineContext,
  TranslationResult,
} from "../types.js";
import { DeepLService } from "../../services/deepl.js";
import { logger } from "../../utils/logger.js";
import { normalize, unescape } from "../../utils/strings.js";

/**
 * DeepL translation step - translates missing entries using DeepL API
 */
export class DeepLStep implements PipelineStep {
  name = "deepl-translate";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, translations } = context;

    const service = new DeepLService(config.deepl);

    if (!service.isConfigured()) {
      logger.warn(
        "DeepL API key not configured, skipping DeepL translation step"
      );
      return context;
    }

    for (const [language, langTranslations] of translations) {
      if (langTranslations.missing.size === 0) {
        continue;
      }

      logger.info(
        `[${language}] Translating ${langTranslations.missing.size} keys via DeepL...`
      );

      // Process translations sequentially (not concurrent)
      for (const [key, sourceValue] of langTranslations.missing) {
        const normalizedKey = normalize(key);
        const normalizedSourceValue = normalize(sourceValue);

        context.translationsAttempted++;

        const result = await service.translate(
          unescape(normalizedSourceValue),
          config.sourceLanguage,
          language
        );

        const translationResult: TranslationResult = {
          key: normalizedKey,
          sourceValue: normalizedSourceValue,
          targetLanguage: language,
          finalValue: normalizedSourceValue,
          status: "failed",
        };

        if (result.success && result.translation) {
          const normalizedTranslation = normalize(result.translation);
          translationResult.deeplResult = normalizedTranslation;
          translationResult.finalValue = normalizedTranslation;
          translationResult.status = "deepl_only";
          logger.debug(`[${language}] Translated: "${normalizedKey}"`);
        } else if (result.skipped) {
          translationResult.error = result.skipReason;
          logger.debug(
            `[${language}] Skipped: "${normalizedKey}" - ${result.skipReason}`
          );
        } else {
          translationResult.error = result.error;
          context.translationsFailed++;
          logger.debug(
            `[${language}] Failed: "${normalizedKey}" - ${result.error}`
          );

          // Add to errors
          context.errors.push({
            step: this.name,
            message: result.error ?? "Unknown error",
            key: normalizedKey,
            language,
          });
        }

        langTranslations.results.set(normalizedKey, translationResult);
      }
    }

    return context;
  }
}
