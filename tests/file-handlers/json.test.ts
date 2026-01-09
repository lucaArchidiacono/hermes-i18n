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

  describe("escape sequence order - literal backslash handling", () => {
    // Note: JSON uses JSON.parse/JSON.stringify which handles escaping correctly,
    // but we need to verify literal backslashes are preserved properly

    // ---- LITERAL BACKSLASH-N TESTS ----
    describe("literal backslash-n", () => {
      it("should correctly parse literal backslash-n from JSON file", async () => {
        // JSON file contains: {"key": "hello\\nworld"} where \\n is literal backslash + n
        // In JSON, to represent a literal backslash, you need \\\\
        const content = '{\n  "test": "hello\\\\nworld"\n}\n';
        const entries = handler.parse(content);

        expect(entries.length).toBe(1);
        expect(entries[0].value).toBe("hello\\nworld"); // literal backslash + n
        expect(entries[0].value.length).toBe(12);
      });

      it("should correctly roundtrip literal backslash-n", async () => {
        const entries = [{ key: "test", value: "hello\\nworld" }]; // literal backslash + n

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("hello\\nworld");
        expect(readEntries[0].value.length).toBe(12);
      });

      it("should handle mixed actual newlines and literal backslash-n", async () => {
        const entries = [
          { key: "mixed", value: "actual\nnewline and literal\\nbackslash-n" },
        ];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("actual\nnewline and literal\\nbackslash-n");
      });
    });

    // ---- LITERAL BACKSLASH-R TESTS ----
    describe("literal backslash-r", () => {
      it("should correctly roundtrip literal backslash-r", async () => {
        const entries = [{ key: "test", value: "hello\\rworld" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("hello\\rworld");
      });

      it("should handle mixed actual carriage returns and literal backslash-r", async () => {
        const entries = [
          { key: "mixed", value: "actual\rreturn and literal\\rbackslash-r" },
        ];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("actual\rreturn and literal\\rbackslash-r");
      });
    });

    // ---- LITERAL BACKSLASH-T TESTS ----
    describe("literal backslash-t", () => {
      it("should correctly roundtrip literal backslash-t", async () => {
        const entries = [{ key: "test", value: "hello\\tworld" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("hello\\tworld");
      });

      it("should handle mixed actual tabs and literal backslash-t", async () => {
        const entries = [
          { key: "mixed", value: "actual\ttab and literal\\tbackslash-t" },
        ];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("actual\ttab and literal\\tbackslash-t");
      });
    });

    // ---- LITERAL BACKSLASH-QUOTE TESTS ----
    describe("literal backslash-quote", () => {
      it("should correctly roundtrip literal backslash-quote", async () => {
        const entries = [{ key: "test", value: 'say \\"hello\\"' }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe('say \\"hello\\"');
      });
    });

    // ---- ESCAPE ACCUMULATION TESTS ----
    describe("escape accumulation prevention", () => {
      it("should not accumulate escaping on multiple write-read cycles", async () => {
        const original = { key: "test", value: "line1\\nline2" };

        await handler.write(tempFile, [original]);
        let entries = await handler.read(tempFile);
        expect(entries[0].value).toBe("line1\\nline2");

        for (let i = 0; i < 5; i++) {
          await handler.write(tempFile, entries);
          entries = await handler.read(tempFile);
          expect(entries[0].value).toBe("line1\\nline2");
        }
      });

      it("should not accumulate escaping with all escape types", async () => {
        const original = {
          key: "test",
          value: 'literal\\n and \\r and \\t and \\"quote\\"',
        };

        await handler.write(tempFile, [original]);
        let entries = await handler.read(tempFile);

        for (let i = 0; i < 5; i++) {
          await handler.write(tempFile, entries);
          entries = await handler.read(tempFile);
          expect(entries[0].value).toBe(original.value);
        }
      });

      it("should not accumulate escaping with actual escape sequences", async () => {
        const original = {
          key: "test",
          value: "actual\nnewline and literal\\nbackslash",
        };

        await handler.write(tempFile, [original]);
        let entries = await handler.read(tempFile);

        for (let i = 0; i < 5; i++) {
          await handler.write(tempFile, entries);
          entries = await handler.read(tempFile);
          expect(entries[0].value).toBe(original.value);
        }
      });
    });

    // ---- COMPLEX COMBINATIONS ----
    describe("complex escape combinations", () => {
      it("should handle double backslash (literal backslash)", async () => {
        const entries = [{ key: "path", value: "C:\\\\Users\\\\name" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("C:\\\\Users\\\\name");
      });

      it("should handle all escape types in one string", async () => {
        const complexValue =
          'tab:\there, newline:\nhere, cr:\rhere, quote:"here", ' +
          'literal-tab:\\there, literal-n:\\nhere, literal-r:\\rhere, ' +
          "backslash:\\\\here";

        const entries = [{ key: "complex", value: complexValue }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe(complexValue);
      });
    });
  });
});
