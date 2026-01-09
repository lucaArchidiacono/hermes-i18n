/**
 * String utilities for localization key handling
 */

/**
 * Normalize a key for comparison purposes.
 * Converts literal escape sequences (backslash followed by character)
 * to their actual character representations.
 *
 * This is used to compare keys extracted from source code (which contain
 * literal escape sequences like \n) with keys from localization files
 * (which may have actual newline characters).
 *
 * @param key - The key to normalize
 * @returns The normalized key with escape sequences converted to actual characters
 *
 * @example
 * // Extracted from source: "Hello\nWorld" (literal backslash + n)
 * normalizeKey("Hello\\nWorld") // returns "Hello\nWorld" (actual newline)
 */
export function normalizeKey(key: string): string {
  // IMPORTANT: Order matters! Process \\\\ first to avoid double-processing
  // For example: \\n should become \n (literal), not be converted to newline
  return key
    .replace(/\\\\/g, "\0BACKSLASH\0") // Temporarily replace \\ to avoid conflicts
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\0BACKSLASH\0/g, "\\"); // Restore single backslashes
}

/**
 * Check if two keys are equivalent after normalization.
 * This handles the case where one key has literal escape sequences
 * and the other has actual characters.
 *
 * @param key1 - First key to compare
 * @param key2 - Second key to compare
 * @returns true if the keys are equivalent after normalization
 *
 * @example
 * keysAreEqual("Hello\\nWorld", "Hello\nWorld") // returns true
 * keysAreEqual("Hello\\nWorld", "Hello\\nWorld") // returns true
 * keysAreEqual("Hello", "World") // returns false
 */
export function keysAreEqual(key1: string, key2: string): boolean {
  return normalizeKey(key1) === normalizeKey(key2);
}

/**
 * Find a key in a map, considering normalized equivalence.
 * Returns the value if found, undefined otherwise.
 *
 * @param map - The map to search in
 * @param key - The key to find (will be normalized for comparison)
 * @returns The value if found, undefined otherwise
 */
export function findKeyNormalized<T>(
  map: Map<string, T>,
  key: string
): T | undefined {
  const normalizedKey = normalizeKey(key);

  // First try exact match
  if (map.has(key)) {
    return map.get(key);
  }

  // Then try normalized match
  for (const [mapKey, value] of map) {
    if (normalizeKey(mapKey) === normalizedKey) {
      return value;
    }
  }

  return undefined;
}

/**
 * Check if a key exists in a map, considering normalized equivalence.
 *
 * @param map - The map to search in
 * @param key - The key to find (will be normalized for comparison)
 * @returns true if the key exists (exact or normalized match)
 */
export function hasKeyNormalized<T>(map: Map<string, T>, key: string): boolean {
  return findKeyNormalized(map, key) !== undefined;
}
