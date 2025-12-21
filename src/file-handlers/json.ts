import type { FileHandler, LocalizationEntry } from "./types.js";
import { readFileOrNull, writeFileSafe } from "../utils/fs.js";

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
          entries.push({ key, value });
        } else if (typeof value === "object" && value !== null) {
          // Support for nested format with value and comment
          const obj = value as Record<string, unknown>;
          if (typeof obj.value === "string") {
            entries.push({
              key,
              value: obj.value,
              comment: typeof obj.comment === "string" ? obj.comment : undefined,
            });
          }
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
      data[entry.key] = entry.value;
    }

    return JSON.stringify(data, null, 2) + "\n";
  }
}
