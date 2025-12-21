import type { FileHandler, LocalizationEntry } from "./types.js";
import { readFileOrNull, writeFileSafe } from "../utils/fs.js";

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
    const lines = content.split("\n");

    let currentComment: string | undefined;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // Skip empty lines
      if (line === "") {
        i++;
        continue;
      }

      // Single-line comment: /* comment */
      const singleLineComment = line.match(/^\/\*\s*(.*?)\s*\*\/$/);
      if (singleLineComment) {
        currentComment = singleLineComment[1];
        i++;
        continue;
      }

      // Multi-line comment start: /*
      if (line.startsWith("/*") && !line.endsWith("*/")) {
        const commentLines: string[] = [];
        // Remove /* from start
        const firstLine = line.slice(2).trim();
        if (firstLine) {
          commentLines.push(firstLine);
        }
        i++;

        // Read until */
        while (i < lines.length && !lines[i].includes("*/")) {
          commentLines.push(lines[i].trim());
          i++;
        }

        // Handle the closing line
        if (i < lines.length) {
          const closingLine = lines[i].replace("*/", "").trim();
          if (closingLine) {
            commentLines.push(closingLine);
          }
        }

        currentComment = commentLines.join(" ").trim();
        i++;
        continue;
      }

      // Key-value pair: "key" = "value";
      const kvMatch = line.match(/^"(.+?)"\s*=\s*"(.*?)"\s*;?\s*$/);
      if (kvMatch) {
        const key = this.unescapeString(kvMatch[1]);
        const value = this.unescapeString(kvMatch[2]);

        entries.push({
          key,
          value,
          comment: currentComment,
        });

        currentComment = undefined;
        i++;
        continue;
      }

      // Skip unrecognized lines
      i++;
    }

    return entries;
  }

  /**
   * Serialize entries to .strings file content
   */
  serialize(entries: LocalizationEntry[]): string {
    const lines: string[] = [];

    for (const entry of entries) {
      if (entry.comment) {
        lines.push(`/* ${entry.comment} */`);
      }
      const escapedKey = this.escapeString(entry.key);
      const escapedValue = this.escapeString(entry.value);
      lines.push(`"${escapedKey}" = "${escapedValue}";`);
      lines.push(""); // Empty line between entries
    }

    return lines.join("\n");
  }

  /**
   * Escape special characters for .strings format
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }

  /**
   * Unescape special characters from .strings format
   */
  private unescapeString(str: string): string {
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}
