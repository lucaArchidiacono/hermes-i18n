import { describe, it, expect } from "vitest";
import { GoogleTranslateService } from "../../src/services/google-translate.js";

/**
 * Integration tests for Google Translate API
 * Run with: GOOGLE_TRANSLATE_API_KEY=your-key bun test:run tests/services/google-translate.integration.test.ts
 */
describe("GoogleTranslateService Integration", () => {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY ?? "";
  const testFn = apiKey ? it : it.skip;

  testFn("should translate text and return expected schema", async () => {
    const service = new GoogleTranslateService({ apiKey });

    const result = await service.translate("Hello", "en", "de");

    expect(result.success).toBe(true);
    expect(typeof result.translation).toBe("string");
    expect(result.translation!.length).toBeGreaterThan(0);
  });

  testFn("should return error for invalid API key", async () => {
    const service = new GoogleTranslateService({ apiKey: "invalid-key" });

    const result = await service.translate("Hello", "en", "de");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
