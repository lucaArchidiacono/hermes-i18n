import type { FileHandler, LocalizationEntry } from "./types.js";
import { readFileOrNull, writeFileSafe } from "../utils/fs.js";
import { normalize, unescape } from "../utils/strings.js";
import { logger } from "../utils/logger.js";

/**
 * Handler for JSON localization files
 *
 * Format:
 * ```json
 * {
 *   "key": "value",
 *   "another_key": "another value"
 * }
 * ```
 */
export class JsonHandler implements FileHandler {
  readonly type = "json" as const;

  async read(filePath: string): Promise<LocalizationEntry[]> {
    const content = readFileOrNull(filePath);
    if (content === null) {
      return [];
    }

    return this.parse(content);
  }

  async write(filePath: string, entries: LocalizationEntry[]): Promise<void> {
    const content = this.serialize(entries);
    writeFileSafe(filePath, content);
  }

  /**
   * Parse JSON file content into entries
   */
  parse(content: string): LocalizationEntry[] {
    const trimmed = content.trim();
    if (trimmed === "" || trimmed === "{}") {
      return [];
    }

    try {
      const data = JSON.parse(content);
      const entries: LocalizationEntry[] = [];

      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string") {
          entries.push({ key: normalize(key), value: normalize(value) });
        } else {
          logger.error(`Invalid JSON value for key: ${key}`, {
            key,
            value,
          });
        }
      }

      return entries;
    } catch {
      throw new Error(`Failed to parse JSON file: Invalid JSON`);
    }
  }

  /**
   * Serialize entries to JSON file content
   */
  serialize(entries: LocalizationEntry[]): string {
    const data: Record<string, string> = {};

    for (const entry of entries) {
      const key = normalize(entry.key);
      const value = normalize(entry.value);
      data[key] = value;
    }

    return JSON.stringify(data, null, 2) + "\n";
  }
}