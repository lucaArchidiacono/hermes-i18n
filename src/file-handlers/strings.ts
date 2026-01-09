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
   * 
   * Converts in-memory characters to their escape sequence representation:
   * - Actual newline (char code 10) → \n
   * - Actual carriage return (char code 13) → \r
   * - Actual tab (char code 9) → \t
   * - Double quote → \"
   * - Backslash → \\
   */
  private escapeString(str: string): string {
    let result = "";
    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (char === "\\") {
        result += "\\\\";
      } else if (char === '"') {
        result += '\\"';
      } else if (char === "\n") {
        result += "\\n";
      } else if (char === "\r") {
        result += "\\r";
      } else if (char === "\t") {
        result += "\\t";
      } else {
        result += char;
      }
    }
    return result;
  }

  /**
   * Unescape special characters from .strings format
   * 
   * Converts escape sequences to actual characters:
   * - \n → actual newline (char code 10)
   * - \r → actual carriage return (char code 13)
   * - \t → actual tab (char code 9)
   * - \" → "
   * - \\ → single backslash
   */
  private unescapeString(str: string): string {
    let result = "";
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const nextChar = str[i + 1];

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
