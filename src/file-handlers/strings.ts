import type { FileHandler, LocalizationEntry } from "./types.js";
import { readFileOrNull, writeFileSafe } from "../utils/fs.js";
import { normalize } from "@/utils/strings.js";

const KEY_VALUE_PAIR_REGEX =
  /"([^"\\]*(?:\\.[^"\\]*)*)"\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*;/g;

/**
 * Handler for iOS Localizable.strings files
 *
 * Format:
 * ```
 * /* Optional comment *\/
 * "key" = "value";
 * ```
 */
export class StringsHandler implements FileHandler {
  readonly type = "strings" as const;

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
   * Parse .strings file content into entries
   */
  parse(content: string): LocalizationEntry[] {
    const entries: LocalizationEntry[] = [];

    let match;
    while ((match = KEY_VALUE_PAIR_REGEX.exec(content)) !== null) {
      const key = match[1];
      const normalizedKey = normalize(key);
      const value = match[2];
      const normalizedValue = normalize(value);
      entries.push({ key: normalizedKey, value: normalizedValue });
    }

    return entries;
  }

  /**
   * Serialize entries to .strings file content
   */
  serialize(entries: LocalizationEntry[]): string {
    const lines: string[] = [];

    for (const entry of entries) {
      const normalizedKey = normalize(entry.key);
      const normalizedValue = normalize(entry.value);
      lines.push(`"${normalizedKey}" = "${normalizedValue}";`);
    }

    return lines.join("\n");
  }
}
