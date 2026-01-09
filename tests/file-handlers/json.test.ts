import { describe, it, expect, afterEach } from "vitest";
import { JsonHandler } from "../../src/file-handlers/json.js";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { resolve, dirname } from "path";

describe("JsonHandler", () => {
  const handler = new JsonHandler();
  const fixturesDir = resolve(__dirname, "../fixtures");
  const sampleFile = resolve(fixturesDir, "sample.json");
  const tempFile = resolve(fixturesDir, "temp.json");

  afterEach(() => {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  });

  describe("type", () => {
    it("should have type 'json'", () => {
      expect(handler.type).toBe("json");
    });
  });

  describe("read", () => {
    it("should parse simple key-value pairs", async () => {
      const entries = await handler.read(sampleFile);

      const helloEntry = entries.find((e) => e.key === "hello_world");
      expect(helloEntry).toBeDefined();
      expect(helloEntry?.value).toBe("Hello World");
    });

    it("should parse all entries from file", async () => {
      const entries = await handler.read(sampleFile);

      expect(entries.length).toBeGreaterThanOrEqual(5);
      expect(entries.find((e) => e.key === "greeting")?.value).toBe("Hello, {name}!");
      expect(entries.find((e) => e.key === "simple_key")?.value).toBe("Simple value");
    });

    it("should handle strings with quotes", async () => {
      const entries = await handler.read(sampleFile);

      const quotesEntry = entries.find((e) => e.key === "with_quotes");
      expect(quotesEntry?.value).toBe('He said "Hello"');
    });

    it("should handle strings with newlines", async () => {
      const entries = await handler.read(sampleFile);

      const multilineEntry = entries.find((e) => e.key === "multiline");
      expect(multilineEntry?.value).toBe("Line 1\nLine 2");
    });

    it("should return empty array for non-existent file", async () => {
      const entries = await handler.read("/non/existent/file.json");
      expect(entries).toEqual([]);
    });

    it("should return empty array for empty object", async () => {
      const content = "{}";
      const entries = handler.parse(content);
      expect(entries).toEqual([]);
    });

    it("should throw error for invalid JSON", async () => {
      expect(() => handler.parse("{ invalid json }")).toThrow("Failed to parse JSON");
    });
  });

  describe("write", () => {
    it("should write entries as JSON object", async () => {
      const entries = [
        { key: "test_key", value: "Test Value" },
        { key: "another_key", value: "Another Value" },
      ];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.test_key).toBe("Test Value");
      expect(parsed.another_key).toBe("Another Value");
    });

    it("should write properly formatted JSON", async () => {
      const entries = [{ key: "test", value: "value" }];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      expect(content).toContain("{\n");
      expect(content).toContain('  "test"');
      expect(content.endsWith("\n")).toBe(true);
    });

    it("should handle special characters", async () => {
      const entries = [
        { key: "quotes", value: 'He said "Hello"' },
        { key: "newline", value: "Line 1\nLine 2" },
        { key: "backslash", value: "path\\to\\file" },
      ];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.quotes).toBe('He said "Hello"');
      expect(parsed.newline).toBe("Line 1\nLine 2");
      expect(parsed.backslash).toBe("path\\to\\file");
    });

    it("should create parent directories if needed", async () => {
      const uniqueDir = `nested-json-${Date.now()}`;
      const nestedFile = resolve(fixturesDir, `${uniqueDir}/deep/test.json`);

      try {
        await handler.write(nestedFile, [{ key: "test", value: "value" }]);
        expect(existsSync(nestedFile)).toBe(true);
      } finally {
        const fs = await import("fs");
        if (existsSync(resolve(fixturesDir, uniqueDir))) {
          fs.rmSync(resolve(fixturesDir, uniqueDir), { recursive: true });
        }
      }
    });

    it("should handle unicode characters", async () => {
      const entries = [
        { key: "japanese", value: "こんにちは" },
        { key: "emoji", value: "Hello 👋" },
        { key: "arabic", value: "مرحبا" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.find((e) => e.key === "japanese")?.value).toBe("こんにちは");
      expect(readEntries.find((e) => e.key === "emoji")?.value).toBe("Hello 👋");
      expect(readEntries.find((e) => e.key === "arabic")?.value).toBe("مرحبا");
    });
  });

  describe("roundtrip", () => {
    it("should preserve data through write and read cycle", async () => {
      const originalEntries = [
        { key: "key1", value: "Value 1" },
        { key: "key2", value: 'Value with "quotes"' },
        { key: "key3", value: "Multi\nLine" },
        { key: "key4", value: "Placeholder: {name}" },
      ];

      await handler.write(tempFile, originalEntries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(originalEntries.length);

      for (const original of originalEntries) {
        const read = readEntries.find((e) => e.key === original.key);
        expect(read?.value).toBe(original.value);
      }
    });
  });

  describe("newline handling", () => {
    it("should handle keys with newlines", async () => {
      const entries = [
        { key: "key_with\n_newline", value: "value" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].key).toBe("key_with\n_newline");
      expect(readEntries[0].value).toBe("value");
    });

    it("should handle values with single newline", async () => {
      const entries = [
        { key: "single_newline", value: "before\nafter" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("before\nafter");
    });

    it("should handle values with multiple newlines", async () => {
      const entries = [
        { key: "multiple_newlines", value: "line1\nline2\nline3\nline4" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("line1\nline2\nline3\nline4");
    });

    it("should handle values with newlines at the start", async () => {
      const entries = [
        { key: "newline_start", value: "\nstarts with newline" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("\nstarts with newline");
    });

    it("should handle values with newlines at the end", async () => {
      const entries = [
        { key: "newline_end", value: "ends with newline\n" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("ends with newline\n");
    });

    it("should handle values with consecutive newlines", async () => {
      const entries = [
        { key: "consecutive_newlines", value: "paragraph1\n\n\nparagraph2" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("paragraph1\n\n\nparagraph2");
    });

    it("should handle mixed special characters with newlines", async () => {
      const entries = [
        { key: "mixed_special", value: "He said \"Hello\"\nAnd left" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("He said \"Hello\"\nAnd left");
    });

    it("should handle newlines with tabs and backslashes", async () => {
      const entries = [
        { key: "all_escapes", value: "tab\there\npath\\to\\file" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("tab\there\npath\\to\\file");
    });

    it("should handle empty string value", async () => {
      const entries = [
        { key: "empty_value", value: "" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].key).toBe("empty_value");
      expect(readEntries[0].value).toBe("");
    });

    it("should parse existing JSON with newlines correctly", async () => {
      // JSON automatically handles newlines
      const content = '{\n  "test_key": "Line 1\\nLine 2\\nLine 3"\n}\n';
      const entries = handler.parse(content);

      expect(entries.length).toBe(1);
      expect(entries[0].key).toBe("test_key");
      expect(entries[0].value).toBe("Line 1\nLine 2\nLine 3");
    });
  });
});
