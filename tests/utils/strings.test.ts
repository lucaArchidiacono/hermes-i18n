import { describe, it, expect } from "vitest";
import {
  normalizeKey,
  keysAreEqual,
  findKeyNormalized,
  hasKeyNormalized,
} from "../../src/utils/strings.js";

describe("String utilities", () => {
  describe("normalizeKey", () => {
    describe("basic escape sequences", () => {
      it("should convert literal backslash-n to actual newline", () => {
        const result = normalizeKey("Hello\\nWorld");
        expect(result).toBe("Hello\nWorld");
        expect(result.length).toBe(11); // actual newline is 1 char
      });

      it("should convert literal backslash-r to actual carriage return", () => {
        const result = normalizeKey("Hello\\rWorld");
        expect(result).toBe("Hello\rWorld");
      });

      it("should convert literal backslash-t to actual tab", () => {
        const result = normalizeKey("Hello\\tWorld");
        expect(result).toBe("Hello\tWorld");
      });

      it("should convert literal backslash-quote to actual double quote", () => {
        const result = normalizeKey('say \\"hello\\"');
        expect(result).toBe('say "hello"');
      });

      it("should convert literal backslash-single-quote to actual single quote", () => {
        const result = normalizeKey("say \\'hello\\'");
        expect(result).toBe("say 'hello'");
      });

      it("should convert double backslash to single backslash", () => {
        const result = normalizeKey("path\\\\to\\\\file");
        expect(result).toBe("path\\to\\file");
      });
    });

    describe("already normalized keys", () => {
      it("should leave already normalized newline unchanged", () => {
        const result = normalizeKey("Hello\nWorld");
        expect(result).toBe("Hello\nWorld");
      });

      it("should leave already normalized tab unchanged", () => {
        const result = normalizeKey("Hello\tWorld");
        expect(result).toBe("Hello\tWorld");
      });

      it("should leave already normalized carriage return unchanged", () => {
        const result = normalizeKey("Hello\rWorld");
        expect(result).toBe("Hello\rWorld");
      });

      it("should leave simple string unchanged", () => {
        const result = normalizeKey("Hello World");
        expect(result).toBe("Hello World");
      });
    });

    describe("complex cases", () => {
      it("should handle multiple escape sequences", () => {
        const result = normalizeKey("line1\\nline2\\ttab\\rreturn");
        expect(result).toBe("line1\nline2\ttab\rreturn");
      });

      it("should handle mixed actual and literal escapes", () => {
        // This string has an actual newline and a literal \n
        const input = "actual\nnewline and literal\\nbackslash-n";
        const result = normalizeKey(input);
        // Both should become actual newlines
        expect(result).toBe("actual\nnewline and literal\nbackslash-n");
      });

      it("should handle user-reported multiline string", () => {
        const result = normalizeKey(
          "Find public locations near you:\\n- Parks\\n- Public Toilets\\n- Bancomat\\n- And more..."
        );
        expect(result).toBe(
          "Find public locations near you:\n- Parks\n- Public Toilets\n- Bancomat\n- And more..."
        );
      });

      it("should handle empty string", () => {
        expect(normalizeKey("")).toBe("");
      });

      it("should handle string with only escape sequences", () => {
        expect(normalizeKey("\\n\\t\\r")).toBe("\n\t\r");
      });
    });

    describe("idempotence", () => {
      it("should be idempotent - normalizing twice gives same result", () => {
        const input = "Hello\\nWorld";
        const once = normalizeKey(input);
        const twice = normalizeKey(once);
        expect(twice).toBe(once);
      });

      it("should be idempotent for complex strings", () => {
        const input = 'line1\\nline2\\ttab\\"quote\\"';
        const once = normalizeKey(input);
        const twice = normalizeKey(once);
        expect(twice).toBe(once);
      });
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

  describe("findKeyNormalized", () => {
    it("should find exact match first", () => {
      const map = new Map([
        ["Hello\\nWorld", "value1"],
        ["Hello\nWorld", "value2"],
      ]);
      // Exact match should be returned
      expect(findKeyNormalized(map, "Hello\\nWorld")).toBe("value1");
    });

    it("should find normalized match when exact match not found", () => {
      const map = new Map([["Hello\nWorld", "translated"]]);
      // Looking for literal \n should find actual newline
      expect(findKeyNormalized(map, "Hello\\nWorld")).toBe("translated");
    });

    it("should return undefined when no match found", () => {
      const map = new Map([["Hello", "world"]]);
      expect(findKeyNormalized(map, "Goodbye")).toBeUndefined();
    });

    it("should handle empty map", () => {
      const map = new Map<string, string>();
      expect(findKeyNormalized(map, "Hello")).toBeUndefined();
    });

    it("should find key with complex escape sequences", () => {
      const map = new Map([
        ["line1\nline2\ttab", "translated"],
      ]);
      expect(findKeyNormalized(map, "line1\\nline2\\ttab")).toBe("translated");
    });
  });

  describe("hasKeyNormalized", () => {
    it("should return true for exact match", () => {
      const map = new Map([["Hello", "world"]]);
      expect(hasKeyNormalized(map, "Hello")).toBe(true);
    });

    it("should return true for normalized match", () => {
      const map = new Map([["Hello\nWorld", "value"]]);
      expect(hasKeyNormalized(map, "Hello\\nWorld")).toBe(true);
    });

    it("should return false when no match", () => {
      const map = new Map([["Hello", "world"]]);
      expect(hasKeyNormalized(map, "Goodbye")).toBe(false);
    });

    it("should handle user-reported scenario", () => {
      // Source file has key with actual newline
      const map = new Map([
        ["Find public locations near you:\n- Parks", "translated"],
      ]);
      // Extracted key has literal \n
      const extractedKey = "Find public locations near you:\\n- Parks";
      expect(hasKeyNormalized(map, extractedKey)).toBe(true);
    });
  });
});
