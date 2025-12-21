import { bundleRequire } from "bundle-require";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import type { HermesConfig, ResolvedHermesConfig } from "./types.js";
import {
  DEFAULT_EXTRACT_PATTERN,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_DEEPL_CONFIG,
  DEFAULT_AI_SYSTEM_PROMPT,
  getAIProviderEnvKey,
} from "./defaults.js";
import { logger } from "../utils/logger.js";

/**
 * Default config file names to search for
 */
const CONFIG_FILE_NAMES = [
  "hermes.config.ts",
  "hermes.config.js",
  "hermes.config.mjs",
];

/**
 * Find the config file in the given directory or its parents
 */
export function findConfigFile(startDir: string = process.cwd()): string | null {
  let currentDir = resolve(startDir);

  while (true) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = resolve(currentDir, fileName);
      if (existsSync(configPath)) {
        return configPath;
      }
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
  configPath?: string
): Promise<{ config: ResolvedHermesConfig; configDir: string }> {
  const resolvedPath = configPath
    ? resolve(configPath)
    : findConfigFile();

  if (!resolvedPath) {
    throw new Error(
      "Could not find hermes.config.ts. Run 'hermes init' to create one."
    );
  }

  if (!existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  logger.debug(`Loading config from: ${resolvedPath}`);

  const { mod } = await bundleRequire({
    filepath: resolvedPath,
  });

  const rawConfig: HermesConfig = mod.default ?? mod;

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
 * Validate the raw config
 */
function validateConfig(config: HermesConfig): void {
  if (!config.sourceLanguage) {
    throw new Error("Config error: 'sourceLanguage' is required");
  }

  if (!config.targetLanguages || config.targetLanguages.length === 0) {
    throw new Error("Config error: 'targetLanguages' must have at least one language");
  }

  if (!config.source?.path || !config.source?.type) {
    throw new Error("Config error: 'source.path' and 'source.type' are required");
  }

  if (!config.outputs || config.outputs.length === 0) {
    throw new Error("Config error: 'outputs' must have at least one output configuration");
  }

  for (const output of config.outputs) {
    if (!output.path || !output.type) {
      throw new Error("Config error: Each output must have 'path' and 'type'");
    }
  }

  if (!config.include || config.include.length === 0) {
    throw new Error("Config error: 'include' must have at least one glob pattern");
  }

  if (!config.ai?.provider || !config.ai?.model) {
    throw new Error("Config error: 'ai.provider' and 'ai.model' are required");
  }
}

/**
 * Resolve config with defaults
 */
function resolveConfig(config: HermesConfig): ResolvedHermesConfig {
  const aiEnvKey = getAIProviderEnvKey(config.ai.provider);

  return {
    ...config,
    exclude: config.exclude ?? DEFAULT_EXCLUDE_PATTERNS,
    extractPattern: config.extractPattern ?? DEFAULT_EXTRACT_PATTERN,
    deepl: {
      apiKey: config.deepl?.apiKey ?? process.env.DEEPL_API_KEY ?? "",
      formality: config.deepl?.formality ?? DEFAULT_DEEPL_CONFIG.formality,
    },
    ai: {
      provider: config.ai.provider,
      model: config.ai.model,
      apiKey: config.ai.apiKey ?? process.env[aiEnvKey] ?? "",
      systemPrompt: config.ai.systemPrompt ?? DEFAULT_AI_SYSTEM_PROMPT,
    },
  };
}
