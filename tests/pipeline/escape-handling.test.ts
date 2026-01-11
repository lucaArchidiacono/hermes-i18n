import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { resolve, join } from "path";
import { StringsHandler } from "../../src/file-handlers/strings.js";
import { JsonHandler } from "../../src/file-handlers/json.js";
import { ExtractorStep } from "../../src/pipeline/steps/extractor.js";
import { SourceSyncStep } from "../../src/pipeline/steps/source-sync.js";
import { MissingFinderStep } from "../../src/pipeline/steps/missing-finder.js";
import { createPipelineContext } from "../../src/pipeline/types.js";
import type { ResolvedHermesConfig } from "../../src/config/types.js";

describe("Pipeline escape handling integration", () => {
  const testDir = resolve(__dirname, "../fixtures/escape-integration-test");
  const sourceFile = join(testDir, "Localizable.strings");
  const targetFile = join(testDir, "de.lproj/Localizable.strings");
  const codeFile = join(testDir, "Source.swift");

  beforeEach(() => {
    // Create test directory structure
    mkdirSync(join(testDir, "de.lproj"), { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    rmSync(testDir, { recursive: true, force: true });
  });

  function createConfig(extractPattern: string): ResolvedHermesConfig {
    return {
      sourceLanguage: "en",
      targetLanguages: ["de"],
      source: {
        path: "Localizable.strings",
        type: "strings",
      },
      outputs: [
        {
          type: "strings",
          path: "{lang}.lproj/Localizable.strings",
        },
      ],
      include: ["**/*.swift"],
      exclude: ["node_modules/**"],
      extractPattern: new RegExp(extractPattern, "g"),
      deepl: {
        apiKey: "",
        formality: "default",
      },
      ai: {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "",
        systemPrompt: "",
      },
    };
  }

  describe("extractor processes escape sequences", () => {
    it("should process escape sequences in extracted keys", async () => {
      // Source code: tr("Hello\nWorld")
      // The file literally contains the characters: t, r, (, ", H, e, l, l, o, \, n, W, o, r, l, d, ", )
      // The extractor should process \n and return normalized (escaped) form
      writeFileSync(codeFile, `let text = tr("Hello\\nWorld")`);

      const config = createConfig('tr\\(["\'](.+?)["\']\\)');
      const context = createPipelineContext(config, testDir, true);

      const extractor = new ExtractorStep();
      await extractor.execute(context);

      expect(context.extractedKeys.length).toBe(1);
      // The extractor returns normalized (escaped) form
      expect(context.extractedKeys[0]).toBe("Hello\\nWorld");
    });

    it("should process multiline key pattern correctly", async () => {
      // User's code: tr("Find public locations near you:\n- Parks\n...")
      const codeContent = `tr("Find public locations near you:\\n- Parks\\n- Public Toilets\\n- Bancomat\\n- And more...")`;
      writeFileSync(codeFile, codeContent);

      const config = createConfig("tr\\([\"'`](.+?)[\"'`]\\)");
      const context = createPipelineContext(config, testDir, true);

      const extractor = new ExtractorStep();
      await extractor.execute(context);

      expect(context.extractedKeys.length).toBe(1);
      // Extracted key is in normalized (escaped) form
      expect(context.extractedKeys[0]).toBe(
        "Find public locations near you:\\n- Parks\\n- Public Toilets\\n- Bancomat\\n- And more..."
      );
    });

    it("should process multiple keys with various escape sequences", async () => {
      writeFileSync(
        codeFile,
        `
let a = tr("line1\\nline2")
let b = tr("tab\\there")
let c = tr("quote\\"here\\"")
let d = tr("simple")
`
      );

      const config = createConfig('tr\\(["\'](.+?)["\']\\)');
      const context = createPipelineContext(config, testDir, true);

      const extractor = new ExtractorStep();
      await extractor.execute(context);

      expect(context.extractedKeys.length).toBe(4);
      // All escape sequences are in normalized (escaped) form
      expect(context.extractedKeys).toContain("line1\\nline2");
      expect(context.extractedKeys).toContain("tab\\there");
      expect(context.extractedKeys).toContain('quote\\"here\\"');
      expect(context.extractedKeys).toContain("simple");
    });
  });

  describe("key matching between extractor and source file", () => {
    it("should correctly match extracted key with source file entry", async () => {
      // Scenario:
      // - Source code has: tr("Hello\nWorld") -> extractor returns normalized form
      // - Source .strings file has: "Hello\nWorld" = "Hello\nWorld";
      //   which when parsed also becomes normalized form
      // - Keys should match!

      // Source code with literal \n
      writeFileSync(codeFile, `let text = tr("Hello\\nWorld")`);

      // Source .strings file with escaped newline
      writeFileSync(sourceFile, `"Hello\\nWorld" = "Hello\\nWorld";\n`);

      const config = createConfig('tr\\(["\'](.+?)["\']\\)');
      const context = createPipelineContext(config, testDir, false);

      const extractor = new ExtractorStep();
      await extractor.execute(context);

      // Extractor returns normalized (escaped) form
      expect(context.extractedKeys[0]).toBe("Hello\\nWorld");

      const sourceSync = new SourceSyncStep();
      await sourceSync.execute(context);

      // Both extractor and file handler produce normalized keys
      // so they should match and no new keys should be added
      expect(context.newSourceKeys.length).toBe(0);
    });

    it("should not create duplicate entries on multiple syncs", async () => {
      // This is the critical bug test - simulates multiple hermes sync runs

      writeFileSync(codeFile, `let text = tr("Hello\\nWorld")`);
      writeFileSync(sourceFile, ""); // Start empty

      const config = createConfig('tr\\(["\'](.+?)["\']\\)');
      const stringsHandler = new StringsHandler();

      // First sync
      {
        const context = createPipelineContext(config, testDir, false);
        await new ExtractorStep().execute(context);
        await new SourceSyncStep().execute(context);

        const entries = await stringsHandler.read(sourceFile);
        expect(entries.length).toBe(1);
      }

      // Second sync - should NOT create duplicate
      {
        const context = createPipelineContext(config, testDir, false);
        await new ExtractorStep().execute(context);
        await new SourceSyncStep().execute(context);

        const entries = await stringsHandler.read(sourceFile);
        // BUG: This would be 2 if escape handling is broken
        expect(entries.length).toBe(1);
      }

      // Third sync - still should be 1 entry
      {
        const context = createPipelineContext(config, testDir, false);
        await new ExtractorStep().execute(context);
        await new SourceSyncStep().execute(context);

        const entries = await stringsHandler.read(sourceFile);
        expect(entries.length).toBe(1);
      }
    });

    it("should handle user-reported bug: progressive escape accumulation", async () => {
      // User reported: every sync adds more backslashes
      // Run 1: key has \\n
      // Run 2: key has \\\n
      // Run 3: key has \\\\n

      const multilineText = "Find public locations near you:\\n- Parks";
      writeFileSync(codeFile, `tr("${multilineText}")`);
      writeFileSync(sourceFile, "");

      const config = createConfig('tr\\(["\'](.+?)["\']\\)');
      const stringsHandler = new StringsHandler();

      // Run multiple syncs
      for (let run = 1; run <= 5; run++) {
        const context = createPipelineContext(config, testDir, false);
        await new ExtractorStep().execute(context);
        await new SourceSyncStep().execute(context);

        const entries = await stringsHandler.read(sourceFile);

        // Should always be 1 entry, not accumulating
        expect(entries.length).toBe(1);

        // Read raw file content to check for escape accumulation
        const rawContent = readFileSync(sourceFile, "utf-8");

        // Count backslashes before 'n' in the raw file
        // Should be consistent across runs (2 backslashes = \\n in file)
        const backslashNMatches = rawContent.match(/\\+n/g);
        if (backslashNMatches) {
          for (const match of backslashNMatches) {
            // Each \\n in file should have exactly 2 backslashes
            // (or 1 if it's an actual newline escape)
            expect(match.length).toBeLessThanOrEqual(3); // \n or \\n
          }
        }
      }
    });
  });

  describe("missing finder with escape sequences", () => {
    it("should correctly identify missing translations with newlines in key", async () => {
      writeFileSync(codeFile, `tr("Line1\\nLine2")`);
      writeFileSync(sourceFile, `"Line1\\nLine2" = "Line1\\nLine2";\n`);
      writeFileSync(targetFile, ""); // Empty target

      const config = createConfig('tr\\(["\'](.+?)["\']\\)');
      const context = createPipelineContext(config, testDir, false);

      await new ExtractorStep().execute(context);
      await new SourceSyncStep().execute(context);
      await new MissingFinderStep().execute(context);

      const deTranslations = context.translations.get("de");
      expect(deTranslations).toBeDefined();
      expect(deTranslations!.missing.size).toBe(1);
    });

    it("should not mark existing translation as missing due to escape mismatch", async () => {
      writeFileSync(codeFile, `tr("Hello\\nWorld")`);
      writeFileSync(sourceFile, `"Hello\\nWorld" = "Hello\\nWorld";\n`);
      writeFileSync(targetFile, `"Hello\\nWorld" = "Hallo\\nWelt";\n`);

      const config = createConfig('tr\\(["\'](.+?)["\']\\)');
      const context = createPipelineContext(config, testDir, false);

      await new ExtractorStep().execute(context);
      await new SourceSyncStep().execute(context);
      await new MissingFinderStep().execute(context);

      const deTranslations = context.translations.get("de");
      expect(deTranslations).toBeDefined();
      // Should be 0 missing - translation exists
      expect(deTranslations!.missing.size).toBe(0);
    });

    it("should handle keys with multiple escape sequences", async () => {
      writeFileSync(codeFile, `tr("Tab:\\there\\nNewline:\\nhere")`);
      writeFileSync(sourceFile, "");
      writeFileSync(targetFile, "");

      const config = createConfig('tr\\(["\'](.+?)["\']\\)');
      const context = createPipelineContext(config, testDir, false);

      await new ExtractorStep().execute(context);
      await new SourceSyncStep().execute(context);
      await new MissingFinderStep().execute(context);

      // Verify the key was extracted in normalized (escaped) form
      expect(context.extractedKeys.length).toBe(1);
      expect(context.extractedKeys[0]).toBe("Tab:\\there\\nNewline:\\nhere");

      // Verify it was added to source
      expect(context.newSourceKeys.length).toBe(1);

      // Verify it's marked as missing for translation
      const deTranslations = context.translations.get("de");
      expect(deTranslations!.missing.size).toBe(1);
    });
  });

  describe("cross-format escape handling", () => {
    it("should handle escapes consistently when output is JSON", async () => {
      const jsonTargetFile = join(testDir, "de.json");
      writeFileSync(codeFile, `tr("Hello\\nWorld")`);
      writeFileSync(sourceFile, "");

      const config: ResolvedHermesConfig = {
        ...createConfig('tr\\(["\'](.+?)["\']\\)'),
        outputs: [
          {
            type: "json",
            path: "{lang}.json",
          },
        ],
      };

      const context = createPipelineContext(config, testDir, false);

      await new ExtractorStep().execute(context);
      await new SourceSyncStep().execute(context);

      // Verify the key in source file
      const stringsHandler = new StringsHandler();
      const sourceEntries = await stringsHandler.read(sourceFile);
      expect(sourceEntries.length).toBe(1);

      // Write to JSON target
      const jsonHandler = new JsonHandler();
      await jsonHandler.write(jsonTargetFile, sourceEntries);

      // Read back from JSON
      const jsonEntries = await jsonHandler.read(jsonTargetFile);
      expect(jsonEntries.length).toBe(1);

      // The key should be consistent (both normalized)
      expect(jsonEntries[0].key).toBe(sourceEntries[0].key);
    });
  });
});
