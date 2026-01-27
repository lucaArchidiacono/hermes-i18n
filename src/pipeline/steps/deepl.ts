import type {
  PipelineStep,
  PipelineContext,
  TranslationResult,
} from "../types.js";
import { DeepLService } from "../../services/deepl.js";
import { GoogleTranslateService } from "../../services/google-translate.js";
import type { TranslationService } from "../../services/translator.js";
import { logger } from "../../utils/logger.js";
import { normalize, unescape } from "../../utils/strings.js";

/**
 * DeepL translation step - translates missing entries using DeepL API
 * Note: This class is kept as DeepLStep for backward compatibility,
 * but now supports both DeepL and Google Translate based on config
 */
export class DeepLStep implements PipelineStep {
  name = "translate";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, translations } = context;

    // Create the appropriate translation service based on config
    const service = this.createTranslationService(context);

    if (!service.isConfigured()) {
      logger.warn(
        `${config.translator} API key not configured, skipping translation step`
      );
      return context;
    }

    for (const [language, langTranslations] of translations) {
      if (langTranslations.missing.size === 0) {
        continue;
      }

      logger.info(
        `[${language}] Translating ${langTranslations.missing.size} keys via ${config.translator}...`
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
          translationResult.translatorResult = normalizedTranslation;
          translationResult.finalValue = normalizedTranslation;
          translationResult.status = "translator_only";
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

  /**
   * Create the appropriate translation service based on config
   */
  private createTranslationService(
    context: PipelineContext
  ): TranslationService {
    const { config } = context;

    switch (config.translator) {
      case "google":
        return new GoogleTranslateService(config.googleTranslate);
      case "deepl":
      default:
        return new DeepLService(config.deepl);
    }
  }
}
