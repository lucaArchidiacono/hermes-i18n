import type { FileHandler, LocalizationEntry } from "./types.js";
import { readFileOrNull, writeFileSafe } from "../utils/fs.js";
import { normalize } from "../utils/strings.js";

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
      const value = match[2];
      entries.push({ key: normalize(key), value: normalize(value) });
    }

    return entries;
  }

  /**
   * Serialize entries to .strings file content
   */
  serialize(entries: LocalizationEntry[]): string {
    const lines: string[] = [];

    for (const entry of entries) {
      const key = normalize(entry.key);
      const value = normalize(entry.value);
      lines.push(`"${key}" = "${value}";`);
    }

    return lines.join("\n");
  }
}