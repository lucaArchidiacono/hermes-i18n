// prettier-ignore
export function normalizeKey(key: string): string {
  return key
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '\"')
    .replace(/\\'/g, "\'");
}

export function keysAreEqual(key1: string, key2: string): boolean {
  return normalizeKey(key1) === normalizeKey(key2);
}

export function findKeyNormalized<T>(
  map: Map<string, T>,
  key: string
): T | undefined {
  const normalizedKey = normalizeKey(key);
  const normalizedMap = new Map<string, T>();

  if (map.has(key)) {
    return map.get(key);
  }

  for (const [mapKey, value] of map) {
    normalizedMap.set(normalizeKey(mapKey), value);
  }

  if (normalizedMap.has(normalizedKey)) {
    return normalizedMap.get(normalizedKey);
  }

  return undefined;
}

export function hasKeyNormalized<T>(map: Map<string, T>, key: string): boolean {
  return findKeyNormalized(map, key) !== undefined;
}
