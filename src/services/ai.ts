import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import type { ResolvedStryngzConfig, AIProvider } from "../config/types.js";
import { logger } from "../utils/logger.js";

/**
 * Result of an AI translation attempt
 */
export interface AIResult {
  success: boolean;
  translation?: string;
  error?: string;
}

/**
 * AI translation service using Vercel AI SDK
 */
export class AIService {
  private config: ResolvedStryngzConfig["ai"];

  constructor(config: ResolvedStryngzConfig["ai"]) {
    this.config = config;
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.config.apiKey !== "";
  }

  /**
   * Refine or translate text using AI
   */
  async translate(
    sourceText: string,
    sourceLanguage: string,
    targetLanguage: string,
    referenceTranslation?: string
  ): Promise<AIResult> {
    if (!this.config.apiKey) {
      return {
        success: false,
        error: "AI API key is not configured",
      };
    }

    try {
      const model = this.createModel();
      const prompt = this.buildPrompt(
        sourceText,
        sourceLanguage,
        targetLanguage,
        referenceTranslation
      );

      const result = await generateText({
        model,
        system: this.config.systemPrompt,
        prompt,
      });

      const translation = result.text.trim();

      if (!translation) {
        return {
          success: false,
          error: "AI returned empty response",
        };
      }

      return {
        success: true,
        translation,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(`AI translation failed: ${message}`);

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Create the AI model based on configuration
   */
  private createModel() {
    const { provider, model, apiKey } = this.config;

    switch (provider) {
      case "openai": {
        const openai = createOpenAI({ apiKey });
        return openai(model);
      }
      case "anthropic": {
        const anthropic = createAnthropic({ apiKey });
        return anthropic(model);
      }
      case "google": {
        const google = createGoogleGenerativeAI({ apiKey });
        return google(model);
      }
      case "mistral": {
        const mistral = createMistral({ apiKey });
        return mistral(model);
      }
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }

  /**
   * Build the prompt for the AI
   */
  private buildPrompt(
    sourceText: string,
    sourceLanguage: string,
    targetLanguage: string,
    referenceTranslation?: string
  ): string {
    let prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}.\n\n`;
    prompt += `Source text: "${sourceText}"\n`;

    if (referenceTranslation) {
      prompt += `\nReference translation: "${referenceTranslation}"\n`;
      prompt += `\nPlease review and improve this translation if needed, or confirm it if it's good.`;
    } else {
      prompt += `\nPlease provide the translation.`;
    }

    prompt += `\n\nReturn ONLY the translated text, nothing else.`;

    return prompt;
  }
}
