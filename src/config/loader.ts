import { resolve, dirname } from "path";
import { existsSync, readFileSync } from "fs";
import type {
  StryngzConfig,
  ResolvedStryngzConfig,
  TranslationConfig,
  MachineTranslationProviderName,
  AIProviderName,
} from "./types.js";
import {
  DEFAULT_EXTRACT_PATTERN,
  DEFAULT_EXCLUDE_PATTERNS,
  resolveTranslationConfig,
  resolveRefinerConfig,
} from "./defaults.js";
import { logger } from "../utils/logger.js";

/**
 * Default config file name
 */
const CONFIG_FILE_NAME = "stryngz.config.json";

/** All valid provider names */
const VALID_MACHINE_PROVIDERS: readonly string[] = [
  "deepl",
  "google-translate",
] satisfies MachineTranslationProviderName[];

const VALID_AI_PROVIDERS: readonly string[] = [
  "openai",
  "anthropic",
  "google-ai",
  "mistral",
] satisfies AIProviderName[];

const VALID_PROVIDERS: readonly string[] = [
  ...VALID_MACHINE_PROVIDERS,
  ...VALID_AI_PROVIDERS,
];

/**
 * Find the config file in the given directory or its parents
 */
export function findConfigFile(
  startDir: string = process.cwd(),
): string | null {
  let currentDir = resolve(startDir);

  while (true) {
    const configPath = resolve(currentDir, CONFIG_FILE_NAME);
    if (existsSync(configPath)) {
      return configPath;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root directory
      return null;
    }
    currentDir = parentDir;
  }
}

/**
 * Load and parse the config file
 */
export async function loadConfig(
  configPath?: string,
): Promise<{ config: ResolvedStryngzConfig; configDir: string }> {
  const resolvedPath = configPath ? resolve(configPath) : findConfigFile();

  if (!resolvedPath) {
    throw new Error(
      "Could not find stryngz.config.json. Run 'stryngz init' to create one.",
    );
  }

  if (!existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  logger.debug(`Loading config from: ${resolvedPath}`);

  const fileContent = readFileSync(resolvedPath, "utf-8");
  const rawConfig: StryngzConfig = JSON.parse(fileContent);

  // Validate required fields
  validateConfig(rawConfig);

  // Resolve config with defaults
  const resolvedConfig = resolveConfig(rawConfig);

  return {
    config: resolvedConfig,
    configDir: dirname(resolvedPath),
  };
}

/**
 * Validate a single translation config entry
 */
function validateTranslationEntry(
  entry: TranslationConfig,
  index: number,
): void {
  if (!entry.provider) {
    throw new Error(
      `Config error: translations[${index}] must have a 'provider'`,
    );
  }

  if (!VALID_PROVIDERS.includes(entry.provider)) {
    throw new Error(
      `Config error: translations[${index}].provider '${entry.provider}' is not valid. Must be one of: ${VALID_PROVIDERS.join(", ")}`,
    );
  }

  // AI providers require a model
  if (
    VALID_AI_PROVIDERS.includes(entry.provider) &&
    !("model" in entry && entry.model)
  ) {
    throw new Error(
      `Config error: translations[${index}] with provider '${entry.provider}' must have a 'model'`,
    );
  }
}

/**
 * Validate the raw config
 */
function validateConfig(config: StryngzConfig): void {
  if (!config.sourceLanguage) {
    throw new Error("Config error: 'sourceLanguage' is required");
  }

  if (!config.targetLanguages || config.targetLanguages.length === 0) {
    throw new Error(
      "Config error: 'targetLanguages' must have at least one language",
    );
  }

  if (!config.source?.path || !config.source?.type) {
    throw new Error(
      "Config error: 'source.path' and 'source.type' are required",
    );
  }

  if (!config.outputs || config.outputs.length === 0) {
    throw new Error(
      "Config error: 'outputs' must have at least one output configuration",
    );
  }

  for (const output of config.outputs) {
    if (!output.path || !output.type) {
      throw new Error("Config error: Each output must have 'path' and 'type'");
    }
  }

  if (!config.include || config.include.length === 0) {
    throw new Error(
      "Config error: 'include' must have at least one glob pattern",
    );
  }

  // Validate translations array
  if (!config.translations || config.translations.length === 0) {
    throw new Error(
      "Config error: 'translations' must have at least one provider",
    );
  }

  for (let i = 0; i < config.translations.length; i++) {
    validateTranslationEntry(config.translations[i], i);
  }

  // Validate optional refiner
  if (config.refiner) {
    if (!config.refiner.provider) {
      throw new Error("Config error: 'refiner.provider' is required");
    }
    if (!VALID_AI_PROVIDERS.includes(config.refiner.provider)) {
      throw new Error(
        `Config error: refiner.provider '${config.refiner.provider}' is not valid. Must be one of: ${VALID_AI_PROVIDERS.join(", ")}`,
      );
    }
    if (!config.refiner.model) {
      throw new Error("Config error: 'refiner.model' is required");
    }
  }
}

/**
 * Resolve config with defaults
 */
function resolveConfig(config: StryngzConfig): ResolvedStryngzConfig {
  return {
    ...config,
    exclude: config.exclude ?? DEFAULT_EXCLUDE_PATTERNS,
    extractPattern: config.extractPattern
      ? new RegExp(config.extractPattern, "g")
      : DEFAULT_EXTRACT_PATTERN,
    translations: config.translations.map(resolveTranslationConfig),
    refiner: config.refiner ? resolveRefinerConfig(config.refiner) : undefined,
  };
}
