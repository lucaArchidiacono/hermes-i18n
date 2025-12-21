import type { FileType } from "../config/types.js";

/**
 * A single localization entry (key-value pair with optional comment)
 */
export interface LocalizationEntry {
  /** The localization key */
  key: string;
  /** The translated/source value */
  value: string;
  /** Optional comment for context */
  comment?: string;
}

/**
 * Interface for file format handlers
 * Each handler knows how to read and write a specific localization file format
 */
export interface FileHandler {
  /** The file type this handler supports */
  readonly type: FileType;

  /**
   * Read and parse a localization file
   * @param filePath - Path to the file
   * @returns Array of localization entries, empty array if file doesn't exist
   */
  read(filePath: string): Promise<LocalizationEntry[]>;

  /**
   * Write localization entries to a file
   * Creates parent directories if they don't exist
   * @param filePath - Path to the file
   * @param entries - Array of localization entries to write
   */
  write(filePath: string, entries: LocalizationEntry[]): Promise<void>;
}
