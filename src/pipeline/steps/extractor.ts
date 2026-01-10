import { glob } from "glob";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { PipelineStep, PipelineContext } from "../types.js";
import { logger } from "../../utils/logger.js";

/**
 * Extractor step - scans source code for translation keys
 * Finds all keys based on the provided config patttern in the codebase
 */
export class ExtractorStep implements PipelineStep {
  name = "extractor";

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { config, baseDir } = context;
    const allKeys = new Set<string>();

    // Get all files matching include patterns
    const files: string[] = [];
    for (const pattern of config.include) {
      const matches = await glob(pattern, {
        cwd: baseDir,
        ignore: config.exclude,
        absolute: true,
        nodir: true,
      });
      files.push(...matches);
    }

    logger.info(`Scanning ${files.length} files for translation keys...`);

    // Extract keys from each file
    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const keys = this.extractKeys(content, config.extractPattern);

        for (const key of keys) {
          allKeys.add(key);
        }
      } catch (error) {
        logger.warn(`Failed to read file: ${filePath}`, { error });
      }
    }

    const keysArray = Array.from(allKeys).sort();
    logger.info(`Found ${keysArray.length} unique translation keys`);

    context.extractedKeys = keysArray;
    return context;
  }

  /**
   * Extract all translation keys from file content
   */
  private extractKeys(content: string, pattern: RegExp): string[] {
    const keys: string[] = [];

    // Create a new RegExp instance to reset lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        logger.debug(`Found key: ${JSON.stringify(match[1])}`);
        keys.push(match[1]);
      }
    }

    return keys;
  }
}
