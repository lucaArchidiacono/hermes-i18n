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

    // prettier-ignore
    it("should handle escaped characters (normalized)", async () => {
      const entries = await handler.read(sampleFile);

      // All values are normalized (escaped form)
      const quotesEntry = entries.find((e) => e.key === "He said \\\"Hello\\\"");
      expect(quotesEntry?.value).toBe("He said \\\"Hello\\\"");

      const newlineEntry1 = entries.find((e) => e.key === "Line 1\\nLine 2");
      expect(newlineEntry1?.value).toBe("Line 1\\nLine 2");

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

    // prettier-ignore
    it("should escape special characters", async () => {
      const entries = [
        { key: "He said \\\"Hello\\\"", value: "He said \\\"Hello\\\"" },
        { key: "Line 1\\nLine 2", value: "Line 1\\nLine 2" },
        { key: "newline\\nkey", value: "newline\\nkey" },
      ];

      await handler.write(tempFile, entries);

      const content = readFileSync(tempFile, "utf-8");
      expect(content).toContain('"Line 1\\nLine 2" = "Line 1\\nLine 2";');
      expect(content).toContain('"newline\\nkey" = "newline\\nkey";');
      expect(content).toContain(
        '"He said \\\"Hello\\\"" = "He said \\\"Hello\\\"";'
      );
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
      const originalEntries = [
        { key: "key1", value: "Value 1", comment: "Comment 1" },
        { key: "key2", value: 'Value with \\"quotes\\"' },
        { key: "key3", value: "Multi\\nLine" },
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
    it("should handle keys with newlines (normalized)", async () => {
      const entries = [{ key: "key_with\\n_newline", value: "value" }];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].key).toBe("key_with\\n_newline");
      expect(readEntries[0].value).toBe("value");
    });

    it("should handle values with single newline (normalized)", async () => {
      const entries = [{ key: "single_newline", value: "before\\nafter" }];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("before\\nafter");
    });

    it("should handle values with multiple newlines (actual newlines normalized)", async () => {
      const entries = [
        { key: "multiple_newlines", value: "line1\nline2\nline3\nline4" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      // Actual newlines get normalized to escaped form
      expect(readEntries[0].value).toBe("line1\\nline2\\nline3\\nline4");
    });

    it("should handle values with newlines at the start (normalized)", async () => {
      const entries = [
        { key: "newline_start", value: "\nstarts with newline" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("\\nstarts with newline");
    });

    it("should handle values with newlines at the end (normalized)", async () => {
      const entries = [{ key: "newline_end", value: "ends with newline\n" }];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("ends with newline\\n");
    });

    it("should handle values with consecutive newlines (normalized)", async () => {
      const entries = [
        { key: "consecutive_newlines", value: "paragraph1\n\n\nparagraph2" },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe("paragraph1\\n\\n\\nparagraph2");
    });

    it("should handle mixed special characters with newlines (normalized)", async () => {
      const entries = [
        { key: "mixed_special", value: 'He said "Hello"\nAnd left' },
      ];

      await handler.write(tempFile, entries);
      const readEntries = await handler.read(tempFile);

      expect(readEntries.length).toBe(1);
      expect(readEntries[0].value).toBe('He said \\"Hello\\"\\nAnd left');
    });

    it("should handle newlines with tabs and carriage returns (normalized)", async () => {
      const entries = [
        { key: "all_escapes", value: "tab\there\nline\rreturn" },
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

    it("should parse existing file with escaped newlines correctly (normalized)", async () => {
      // File contains escaped newlines \n - after normalize they stay escaped
      const content = '"test_key" = "Line 1\\nLine 2\\nLine 3";\n';
      const entries = handler.parse(content);

      expect(entries.length).toBe(1);
      expect(entries[0].key).toBe("test_key");
      // normalize returns escaped form
      expect(entries[0].value).toBe("Line 1\\nLine 2\\nLine 3");
    });
  });

  describe("escape sequence order - literal backslash handling", () => {
    // ---- LITERAL BACKSLASH-N TESTS ----
    describe("literal backslash-n", () => {
      it("should correctly parse literal backslash-n from file (not a newline)", async () => {
        // File contains: "key" = "hello\\nworld"; (double backslash + n in file)
        // This represents a literal backslash followed by 'n', NOT a newline
        const content = '"literal_backslash" = "hello\\\\nworld";\n';
        const entries = handler.parse(content);

        expect(entries.length).toBe(1);
        // After normalize: \\n becomes \n (unescape) then \n stays as \n (escape)
        // Wait - let me trace: \\n in file -> \n after regex match, then normalize(\n) = \n
        // Actually the regex captures hello\\nworld, then normalize processes it
        expect(entries[0].value).toBe("hello\\nworld");
        expect(entries[0].value.length).toBe(12);
      });

      it("should correctly roundtrip literal backslash-n", async () => {
        const entries = [{ key: "test", value: "hello\\nworld" }]; // literal backslash + n

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("hello\\nworld");
        expect(readEntries[0].value.length).toBe(12);
      });

      it("should handle mixed actual newlines and literal backslash-n (all normalized)", async () => {
        const entries = [
          { key: "mixed", value: "actual\nnewline and literal\\nbackslash-n" },
        ];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        // Both actual newline and literal \n become \\n in normalized form
        expect(readEntries[0].value).toBe(
          "actual\\nnewline and literal\\nbackslash-n"
        );
      });
    });

    // ---- LITERAL BACKSLASH-R TESTS ----
    describe("literal backslash-r", () => {
      it("should correctly parse literal backslash-r from file", async () => {
        const content = '"test" = "hello\\\\rworld";\n';
        const entries = handler.parse(content);

        expect(entries[0].value).toBe("hello\\rworld");
      });

      it("should correctly roundtrip literal backslash-r", async () => {
        const entries = [{ key: "test", value: "hello\\rworld" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("hello\\rworld");
      });

      it("should handle mixed actual carriage returns and literal backslash-r (all normalized)", async () => {
        const entries = [
          { key: "mixed", value: "actual\rreturn and literal\\rbackslash-r" },
        ];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe(
          "actual\\rreturn and literal\\rbackslash-r"
        );
      });
    });

    // ---- LITERAL BACKSLASH-T TESTS ----
    describe("literal backslash-t", () => {
      it("should correctly parse literal backslash-t from file", async () => {
        const content = '"test" = "hello\\\\tworld";\n';
        const entries = handler.parse(content);

        expect(entries[0].value).toBe("hello\\tworld");
      });

      it("should correctly roundtrip literal backslash-t", async () => {
        const entries = [{ key: "test", value: "hello\\tworld" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("hello\\tworld");
      });

      it("should handle mixed actual tabs and literal backslash-t (all normalized)", async () => {
        const entries = [
          { key: "mixed", value: "actual\ttab and literal\\tbackslash-t" },
        ];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe(
          "actual\\ttab and literal\\tbackslash-t"
        );
      });
    });

    // ---- LITERAL BACKSLASH-QUOTE TESTS ----
    describe("literal backslash-quote", () => {
      it("should correctly parse literal backslash-quote from file", async () => {
        // File contains: "test" = "say \"hi\"";
        // This is just escaped quotes in .strings format
        const content = '"test" = "say \\"hi\\"";\n';
        const entries = handler.parse(content);

        // After normalize: \" becomes " (unescape) then " becomes \" (escape)
        expect(entries[0].value).toBe('say \\"hi\\"');
      });

      it("should correctly roundtrip literal backslash-quote", async () => {
        const entries = [{ key: "test", value: 'say \\"hello\\"' }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe('say \\"hello\\"');
      });
    });

    // ---- ESCAPE ACCUMULATION TESTS ----
    describe("escape accumulation prevention", () => {
      it("should not accumulate escaping on multiple write-read cycles for backslash-n", async () => {
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

      it("should not accumulate escaping on multiple write-read cycles for all escape types", async () => {
        const original = {
          key: "test",
          value: 'literal\\n and \\r and \\t and \\"quote\\"',
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

      it("should not accumulate escaping with actual escape sequences (normalized)", async () => {
        const original = {
          key: "test",
          value: "actual\nnewline and literal\\nbackslash",
        };

        await handler.write(tempFile, [original]);
        let entries = await handler.read(tempFile);

        // After first write, actual newline is normalized to escaped form
        const normalizedValue = "actual\\nnewline and literal\\nbackslash";

        for (let i = 0; i < 5; i++) {
          await handler.write(tempFile, entries);
          entries = await handler.read(tempFile);
          expect(entries[0].value).toBe(normalizedValue);
        }
      });
    });

    // ---- USER-REPORTED BUG CASE ----
    describe("user-reported bug cases", () => {
      it("should parse user-reported multiline string correctly (normalized)", async () => {
        const content = `"find_locations" = "Find public locations near you:\\n- Parks\\n- Public Toilets\\n- Bancomat\\n- And more...";\n`;
        const entries = handler.parse(content);

        expect(entries.length).toBe(1);
        // normalize returns escaped form
        expect(entries[0].value).toBe(
          "Find public locations near you:\\n- Parks\\n- Public Toilets\\n- Bancomat\\n- And more..."
        );
      });

      it("should handle double backslash before n (literal backslash followed by n)", async () => {
        // User's file contains: "key" = "text\\n"; meaning literal \n
        const content = '"test" = "path\\\\nvalue";\n';
        const entries = handler.parse(content);

        // Should be: path\nvalue (literal backslash + n, NOT newline)
        expect(entries[0].value).toBe("path\\nvalue");
        expect(entries[0].value.includes("\n")).toBe(false); // NO actual newline
      });
    });

    // ---- COMPLEX COMBINATIONS ----
    describe("complex escape combinations", () => {
      it("should handle double backslash in path-like string (normalized)", async () => {
        // folder\subfolder - single backslash
        // After normalize: folder\\subfolder
        const entries = [{ key: "path", value: "folder\\subfolder" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        expect(readEntries[0].value).toBe("folder\\\\subfolder");
      });

      it("should handle triple backslash before n (normalized)", async () => {
        // value: hello\\\n (single backslash + actual newline)
        // After normalize: hello\\\\n
        const entries = [{ key: "test", value: "hello\\\n" }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        // \ -> \\\\ and \n -> \\n
        expect(readEntries[0].value).toBe("hello\\\\\\n");
      });

      it("should handle all escape types in one string (normalized)", async () => {
        const complexValue =
          'tab:\there, newline:\nhere, cr:\rhere, quote:"here", ' +
          "literal-tab:\\there, literal-n:\\nhere, literal-r:\\rhere, " +
          "backslash:\\\\here";

        const entries = [{ key: "complex", value: complexValue }];

        await handler.write(tempFile, entries);
        const readEntries = await handler.read(tempFile);

        // All actual chars get normalized to escaped form
        const expectedNormalized =
          'tab:\\there, newline:\\nhere, cr:\\rhere, quote:\\"here\\", ' +
          "literal-tab:\\there, literal-n:\\nhere, literal-r:\\rhere, " +
          "backslash:\\\\here";

        expect(readEntries[0].value).toBe(expectedNormalized);
      });
    });
  });
});
