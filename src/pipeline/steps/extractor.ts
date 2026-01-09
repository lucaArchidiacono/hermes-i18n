import { glob } from "glob";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { PipelineStep, PipelineContext } from "../types.js";
import { logger } from "../../utils/logger.js";

/**
 * Extractor step - scans source code for translation keys
 * Finds all _("key") patterns in the codebase
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
        logger.debug(`Failed to read file: ${filePath}`);
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
        // Process escape sequences to convert literal \n to actual newline, etc.
        // This is necessary because the regex captures the raw text from the file,
        // where \n is two characters (backslash + n), but semantically it represents
        // a single newline character.
        const processedKey = this.processEscapeSequences(match[1]);
        keys.push(processedKey);
      }
    }

    return keys;
  }

  /**
   * Process escape sequences in extracted keys.
   * Converts literal escape sequences (like \n, \t, \r) to their actual character values.
   *
   * This is needed because when we extract tr("Hello\nWorld") from source code,
   * the regex captures "Hello\nWorld" where \n is literally backslash + n (2 chars).
   * But semantically, the developer intended a newline character (1 char).
   *
   * @param key - The raw extracted key with literal escape sequences
   * @returns The key with escape sequences converted to actual characters
   */
  private processEscapeSequences(key: string): string {
    let result = "";
    for (let i = 0; i < key.length; i++) {
      const char = key[i];
      const nextChar = key[i + 1];

      if (char === "\\" && nextChar !== undefined) {
        switch (nextChar) {
          case "n":
            result += "\n";
            i++;
            break;
          case "r":
            result += "\r";
            i++;
            break;
          case "t":
            result += "\t";
            i++;
            break;
          case '"':
            result += '"';
            i++;
            break;
          case "'":
            result += "'";
            i++;
            break;
          case "\\":
            result += "\\";
            i++;
            break;
          default:
            // Unknown escape sequence - keep as-is
            result += char;
            break;
        }
      } else {
        result += char;
      }
    }
    return result;
  }
}
