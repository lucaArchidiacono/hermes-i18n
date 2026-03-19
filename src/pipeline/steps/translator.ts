import type {
  PipelineStep,
  PipelineContext,
  TranslationResult,
} from "../types.js";
import { DeepLService } from "../../services/deepl.js";
import { GoogleTranslateService } from "../../services/google-translate.js";
import { AIService } from "../../services/ai.js";
import type {
  TranslationService,
  TranslationResult as ServiceTranslationResult,
} from "../../services/translator.js";
import type { ResolvedAITranslationConfig } from "../../config/types.js";
import { logger } from "../../utils/logger.js";
import { normalize, unescape } from "../../utils/strings.js";

interface TranslationServiceWithName {
  service: TranslationService | AIService;
  name: string;
  isAI: boolean;
}

/**
 * Translation step - translates missing entries using the configured translation chain.
 * Iterates through config.translations in order; first successful result wins.
 */
export class TranslationStep implements PipelineStep {
  name = "translate";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, translations } = context;

    // Create services from config.translations array
    const services = this.createTranslationServices(context);

    if (services.length === 0) {
      logger.warn(
        "No translation service configured, skipping translation step",
      );
      return context;
    }

    const serviceNames = services.map((s) => s.name).join(" → ");
    logger.info(`Translation chain: ${serviceNames}`);

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
          translationResult.usedProvider = usedService;
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
   * Try to translate using available services with fallback.
   * Returns the result from the first service that succeeds.
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

    for (const { service, name, isAI } of services) {
      let result: ServiceTranslationResult;

      if (isAI) {
        // AI services use the AIService.translate interface
        const aiService = service as AIService;
        const aiResult = await aiService.translate(
          text,
          sourceLanguage,
          targetLanguage,
        );
        result = {
          success: aiResult.success,
          translation: aiResult.translation,
          error: aiResult.error,
        };
      } else {
        result = await (service as TranslationService).translate(
          text,
          sourceLanguage,
          targetLanguage,
        );
      }

      if (result.success) {
        return { result, usedService: name };
      }

      if (result.skipped) {
        logger.debug(
          `[${targetLanguage}] ${name} skipped: ${result.skipReason}, trying fallback...`,
        );
        lastResult = result;
        lastServiceName = name;
        continue;
      }

      logger.debug(
        `[${targetLanguage}] ${name} failed: ${result.error}, trying fallback...`,
      );
      lastResult = result;
      lastServiceName = name;
    }

    return { result: lastResult, usedService: lastServiceName };
  }

  /**
   * Create translation services from config.translations array.
   * Only includes services that are configured (have API keys).
   */
  private createTranslationServices(
    context: PipelineContext,
  ): TranslationServiceWithName[] {
    const { config } = context;
    const services: TranslationServiceWithName[] = [];

    for (const entry of config.translations) {
      switch (entry.provider) {
        case "deepl": {
          const service = new DeepLService(entry);
          if (service.isConfigured()) {
            services.push({ service, name: "DeepL", isAI: false });
          }
          break;
        }
        case "google-translate": {
          const service = new GoogleTranslateService(entry);
          if (service.isConfigured()) {
            services.push({
              service,
              name: "Google Translate",
              isAI: false,
            });
          }
          break;
        }
        default: {
          // AI provider
          const aiConfig = entry as ResolvedAITranslationConfig;
          const service = new AIService(aiConfig);
          if (service.isConfigured()) {
            services.push({
              service,
              name: `${aiConfig.provider}/${aiConfig.model}`,
              isAI: true,
            });
          }
          break;
        }
      }
    }

    return services;
  }
}
