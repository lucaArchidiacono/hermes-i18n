import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { resolve, join } from "path";
import { StringsHandler } from "../../src/file-handlers/strings.js";
import { ExtractorStep } from "../../src/pipeline/steps/extractor.js";
import { SourceSyncStep } from "../../src/pipeline/steps/source-sync.js";
import { MissingFinderStep } from "../../src/pipeline/steps/missing-finder.js";
import { createPipelineContext } from "../../src/pipeline/types.js";
import type { ResolvedHermesConfig } from "../../src/config/types.js";

describe("Pipeline escape handling", () => {
  const testDir = resolve(__dirname, "../fixtures/escape-integration-test");
  const sourceFile = join(testDir, "Localizable.strings");
  const targetFile = join(testDir, "de.lproj/Localizable.strings");
  const codeFile = join(testDir, "Source.swift");

  beforeEach(() => {
    mkdirSync(join(testDir, "de.lproj"), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function createConfig(): ResolvedHermesConfig {
    return {
      sourceLanguage: "en",
      targetLanguages: ["de"],
      source: { path: "Localizable.strings", type: "strings" },
      outputs: [{ type: "strings", path: "{lang}.lproj/Localizable.strings" }],
      include: ["**/*.swift"],
      exclude: ["node_modules/**"],
      extractPattern: /tr\(["'](.+?)["']\)/g,
      translator: "deepl",
      deepl: { apiKey: "", formality: "default" },
      googleTranslate: { apiKey: "" },
      ai: { provider: "openai", model: "gpt-4o-mini", apiKey: "", systemPrompt: "" },
    };
  }

  it("should extract keys with escape sequences in normalized form", async () => {
    writeFileSync(codeFile, `tr("Hello\\nWorld")\ntr("Tab\\there")`);

    const context = createPipelineContext(createConfig(), testDir, true);
    await new ExtractorStep().execute(context);

    expect(context.extractedKeys).toContain("Hello\\nWorld");
    expect(context.extractedKeys).toContain("Tab\\there");
  });

  it("should match extracted keys with source file entries", async () => {
    writeFileSync(codeFile, `tr("Hello\\nWorld")`);
    writeFileSync(sourceFile, `"Hello\\nWorld" = "Hello\\nWorld";\n`);

    const context = createPipelineContext(createConfig(), testDir, false);
    await new ExtractorStep().execute(context);
    await new SourceSyncStep().execute(context);

    expect(context.newSourceKeys.length).toBe(0);
  });

  it("should not create duplicates on multiple syncs", async () => {
    writeFileSync(codeFile, `tr("Hello\\nWorld")`);
    writeFileSync(sourceFile, "");

    const stringsHandler = new StringsHandler();

    for (let i = 0; i < 3; i++) {
      const context = createPipelineContext(createConfig(), testDir, false);
      await new ExtractorStep().execute(context);
      await new SourceSyncStep().execute(context);

      const entries = await stringsHandler.read(sourceFile);
      expect(entries.length).toBe(1);
    }
  });

  it("should not accumulate escapes on multiple syncs", async () => {
    writeFileSync(codeFile, `tr("Line1\\nLine2")`);
    writeFileSync(sourceFile, "");

    for (let i = 0; i < 5; i++) {
      const context = createPipelineContext(createConfig(), testDir, false);
      await new ExtractorStep().execute(context);
      await new SourceSyncStep().execute(context);

      const rawContent = readFileSync(sourceFile, "utf-8");
      // Should never have more than 2 backslashes before 'n'
      expect(rawContent).not.toContain("\\\\\\n");
    }
  });

  it("should correctly identify missing translations", async () => {
    writeFileSync(codeFile, `tr("Hello\\nWorld")`);
    writeFileSync(sourceFile, `"Hello\\nWorld" = "Hello\\nWorld";\n`);
    writeFileSync(targetFile, "");

    const context = createPipelineContext(createConfig(), testDir, false);
    await new ExtractorStep().execute(context);
    await new SourceSyncStep().execute(context);
    await new MissingFinderStep().execute(context);

    expect(context.translations.get("de")!.missing.size).toBe(1);
  });

  it("should not mark existing translation as missing", async () => {
    writeFileSync(codeFile, `tr("Hello\\nWorld")`);
    writeFileSync(sourceFile, `"Hello\\nWorld" = "Hello\\nWorld";\n`);
    writeFileSync(targetFile, `"Hello\\nWorld" = "Hallo\\nWelt";\n`);

    const context = createPipelineContext(createConfig(), testDir, false);
    await new ExtractorStep().execute(context);
    await new SourceSyncStep().execute(context);
    await new MissingFinderStep().execute(context);

    expect(context.translations.get("de")!.missing.size).toBe(0);
  });
});
