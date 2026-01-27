/**
 * Result of a translation attempt
 */
export interface TranslationResult {
  success: boolean;
  translation?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Base interface for translation services
 */
export interface TranslationService {
  /**
   * Check if the service is configured
   */
  isConfigured(): boolean;

  /**
   * Translate text from source to target language
   */
  translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult>;
}
