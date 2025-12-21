import type { FileHandler, LocalizationEntry } from "./types.js";
import { readFileOrNull, writeFileSafe } from "../utils/fs.js";

/**
 * Handler for Android strings.xml files
 *
 * Format:
 * ```xml
 * <?xml version="1.0" encoding="utf-8"?>
 * <resources>
 *     <string name="key">value</string>
 *     <!-- comment -->
 *     <string name="another_key">another value</string>
 * </resources>
 * ```
 */
export class XmlHandler implements FileHandler {
  readonly type = "xml" as const;

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
   * Parse XML file content into entries
   */
  parse(content: string): LocalizationEntry[] {
    const trimmed = content.trim();
    if (trimmed === "") {
      return [];
    }

    const entries: LocalizationEntry[] = [];
    
    // Match comments followed by string elements, or just string elements
    const lines = content.split("\n");
    let pendingComment: string | undefined;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check for XML comment
      const commentMatch = trimmedLine.match(/^<!--\s*(.*?)\s*-->$/);
      if (commentMatch) {
        pendingComment = commentMatch[1];
        continue;
      }

      // Check for string element
      const stringMatch = trimmedLine.match(
        /^<string\s+name="([^"]+)">(.*?)<\/string>$/
      );
      if (stringMatch) {
        const key = stringMatch[1];
        const value = this.unescapeXml(stringMatch[2]);

        entries.push({
          key,
          value,
          comment: pendingComment,
        });

        pendingComment = undefined;
        continue;
      }

      // Handle multi-line or complex string elements
      const openTagMatch = trimmedLine.match(/^<string\s+name="([^"]+)">(.*)/);
      if (openTagMatch && !trimmedLine.includes("</string>")) {
        // Multi-line string - for now, skip (Android strings are usually single-line)
        pendingComment = undefined;
      }
    }

    return entries;
  }

  /**
   * Serialize entries to XML file content
   */
  serialize(entries: LocalizationEntry[]): string {
    const lines: string[] = [
      '<?xml version="1.0" encoding="utf-8"?>',
      "<resources>",
    ];

    for (const entry of entries) {
      // Add comment if present
      if (entry.comment) {
        lines.push(`    <!-- ${entry.comment} -->`);
      }

      // Add string element
      const escapedValue = this.escapeXml(entry.value);
      lines.push(`    <string name="${entry.key}">${escapedValue}</string>`);
    }

    lines.push("</resources>");

    return lines.join("\n") + "\n";
  }

  /**
   * Escape special XML characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
  }

  /**
   * Unescape special XML characters
   */
  private unescapeXml(str: string): string {
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"');
  }
}
