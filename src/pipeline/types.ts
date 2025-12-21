import type { ResolvedHermesConfig } from "../config/types.js";
import type { LocalizationEntry } from "../file-handlers/types.js";

/**
 * Result of a single translation
 */
export interface TranslationResult {
  /** The translation key */
  key: string;
  /** The original source value */
  sourceValue: string;
  /** The target language code */
  targetLanguage: string;
  /** Result from DeepL (if successful) */
  deeplResult?: string;
  /** Result from AI refinement (if successful) */
  aiResult?: string;
  /** The final translation to use */
  finalValue: string;
  /** Status of this translation */
  status: "success" | "deepl_only" | "ai_only" | "failed";
  /** Error message if failed */
  error?: string;
}

/**
 * Translation data for a single target language
 */
export interface LanguageTranslations {
  /** Target language code */
  language: string;
  /** Existing translations (already in target file) */
  existing: Map<string, LocalizationEntry>;
  /** Keys that need translation (key -> source value) */
  missing: Map<string, string>;
  /** Translation results */
  results: Map<string, TranslationResult>;
}

/**
 * An error that occurred during pipeline execution
 */
export interface PipelineError {
  /** Step where the error occurred */
  step: string;
  /** Error message */
  message: string;
  /** Related key (if applicable) */
  key?: string;
  /** Related language (if applicable) */
  language?: string;
}

/**
 * Context passed through pipeline steps
 */
export interface PipelineContext {
  /** Resolved configuration */
  config: ResolvedHermesConfig;
  /** Base directory (where config file is located) */
  baseDir: string;
  /** Whether this is a dry run (no file writes) */
  dryRun: boolean;

  // Populated by extractor step
  /** All keys extracted from source code */
  extractedKeys: string[];

  // Populated by source sync step
  /** Current entries in the source file */
  sourceEntries: Map<string, LocalizationEntry>;
  /** Keys that were added to the source file */
  newSourceKeys: string[];

  // Populated by missing finder step
  /** Translation data per target language */
  translations: Map<string, LanguageTranslations>;

  // Accumulated errors (non-fatal)
  /** Errors encountered during pipeline execution */
  errors: PipelineError[];

  // Statistics
  /** Count of translations attempted */
  translationsAttempted: number;
  /** Count of successful translations */
  translationsSucceeded: number;
  /** Count of failed translations */
  translationsFailed: number;
}

/**
 * A single step in the pipeline
 */
export interface PipelineStep {
  /** Name of this step */
  name: string;

  /**
   * Execute this step
   * @param context - The pipeline context
   * @returns Updated context
   */
  execute(context: PipelineContext): Promise<PipelineContext>;
}

/**
 * Create an initial pipeline context
 */
export function createPipelineContext(
  config: ResolvedHermesConfig,
  baseDir: string,
  dryRun: boolean
): PipelineContext {
  return {
    config,
    baseDir,
    dryRun,
    extractedKeys: [],
    sourceEntries: new Map(),
    newSourceKeys: [],
    translations: new Map(),
    errors: [],
    translationsAttempted: 0,
    translationsSucceeded: 0,
    translationsFailed: 0,
  };
}
