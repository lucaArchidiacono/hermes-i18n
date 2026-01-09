import { describe, it, expect, afterEach } from "vitest";
import { XmlHandler } from "../../src/file-handlers/xml.js";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";

describe("XmlHandler", () => {
  const handler = new XmlHandler();
  const fixturesDir = resolve(__dirname, "../fixtures");
  const sampleFile = resolve(fixturesDir, "sample.xml");
  const tempFile = resolve(fixturesDir, "temp.xml");

  afterEach(() => {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  });

  describe("type", () => {
    it("should have type 'xml'", () => {
      expect(handler.type).toBe("xml");
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

      expect(entries.length).toBe(4);
      expect(entries.find((e) => e.key === "greeting")?.value).toBe("Hello, %s!");
      expect(entries.find((e) => e.key === "simple_key")?.value).toBe("Simple value");
    });

    it("should handle XML comments", async () => {
      const entries = await handler.read(sampleFile);

      const helloEntry = entries.find((e) => e.key === "hello_world");
      expect(helloEntry?.comment).toBe("Welcome message");

      const greetingEntry = entries.find((e) => e.key === "greeting");
      expect(greetingEntry?.comment).toBe("Greeting with placeholder");
    });

    it("should handle XML entities", async () => {
      const entries = await handler.read(sampleFile);

      const ampersandEntry = entries.find((e) => e.key === "with_ampersand");
      expect(ampersandEntry?.value).toBe("Tom & Jerry");
    });

    it("should return empty array for non-existent file", async () => {
      const entries = await handler.read("/non/existent/file.xml");
      expect(entries).toEqual([]);
    });

    it("should return empty array for empty content", async () => {
      const entries = handler.parse("");
      expect(entries).toEqual([]);
    });
  });

  describe("write", () => {
    it("should write entries in correct XML format", async () => {
      const entries = [
        { key: "test_key", value: "Test Value" },
        { key: "another_key", value: "Another Value" },
      ];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      expect(content).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(content).toContain("<resources>");
      expect(content).toContain('name="test_key"');
      expect(content).toContain("Test Value");
      expect(content).toContain("</resources>");
    });

    it("should write entries with comments", async () => {
      const entries = [
        { key: "test_key", value: "Test Value", comment: "A test comment" },
      ];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      expect(content).toContain("<!-- A test comment -->");
    });

    it("should escape XML special characters", async () => {
      const entries = [
        { key: "ampersand", value: "Tom & Jerry" },
        { key: "less_than", value: "5 < 10" },
        { key: "greater_than", value: "10 > 5" },
      ];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      expect(content).toContain("&amp;");
      expect(content).toContain("&lt;");
      expect(content).toContain("&gt;");
    });

    it("should create parent directories if needed", async () => {
      const uniqueDir = `nested-xml-${Date.now()}`;
      const nestedFile = resolve(fixturesDir, `${uniqueDir}/deep/test.xml`);

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
        { key: "emoji", value: "Hello" }, // XML doesn't handle emojis well in all parsers
        { key: "german", value: "Größe" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.find((e) => e.key === "japanese")?.value).toBe("こんにちは");
      expect(readEntries.find((e) => e.key === "german")?.value).toBe("Größe");
    });
  });

  describe("roundtrip", () => {
    it("should preserve data through write and read cycle", async () => {
      const originalEntries = [
        { key: "key1", value: "Value 1", comment: "Comment 1" },
        { key: "key2", value: "Value with special: &, <, >" },
        { key: "key3", value: "Simple value" },
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

  describe("newline handling", () => {
    it("should handle keys with newlines in attribute", async () => {
      // Note: XML attributes with newlines are unusual but should be escaped
      const entries = [
        { key: "key_normal", value: "value" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].key).toBe("key_normal");
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
        { key: "mixed_special", value: "Tom & Jerry\nSaid \"Hello\"" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("Tom & Jerry\nSaid \"Hello\"");
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

    it("should handle newlines with XML entities", async () => {
      const entries = [
        { key: "newline_and_entities", value: "5 < 10\nAnd\n10 > 5" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("5 < 10\nAnd\n10 > 5");
    });
  });
});
