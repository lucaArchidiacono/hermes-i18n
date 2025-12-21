import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve, isAbsolute } from "path";

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Ensure the parent directory of a file exists
 */
export function ensureParentDir(filePath: string): void {
  const parentDir = dirname(filePath);
  ensureDir(parentDir);
}

/**
 * Read a file as UTF-8 string, returns null if file doesn't exist
 */
export function readFileOrNull(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, "utf-8");
}

/**
 * Write content to a file, creating parent directories if needed
 */
export function writeFileSafe(filePath: string, content: string): void {
  ensureParentDir(filePath);
  writeFileSync(filePath, content, "utf-8");
}

/**
 * Resolve a path relative to a base directory
 */
export function resolvePath(path: string, baseDir: string): string {
  if (isAbsolute(path)) {
    return path;
  }
  return resolve(baseDir, path);
}

/**
 * Replace {lang} placeholder in a path with the actual language code
 */
export function replaceLanguagePlaceholder(
  pathPattern: string,
  language: string
): string {
  return pathPattern.replace(/\{lang\}/g, language);
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}
