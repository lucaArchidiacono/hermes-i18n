import { describe, it, expect } from "vitest";
import {
  normalize,
  keysAreEqual,
  findKey,
  hasKey,
  escape,
  unescape,
} from "../../src/utils/strings.js";

describe("String utilities", () => {
  describe("unescape", () => {
    it("should convert literal backslash-n to actual newline", () => {
      const result = unescape("Hello\\nWorld");
      expect(result).toBe("Hello\nWorld");
      expect(result.length).toBe(11); // actual newline is 1 char
    });

    it("should convert literal backslash-r to actual carriage return", () => {
      const result = unescape("Hello\\rWorld");
      expect(result).toBe("Hello\rWorld");
    });

    it("should convert literal backslash-t to actual tab", () => {
      const result = unescape("Hello\\tWorld");
      expect(result).toBe("Hello\tWorld");
    });

    it("should NOT unescape quotes (quotes are literal)", () => {
      // Quotes are no longer escaped/unescaped - they pass through as-is
      const result = unescape('say "hello"');
      expect(result).toBe('say "hello"');
    });

    it("should NOT unescape single quotes (quotes are literal)", () => {
      // Single quotes pass through as-is
      const result = unescape("say 'hello'");
      expect(result).toBe("say 'hello'");
    });

    it("should convert double backslash to single backslash", () => {
      // Note: \\t after \\\\ -> \\ becomes \ then \t becomes tab
      // This is the expected behavior: first \\\\ -> \\, then \\t -> \t -> tab
      const result = unescape("path\\\\to\\\\file");
      // \\\\ -> \\ (first replace), then \\t -> tab, \\f stays as \f (not a recognized escape)
      expect(result).toBe("path\to\\file");
    });
  });

  describe("escape", () => {
    it("should convert actual newline to literal backslash-n", () => {
      const result = escape("Hello\nWorld");
      expect(result).toBe("Hello\\nWorld");
    });

    it("should convert actual tab to literal backslash-t", () => {
      const result = escape("Hello\tWorld");
      expect(result).toBe("Hello\\tWorld");
    });

    it("should convert actual carriage return to literal backslash-r", () => {
      const result = escape("Hello\rWorld");
      expect(result).toBe("Hello\\rWorld");
    });

    it("should NOT escape double quote (quotes are literal)", () => {
      // Double quotes are no longer escaped - they pass through as-is
      const result = escape('say "hello"');
      expect(result).toBe('say "hello"');
    });

    it("should NOT escape single quote (quotes are literal)", () => {
      // Single quotes are left as-is, not escaped
      const result = escape("say 'hello'");
      expect(result).toBe("say 'hello'");
    });

    it("should convert single backslash to double backslash", () => {
      const result = escape("path\\to\\file");
      expect(result).toBe("path\\\\to\\\\file");
    });
  });

  describe("normalize", () => {
    it("should normalize escaped string to escaped form", () => {
      // normalize = escape(unescape(x)) - always returns escaped form
      const result = normalize("Hello\\nWorld");
      expect(result).toBe("Hello\\nWorld");
    });

    it("should normalize actual newline to escaped form", () => {
      const result = normalize("Hello\nWorld");
      expect(result).toBe("Hello\\nWorld");
    });

    it("should normalize actual tab to escaped form", () => {
      const result = normalize("Hello\tWorld");
      expect(result).toBe("Hello\\tWorld");
    });

    it("should be idempotent", () => {
      const input = "Hello\\nWorld";
      const once = normalize(input);
      const twice = normalize(once);
      expect(twice).toBe(once);
    });

    it("should handle complex strings idempotently", () => {
      const input = 'line1\\nline2\\ttab"quote"';
      const once = normalize(input);
      const twice = normalize(once);
      expect(twice).toBe(once);
    });

    it("should handle empty string", () => {
      expect(normalize("")).toBe("");
    });

    it("should handle simple string without escapes", () => {
      expect(normalize("Hello World")).toBe("Hello World");
    });
  });

  describe("keysAreEqual", () => {
    it("should return true for identical keys", () => {
      expect(keysAreEqual("Hello", "Hello")).toBe(true);
    });

    it("should return true for literal vs actual newline", () => {
      expect(keysAreEqual("Hello\\nWorld", "Hello\nWorld")).toBe(true);
    });

    it("should return true for literal vs actual tab", () => {
      expect(keysAreEqual("Hello\\tWorld", "Hello\tWorld")).toBe(true);
    });

    it("should return true for both literal escapes", () => {
      expect(keysAreEqual("Hello\\nWorld", "Hello\\nWorld")).toBe(true);
    });

    it("should return true for both actual characters", () => {
      expect(keysAreEqual("Hello\nWorld", "Hello\nWorld")).toBe(true);
    });

    it("should return false for different keys", () => {
      expect(keysAreEqual("Hello", "World")).toBe(false);
    });

    it("should return false for keys that differ only in escape type", () => {
      // \n vs \t should not match
      expect(keysAreEqual("Hello\\nWorld", "Hello\\tWorld")).toBe(false);
    });

    it("should handle complex keys from user bug report", () => {
      const extractedKey =
        "Find public locations near you:\\n- Parks\\n- Public Toilets";
      const storedKey =
        "Find public locations near you:\n- Parks\n- Public Toilets";
      expect(keysAreEqual(extractedKey, storedKey)).toBe(true);
    });
  });

  describe("findKey", () => {
    it("should find exact match first", () => {
      const map = new Map([
        ["Hello\\nWorld", "value1"],
        ["Hello\nWorld", "value2"],
      ]);
      // Exact match should be returned
      expect(findKey(map, "Hello\\nWorld")).toBe("value1");
    });

    it("should find normalized match when exact match not found", () => {
      const map = new Map([["Hello\nWorld", "translated"]]);
      // Looking for literal \n should find actual newline
      expect(findKey(map, "Hello\\nWorld")).toBe("translated");
    });

    it("should return undefined when no match found", () => {
      const map = new Map([["Hello", "world"]]);
      expect(findKey(map, "Goodbye")).toBeUndefined();
    });

    it("should handle empty map", () => {
      const map = new Map<string, string>();
      expect(findKey(map, "Hello")).toBeUndefined();
    });

    it("should find key with complex escape sequences", () => {
      const map = new Map([["line1\nline2\ttab", "translated"]]);
      expect(findKey(map, "line1\\nline2\\ttab")).toBe("translated");
    });
  });

  describe("hasKey", () => {
    it("should return true for exact match", () => {
      const map = new Map([["Hello", "world"]]);
      expect(hasKey(map, "Hello")).toBe(true);
    });

    it("should return true for normalized match", () => {
      const map = new Map([["Hello\nWorld", "value"]]);
      expect(hasKey(map, "Hello\\nWorld")).toBe(true);
    });

    it("should return false when no match", () => {
      const map = new Map([["Hello", "world"]]);
      expect(hasKey(map, "Goodbye")).toBe(false);
    });

    it("should handle user-reported scenario", () => {
      // Source file has key with actual newline
      const map = new Map([
        ["Find public locations near you:\n- Parks", "translated"],
      ]);
      // Extracted key has literal \n
      const extractedKey = "Find public locations near you:\\n- Parks";
      expect(hasKey(map, extractedKey)).toBe(true);
    });
  });
});
