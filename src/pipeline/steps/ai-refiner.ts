import type { PipelineStep, PipelineContext } from "../types.js";
import { AIService } from "../../services/ai.js";
import { logger } from "../../utils/logger.js";
import { normalize, unescape } from "../../utils/strings.js";

/**
 * AI refinement step - refines translations using AI
 * Takes DeepL translations and improves them, or translates directly if DeepL failed
 */
export class AIRefinerStep implements PipelineStep {
  name = "ai-refine";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, translations } = context;

    const service = new AIService(config.ai);

    if (!service.isConfigured()) {
      logger.warn("AI API key not configured, skipping AI refinement step");
      return context;
    }

    for (const [language, langTranslations] of translations) {
      // Only process entries that have results from previous steps
      const toRefine = Array.from(langTranslations.results.entries()).filter(
        ([_, result]) => result.status !== "failed"
      );

      if (toRefine.length === 0) {
        continue;
      }

      logger.info(
        `[${language}] Refining ${toRefine.length} translations via AI...`
      );

      // Process translations sequentially (not concurrent)
      for (const [key, result] of toRefine) {
        const normalizedKey = normalize(key);
        const normalizedSourceValue = normalize(result.sourceValue);

        const aiResult = await service.translate(
          unescape(normalizedSourceValue),
          config.sourceLanguage,
          language,
          result.deeplResult
        );

        if (aiResult.success && aiResult.translation) {
          const normalizedTranslation = normalize(aiResult.translation);
          result.aiResult = normalizedTranslation;
          result.finalValue = normalizedTranslation;
          result.status = "success";
          context.translationsSucceeded++;
          logger.debug(`[${language}] Refined: "${normalizedKey}"`);
        } else {
          // AI failed - if we have DeepL result, keep it; otherwise mark as failed
          if (result.deeplResult) {
            // Keep DeepL result
            result.finalValue = result.deeplResult;
            result.status = "deepl_only";
            context.translationsSucceeded++;
            logger.debug(
              `[${language}] AI failed, keeping DeepL result: "${normalizedKey}"`
            );
          } else {
            // No translation available
            result.status = "failed";
            result.error = aiResult.error ?? "AI translation failed";
            context.translationsFailed++;

            context.errors.push({
              step: this.name,
              message: result.error,
              key: normalizedKey,
              language,
            });

            logger.debug(
              `[${language}] AI failed: "${normalizedKey}" - ${result.error}`
            );
          }
        }
      }
    }

    return context;
  }
}
