import type { ResolvedStryngzConfig } from "../config/types.js";
import { logger } from "../utils/logger.js";
import { RateLimiter } from "../utils/rate-limiter.js";
import type { TranslationService, TranslationResult } from "./translator.js";

/**
 * Google Translate API response structure
 */
interface GoogleTranslateResponse {
  data?: {
    translations?: Array<{
      translatedText?: string;
    }>;
  };
}

/**
 * Google Translate language codes mapping
 * Google Translate supports a wide range of languages
 */
const GOOGLE_LANGUAGE_MAP: Record<string, string> = {
  // Common languages
  af: "af",
  sq: "sq",
  am: "am",
  ar: "ar",
  hy: "hy",
  az: "az",
  eu: "eu",
  be: "be",
  bn: "bn",
  bs: "bs",
  bg: "bg",
  ca: "ca",
  ceb: "ceb",
  zh: "zh-CN",
  "zh-cn": "zh-CN",
  "zh-hans": "zh-CN",
  "zh-tw": "zh-TW",
  "zh-hant": "zh-TW",
  co: "co",
  hr: "hr",
  cs: "cs",
  da: "da",
  nl: "nl",
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  eo: "eo",
  et: "et",
  fi: "fi",
  fr: "fr",
  fy: "fy",
  gl: "gl",
  ka: "ka",
  de: "de",
  el: "el",
  gu: "gu",
  ht: "ht",
  ha: "ha",
  haw: "haw",
  he: "he",
  hi: "hi",
  hmn: "hmn",
  hu: "hu",
  is: "is",
  ig: "ig",
  id: "id",
  ga: "ga",
  it: "it",
  ja: "ja",
  jv: "jv",
  kn: "kn",
  kk: "kk",
  km: "km",
  rw: "rw",
  ko: "ko",
  ku: "ku",
  ky: "ky",
  lo: "lo",
  la: "la",
  lv: "lv",
  lt: "lt",
  lb: "lb",
  mk: "mk",
  mg: "mg",
  ms: "ms",
  ml: "ml",
  mt: "mt",
  mi: "mi",
  mr: "mr",
  mn: "mn",
  my: "my",
  ne: "ne",
  no: "no",
  nb: "nb",
  ny: "ny",
  or: "or",
  ps: "ps",
  fa: "fa",
  pl: "pl",
  pt: "pt",
  "pt-br": "pt",
  "pt-pt": "pt",
  pa: "pa",
  ro: "ro",
  ru: "ru",
  sm: "sm",
  gd: "gd",
  sr: "sr",
  st: "st",
  sn: "sn",
  sd: "sd",
  si: "si",
  sk: "sk",
  sl: "sl",
  so: "so",
  es: "es",
  su: "su",
  sw: "sw",
  sv: "sv",
  tl: "tl",
  tg: "tg",
  ta: "ta",
  tt: "tt",
  te: "te",
  th: "th",
  tr: "tr",
  tk: "tk",
  uk: "uk",
  ur: "ur",
  ug: "ug",
  uz: "uz",
  vi: "vi",
  cy: "cy",
  xh: "xh",
  yi: "yi",
  yo: "yo",
  zu: "zu",
};

/**
 * Google Translate translation service
 */
export class GoogleTranslateService implements TranslationService {
  private apiKey: string;
  private rateLimiter: RateLimiter;
  private baseUrl = "https://translation.googleapis.com/language/translate/v2";

  constructor(config: ResolvedStryngzConfig["googleTranslate"]) {
    this.apiKey = config.apiKey;
    // Google Translate API has limits depending on your plan
    // Using a conservative rate of 100 requests per second
    this.rateLimiter = new RateLimiter(100);
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.apiKey !== "";
  }

  /**
   * Translate text from source to target language
   */
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult> {
    // Map language codes
    const sourceLang = this.mapLanguage(sourceLanguage);
    const targetLang = this.mapLanguage(targetLanguage);

    if (!sourceLang) {
      return {
        success: false,
        skipped: true,
        skipReason: `Source language '${sourceLanguage}' not supported by Google Translate`,
      };
    }

    if (!targetLang) {
      return {
        success: false,
        skipped: true,
        skipReason: `Target language '${targetLanguage}' not supported by Google Translate`,
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
        const url = new URL(this.baseUrl);
        url.searchParams.append("key", this.apiKey);
        url.searchParams.append("q", text);
        url.searchParams.append("source", sourceLang);
        url.searchParams.append("target", targetLang);
        url.searchParams.append("format", "text");

        const response = await fetch(url.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Google Translate API error: ${response.status} - ${errorText}`
          );
        }

        const data = (await response.json()) as GoogleTranslateResponse;
        return data;
      });

      const translatedText = result?.data?.translations?.[0]?.translatedText;
      if (translatedText) {
        return {
          success: true,
          translation: translatedText,
        };
      }

      return {
        success: false,
        error: "Invalid response from Google Translate API",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(`Google Translate translation failed: ${message}`);

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Map language code to Google Translate language code
   */
  private mapLanguage(lang: string): string | null {
    const normalized = lang.toLowerCase();
    return GOOGLE_LANGUAGE_MAP[normalized] ?? null;
  }
}
