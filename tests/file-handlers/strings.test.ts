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

      const helloEntry = entries.find((e) => e.key === "Hello World");
      expect(helloEntry).toBeDefined();
      expect(helloEntry?.value).toBe("Hello World");
    });

    it("should handle special characters", async () => {
      const entries = await handler.read(sampleFile);

      const quotesEntry = entries.find((e) => e.key === "Hello, %@!");
      expect(quotesEntry?.value).toBe("Hello, %@!");
    });

    it("should preserve escape sequences as literal characters", async () => {
      const entries = await handler.read(sampleFile);

      // File contains: "Line 1\nLine 2" - preserved as literal \n, not actual newline
      const newlineEntry1 = entries.find((e) => e.key === "Line 1\\nLine 2");
      expect(newlineEntry1?.value).toBe("Line 1\\nLine 2");

      // File contains: "newline\nkey" - preserved as literal \n
      const newlineEntry2 = entries.find((e) => e.key === "newline\\nkey");
      expect(newlineEntry2?.value).toBe("newline\\nkey");
    });

    it("should return empty array for non-existent file", async () => {
      const entries = await handler.read("/non/existent/file.strings");
      expect(entries).toEqual([]);
    });
  });

  describe("write", () => {
    it("should write entries in correct format", async () => {
      const entries = [
        { key: "Test Value", value: "Test Value" },
        { key: "Another Value", value: "Another Value" },
      ];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      expect(content).toContain('"Test Value" = "Test Value";');
      expect(content).toContain('"Another Value" = "Another Value";');
    });

    it("should preserve literal escape sequences in output file", async () => {
      // Input has literal escape sequences (\ followed by n, not actual newline)
      const entries = [
        { key: "Line 1\\nLine 2", value: "Line 1\\nLine 2" },
        { key: "newline\\nkey", value: "newline\\nkey" },
      ];

      await handler.write(tempFile, entries);

      // File should contain the same literal sequences
      const content = readFileSync(tempFile, "utf-8");
      expect(content).toContain('"Line 1\\nLine 2" = "Line 1\\nLine 2";');
      expect(content).toContain('"newline\\nkey" = "newline\\nkey";');
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

      expect(readEntries.find((e) => e.key === "japanese")?.value).toBe(
        "こんにちは"
      );
      expect(readEntries.find((e) => e.key === "emoji")?.value).toBe(
        "Hello 👋"
      );
    });
  });

  describe("roundtrip", () => {
    it("should preserve data through write and read cycle", async () => {
      // Input uses literal escape sequences
      const originalEntries = [
        { key: "key1", value: "Value 1", comment: "Comment 1" },
        { key: "key2", value: "Multi\\nLine" },
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

  describe("newline handling (literal \\n sequences)", () => {
    it("should handle keys with literal \\n", async () => {
      const entries = [{ key: "key_with\\n_newline", value: "value" }];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].key).toBe("key_with\\n_newline");
      expect(readEntries[0].value).toBe("value");
    });

    it("should handle values with single literal \\n", async () => {
      const entries = [{ key: "single_newline", value: "before\\nafter" }];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("before\\nafter");
    });

    it("should handle values with multiple literal \\n", async () => {
      const entries = [
        { key: "multiple_newlines", value: "line1\\nline2\\nline3\\nline4" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("line1\\nline2\\nline3\\nline4");
    });

    it("should handle values with literal \\n at the start", async () => {
      const entries = [
        { key: "newline_start", value: "\\nstarts with newline" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("\\nstarts with newline");
    });

    it("should handle values with literal \\n at the end", async () => {
      const entries = [{ key: "newline_end", value: "ends with newline\\n" }];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("ends with newline\\n");
    });

    it("should handle values with consecutive literal \\n", async () => {
      const entries = [
        { key: "consecutive_newlines", value: "paragraph1\\n\\n\\nparagraph2" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("paragraph1\\n\\n\\nparagraph2");
    });

    it("should handle mixed literal escape sequences", async () => {
      const entries = [
        { key: "mixed_special", value: "Hello\\nAnd left\\ttab" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("Hello\\nAnd left\\ttab");
    });

    it("should handle literal \\n, \\t, and \\r sequences", async () => {
      const entries = [
        { key: "all_escapes", value: "tab\\there\\nline\\rreturn" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("tab\\there\\nline\\rreturn");
    });

    it("should handle empty string value", async () => {
      const entries = [{ key: "empty_value", value: "" }];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].key).toBe("empty_value");
      expect(readEntries[0].value).toBe("");
    });

    it("should parse file and preserve literal \\n sequences", async () => {
      // File contains literal \n sequences
      const content = '"test_key" = "Line 1\\nLine 2\\nLine 3";\n';
      const entries = handler.parse(content);

      expect(entries.length).toBe(1);
      expect(entries[0].key).toBe("test_key");
      // Should preserve as literal \n (two chars: \ and n)
      expect(entries[0].value).toBe("Line 1\\nLine 2\\nLine 3");
    });
  });

  describe("escape sequence handling", () => {
    describe("quotes", () => {
      it("should allow quotes in values (quotes are literal chars)", async () => {
        // Quotes are no longer escaped - they pass through as-is
        const entries = [{ key: "test", value: "simple value" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("simple value");
      });
    });

    describe("tabs", () => {
      it("should preserve literal \\t", async () => {
        const content = '"test" = "hello\\tworld";\n';
        const entries = handler.parse(content);

        expect(entries[0].value).toBe("hello\\tworld");
      });

      it("should roundtrip literal \\t", async () => {
        const entries = [{ key: "test", value: "hello\\tworld" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("hello\\tworld");
      });
    });

    describe("carriage returns", () => {
      it("should preserve literal \\r", async () => {
        const content = '"test" = "hello\\rworld";\n';
        const entries = handler.parse(content);

        expect(entries[0].value).toBe("hello\\rworld");
      });

      it("should roundtrip literal \\r", async () => {
        const entries = [{ key: "test", value: "hello\\rworld" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("hello\\rworld");
      });
    });

    describe("backslashes", () => {
      it("should preserve literal double backslash", async () => {
        // File contains \\\\ which is two backslashes in the file
        const content = '"test" = "folder\\\\subfolder";\n';
        const entries = handler.parse(content);

        expect(entries[0].value).toBe("folder\\\\subfolder");
      });

      it("should roundtrip literal double backslash", async () => {
        const entries = [{ key: "path", value: "folder\\\\subfolder" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("folder\\\\subfolder");
      });

      it("should preserve literal backslash followed by n", async () => {
        // File: \\n in JS string = \n in file = backslash + n
        // After normalize: \n (backslash + n) stays as \n
        const content = '"test" = "path\\\\nvalue";\n';
        const entries = handler.parse(content);

        // The value should be path + literal \n (backslash-n) + value
        expect(entries[0].value).toBe("path\\nvalue");
      });
    });
  });

  describe("escape accumulation prevention", () => {
    it("should not accumulate escaping on multiple write-read cycles", async () => {
      const original = { key: "test", value: "line1\\nline2" };

      // First cycle
      await handler.write(tempFile, [original]);
      let entries = await handler.read(tempFile);
      expect(entries[0].value).toBe("line1\\nline2");

      // Second cycle - should remain the same
      await handler.write(tempFile, entries);
      entries = await handler.read(tempFile);
      expect(entries[0].value).toBe("line1\\nline2");

      // Third cycle - should still remain the same
      await handler.write(tempFile, entries);
      entries = await handler.read(tempFile);
      expect(entries[0].value).toBe("line1\\nline2");
    });

    it("should not accumulate escaping for all escape sequence types", async () => {
      const original = {
        key: "test",
        value: "literal\\n and \\r and \\t",
      };

      // First cycle
      await handler.write(tempFile, [original]);
      let entries = await handler.read(tempFile);
      expect(entries[0].value).toBe(original.value);

      // Five more cycles - value must remain identical
      for (let i = 0; i < 5; i++) {
        await handler.write(tempFile, entries);
        entries = await handler.read(tempFile);
        expect(entries[0].value).toBe(original.value);
      }
    });
  });

  describe("user-reported bug cases", () => {
    it("should parse multiline string and preserve literal \\n", async () => {
      const content = `"find_locations" = "Find public locations near you:\\n- Parks\\n- Public Toilets\\n- Bancomat\\n- And more...";\n`;
      const entries = handler.parse(content);

      expect(entries.length).toBe(1);
      // Should preserve literal \n sequences
      expect(entries[0].value).toBe(
        "Find public locations near you:\\n- Parks\\n- Public Toilets\\n- Bancomat\\n- And more..."
      );
    });
  });

  describe("complex combinations", () => {
    it("should handle all escape types in one string", async () => {
      const complexValue =
        "tab:\\there, newline:\\nhere, cr:\\rhere, backslash:\\\\here";

      const entries = [{ key: "complex", value: complexValue }];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries[0].value).toBe(complexValue);
    });
  });
});
