import * as deepl from "deepl-node";
import type { ResolvedDeepLTranslationConfig } from "../config/types.js";
import { logger } from "../utils/logger.js";
import { RateLimiter } from "../utils/rate-limiter.js";
import type { TranslationService, TranslationResult } from "./translator.js";

/**
 * DeepL language codes that are supported
 * Note: DeepL uses different codes for some languages
 */
const DEEPL_LANGUAGE_MAP: Record<string, deepl.TargetLanguageCode> = {
  // Direct mappings
  bg: "bg",
  cs: "cs",
  da: "da",
  de: "de",
  el: "el",
  es: "es",
  et: "et",
  fi: "fi",
  fr: "fr",
  hu: "hu",
  id: "id",
  it: "it",
  ja: "ja",
  ko: "ko",
  lt: "lt",
  lv: "lv",
  nb: "nb",
  nl: "nl",
  pl: "pl",
  ro: "ro",
  ru: "ru",
  sk: "sk",
  sl: "sl",
  sv: "sv",
  tr: "tr",
  uk: "uk",
  zh: "zh",
  he: "he",
  "zh-hans": "zh-HANS",
  "zh-hant": "zh-HANT",
  // Special cases
  "en-us": "en-US",
  "en-gb": "en-GB",
  "pt-br": "pt-BR",
  "pt-pt": "pt-PT",
  en: "en-US", // Default to US English
  pt: "pt-PT", // Default to European Portuguese
};

const DEEPL_SOURCE_LANGUAGE_MAP: Record<string, deepl.SourceLanguageCode> = {
  bg: "bg",
  cs: "cs",
  da: "da",
  de: "de",
  el: "el",
  en: "en",
  es: "es",
  et: "et",
  fi: "fi",
  fr: "fr",
  hu: "hu",
  id: "id",
  it: "it",
  ja: "ja",
  ko: "ko",
  lt: "lt",
  lv: "lv",
  nb: "nb",
  nl: "nl",
  pl: "pl",
  pt: "pt",
  ro: "ro",
  ru: "ru",
  sk: "sk",
  sl: "sl",
  sv: "sv",
  tr: "tr",
  uk: "uk",
  zh: "zh",
};

/**
 * DeepL translation service
 */
export class DeepLService implements TranslationService {
  private translator: deepl.Translator | null = null;
  private apiKey: string;
  private formality: deepl.Formality;
  private rateLimiter: RateLimiter;

  constructor(config: ResolvedDeepLTranslationConfig) {
    this.apiKey = config.apiKey;
    this.formality = this.mapFormality(config.formality);
    // DeepL API limit is 50 requests per second
    this.rateLimiter = new RateLimiter(50);
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.apiKey !== "";
  }

  /**
   * Get or create the translator instance
   */
  private getTranslator(): deepl.Translator {
    if (!this.translator) {
      if (!this.apiKey) {
        throw new Error("DeepL API key is not configured");
      }
      this.translator = new deepl.Translator(this.apiKey);
    }
    return this.translator;
  }

  /**
   * Translate text from source to target language
   */
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult> {
    // Check if source language is supported
    const sourceLang = this.mapSourceLanguage(sourceLanguage);
    if (!sourceLang) {
      return {
        success: false,
        skipped: true,
        skipReason: `Source language '${sourceLanguage}' not supported by DeepL`,
      };
    }

    // Check if target language is supported
    const targetLang = this.mapTargetLanguage(targetLanguage);
    if (!targetLang) {
      return {
        success: false,
        skipped: true,
        skipReason: `Target language '${targetLanguage}' not supported by DeepL`,
      };
    }

    // Skip if source and target are the same
    if (sourceLang === targetLang || sourceLanguage === targetLanguage) {
      return {
        success: false,
        skipped: true,
        skipReason: "Source and target languages are the same",
      };
    }

    try {
      // Use rate limiter to ensure we don't exceed API limits
      const result = await this.rateLimiter.execute(async () => {
        const translator = this.getTranslator();
        return await translator.translateText(text, sourceLang, targetLang, {
          formality: this.formality,
          preserveFormatting: true,
          modelType: "quality_optimized",
        });
      });

      return {
        success: true,
        translation: result.text,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(`DeepL translation failed: ${message}`);

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Map our language code to DeepL source language code
   */
  private mapSourceLanguage(lang: string): deepl.SourceLanguageCode | null {
    const normalized = lang.toLowerCase();
    return DEEPL_SOURCE_LANGUAGE_MAP[normalized] ?? null;
  }

  /**
   * Map our language code to DeepL target language code
   */
  private mapTargetLanguage(lang: string): deepl.TargetLanguageCode | null {
    const normalized = lang.toLowerCase();
    return DEEPL_LANGUAGE_MAP[normalized] ?? null;
  }

  /**
   * Map formality setting
   */
  private mapFormality(
    formality: ResolvedDeepLTranslationConfig["formality"],
  ): deepl.Formality {
    switch (formality) {
      case "more":
        return "more";
      case "less":
        return "less";
      case "prefer_more":
        return "prefer_more";
      case "prefer_less":
        return "prefer_less";
      default:
        return "default";
    }
  }
}
