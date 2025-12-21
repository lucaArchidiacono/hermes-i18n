import { describe, it, expect, afterEach } from "vitest";
import { StringsHandler } from "../../src/file-handlers/strings.js";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";

describe("StringsHandler", () => {
  const handler = new StringsHandler();
  const fixturesDir = resolve(__dirname, "../fixtures");
  const sampleFile = resolve(fixturesDir, "sample.strings");
  const tempFile = resolve(fixturesDir, "temp.strings");

  afterEach(() => {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  });

  describe("type", () => {
    it("should have type 'strings'", () => {
      expect(handler.type).toBe("strings");
    });
  });

  describe("read", () => {
    it("should parse simple key-value pairs", async () => {
      const entries = await handler.read(sampleFile);

      const helloEntry = entries.find((e) => e.key === "hello_world");
      expect(helloEntry).toBeDefined();
      expect(helloEntry?.value).toBe("Hello World");
    });

    it("should handle comments", async () => {
      const entries = await handler.read(sampleFile);

      const helloEntry = entries.find((e) => e.key === "hello_world");
      expect(helloEntry?.comment).toBe("Welcome message");

      const greetingEntry = entries.find((e) => e.key === "greeting");
      expect(greetingEntry?.comment).toBe("Greeting with placeholder");
    });

    it("should handle multiline comments", async () => {
      const entries = await handler.read(sampleFile);

      const multilineEntry = entries.find((e) => e.key === "multiline_comment");
      expect(multilineEntry?.comment).toContain("Multi-line comment");
    });

    it("should handle escaped characters", async () => {
      const entries = await handler.read(sampleFile);

      const quotesEntry = entries.find((e) => e.key === "escaped_quotes");
      expect(quotesEntry?.value).toBe('He said "Hello"');

      const newlineEntry = entries.find((e) => e.key === "newline_value");
      expect(newlineEntry?.value).toBe("Line 1\nLine 2");
    });

    it("should return empty array for non-existent file", async () => {
      const entries = await handler.read("/non/existent/file.strings");
      expect(entries).toEqual([]);
    });

    it("should handle entries without comments", async () => {
      const entries = await handler.read(sampleFile);

      const simpleEntry = entries.find((e) => e.key === "simple_key");
      expect(simpleEntry).toBeDefined();
      expect(simpleEntry?.value).toBe("Simple value");
      expect(simpleEntry?.comment).toBeUndefined();
    });
  });

  describe("write", () => {
    it("should write entries in correct format", async () => {
      const entries = [
        { key: "test_key", value: "Test Value" },
        { key: "another_key", value: "Another Value" },
      ];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      expect(content).toContain('"test_key" = "Test Value";');
      expect(content).toContain('"another_key" = "Another Value";');
    });

    it("should write entries with comments", async () => {
      const entries = [
        { key: "test_key", value: "Test Value", comment: "A test comment" },
      ];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      expect(content).toContain("/* A test comment */");
      expect(content).toContain('"test_key" = "Test Value";');
    });

    it("should escape special characters", async () => {
      const entries = [
        { key: "quotes", value: 'He said "Hello"' },
        { key: "newline", value: "Line 1\nLine 2" },
      ];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      expect(content).toContain('\\"Hello\\"');
      expect(content).toContain("\\n");
    });

    it("should create parent directories if needed", async () => {
      const uniqueDir = `nested-strings-${Date.now()}`;
      const nestedFile = resolve(fixturesDir, `${uniqueDir}/deep/test.strings`);

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
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.find((e) => e.key === "japanese")?.value).toBe("こんにちは");
      expect(readEntries.find((e) => e.key === "emoji")?.value).toBe("Hello 👋");
    });
  });

  describe("roundtrip", () => {
    it("should preserve data through write and read cycle", async () => {
      const originalEntries = [
        { key: "key1", value: "Value 1", comment: "Comment 1" },
        { key: "key2", value: "Value with \"quotes\"" },
        { key: "key3", value: "Multi\nLine" },
      ];

      await handler.write(tempFile, originalEntries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(originalEntries.length);

      for (const original of originalEntries) {
        const read = readEntries.find((e) => e.key === original.key);
        expect(read?.value).toBe(original.value);
        if (original.comment) {
          expect(read?.comment).toBe(original.comment);
        }
      }
    });
  });
});
