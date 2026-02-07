// prettier-ignore
export function unescape(key: string): string {
  return key
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"');
}

// prettier-ignore
export function escape(key: string): string {
  return key
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/"/g, '\"');
}

export function normalize(key: string): string {
  return escape(unescape(key));
}

export function keysAreEqual(key1: string, key2: string): boolean {
  return normalize(key1) === normalize(key2);
}

export function findKey<T>(map: Map<string, T>, key: string): T | undefined {
  const normalizedKey = normalize(key);
  const normalizedMap = new Map<string, T>();

  if (map.has(key)) {
    return map.get(key);
  }

  for (const [mapKey, mapValue] of map) {
    normalizedMap.set(normalize(mapKey), mapValue);
  }

  if (normalizedMap.has(normalizedKey)) {
    return normalizedMap.get(normalizedKey);
  }

  return undefined;
}

export function hasKey<T>(map: Map<string, T>, key: string): boolean {
  return findKey(map, key) !== undefined;
}
