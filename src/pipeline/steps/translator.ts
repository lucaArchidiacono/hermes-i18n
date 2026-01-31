import type {
  PipelineStep,
  PipelineContext,
  TranslationResult,
} from "../types.js";
import { DeepLService } from "../../services/deepl.js";
import { GoogleTranslateService } from "../../services/google-translate.js";
import type {
  TranslationService,
  TranslationResult as ServiceTranslationResult,
} from "../../services/translator.js";
import { logger } from "../../utils/logger.js";
import { normalize, unescape } from "../../utils/strings.js";

interface TranslationServiceWithName {
  service: TranslationService;
  name: string;
}

/**
 * Translation step - translates missing entries using DeepL or Google Translate
 * Supports fallback: if one service fails, it tries the other
 */
export class TranslationStep implements PipelineStep {
  name = "translate";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, translations } = context;

    // Create both services
    const services = this.createTranslationServices(context);

    if (services.length === 0) {
      logger.warn(
        "No translation service configured (neither DeepL nor Google Translate API key provided), skipping translation step",
      );
      return context;
    }

    const serviceNames = services.map((s) => s.name).join(" | ");
    logger.info(`Translation services available: ${serviceNames}`);

    for (const [language, langTranslations] of translations) {
      if (langTranslations.missing.size === 0) {
        continue;
      }

      logger.info(
        `[${language}] Translating ${langTranslations.missing.size} keys...`,
      );

      // Process translations sequentially (not concurrent)
      for (const [key, sourceValue] of langTranslations.missing) {
        const normalizedKey = normalize(key);
        const normalizedSourceValue = normalize(sourceValue);

        context.translationsAttempted++;

        // Try each service in order until one succeeds
        const { result, usedService } = await this.translateWithFallback(
          services,
          unescape(normalizedSourceValue),
          config.sourceLanguage,
          language,
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
          logger.debug(
            `[${language}] Translated via ${usedService}: "${normalizedKey}"`,
          );
        } else if (result.skipped) {
          translationResult.error = result.skipReason;
          logger.debug(
            `[${language}] Skipped: "${normalizedKey}" - ${result.skipReason}`,
          );
        } else {
          translationResult.error = result.error;
          context.translationsFailed++;
          logger.debug(
            `[${language}] Failed: "${normalizedKey}" - ${result.error}`,
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
   * Try to translate using available services with fallback
   * Returns the result from the first service that succeeds
   */
  private async translateWithFallback(
    services: TranslationServiceWithName[],
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<{ result: ServiceTranslationResult; usedService: string }> {
    let lastResult: ServiceTranslationResult = {
      success: false,
      error: "No translation service available",
    };
    let lastServiceName = "none";

    for (const { service, name } of services) {
      const result = await service.translate(
        text,
        sourceLanguage,
        targetLanguage,
      );

      if (result.success) {
        // Success - return immediately, no need to try other services
        return { result, usedService: name };
      }

      if (result.skipped) {
        // Language not supported by this service - try the next one
        logger.debug(
          `[${targetLanguage}] ${name} skipped: ${result.skipReason}, trying fallback...`,
        );
        lastResult = result;
        lastServiceName = name;
        continue;
      }

      // Error occurred - try the fallback service
      logger.debug(
        `[${targetLanguage}] ${name} failed: ${result.error}, trying fallback...`,
      );
      lastResult = result;
      lastServiceName = name;
    }

    // All services failed or skipped
    return { result: lastResult, usedService: lastServiceName };
  }

  /**
   * Create translation services based on config
   * Returns services in priority order: preferred service first, then fallback
   */
  private createTranslationServices(
    context: PipelineContext,
  ): TranslationServiceWithName[] {
    const { config } = context;
    const services: TranslationServiceWithName[] = [];

    const deeplService = new DeepLService(config.deepl);
    const googleService = new GoogleTranslateService(config.googleTranslate);

    // Add services in priority order based on config.translator
    if (config.translator === "google") {
      // Google is preferred
      if (googleService.isConfigured()) {
        services.push({ service: googleService, name: "Google Translate" });
      }
      if (deeplService.isConfigured()) {
        services.push({ service: deeplService, name: "DeepL" });
      }
    } else {
      // DeepL is preferred (default)
      if (deeplService.isConfigured()) {
        services.push({ service: deeplService, name: "DeepL" });
      }
      if (googleService.isConfigured()) {
        services.push({ service: googleService, name: "Google Translate" });
      }
    }

    return services;
  }
}
