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
    it("should convert escape sequences to actual characters", () => {
      expect(unescape("Hello\\nWorld")).toBe("Hello\nWorld");
      expect(unescape("Hello\\tWorld")).toBe("Hello\tWorld");
      expect(unescape("Hello\\rWorld")).toBe("Hello\rWorld");
      expect(unescape("path\\\\to\\\\file")).toBe("path\to\\file");
    });

    it("should leave quotes as literal characters", () => {
      expect(unescape('say "hello"')).toBe('say "hello"');
      expect(unescape("say 'hello'")).toBe("say 'hello'");
    });
  });

  describe("escape", () => {
    it("should convert actual characters to escape sequences", () => {
      expect(escape("Hello\nWorld")).toBe("Hello\\nWorld");
      expect(escape("Hello\tWorld")).toBe("Hello\\tWorld");
      expect(escape("Hello\rWorld")).toBe("Hello\\rWorld");
      expect(escape("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("should escape double quotes", () => {
      expect(escape('say "hello"')).toBe('say \\"hello\\"');
      expect(escape("say 'hello'")).toBe("say 'hello'");
    });
  });

  describe("normalize", () => {
    it("should always return escaped form", () => {
      expect(normalize("Hello\\nWorld")).toBe("Hello\\nWorld");
      expect(normalize("Hello\nWorld")).toBe("Hello\\nWorld");
      expect(normalize("Hello\tWorld")).toBe("Hello\\tWorld");
    });

    it("should be idempotent", () => {
      const input = 'line1\\nline2\\ttab"quote"';
      expect(normalize(normalize(input))).toBe(normalize(input));
    });

    it("should handle edge cases", () => {
      expect(normalize("")).toBe("");
      expect(normalize("Hello World")).toBe("Hello World");
    });
  });

  describe("keysAreEqual", () => {
    it("should match identical keys", () => {
      expect(keysAreEqual("Hello", "Hello")).toBe(true);
      expect(keysAreEqual("Hello", "World")).toBe(false);
    });

    it("should match keys with different escape representations", () => {
      expect(keysAreEqual("Hello\\nWorld", "Hello\nWorld")).toBe(true);
      expect(keysAreEqual("Hello\\tWorld", "Hello\tWorld")).toBe(true);
      expect(keysAreEqual("Hello\\nWorld", "Hello\\tWorld")).toBe(false);
    });
  });

  describe("findKey and hasKey", () => {
    it("should find exact and normalized matches", () => {
      const map = new Map([
        ["Hello\\nWorld", "value1"],
        ["Hello\nWorld", "value2"],
      ]);

      expect(findKey(map, "Hello\\nWorld")).toBe("value1");
      expect(hasKey(map, "Hello\\nWorld")).toBe(true);
    });

    it("should find normalized match when exact not found", () => {
      const map = new Map([["Hello\nWorld", "translated"]]);

      expect(findKey(map, "Hello\\nWorld")).toBe("translated");
      expect(hasKey(map, "Hello\\nWorld")).toBe(true);
    });

    it("should return undefined/false when no match", () => {
      const map = new Map([["Hello", "world"]]);

      expect(findKey(map, "Goodbye")).toBeUndefined();
      expect(hasKey(map, "Goodbye")).toBe(false);
    });
  });
});
