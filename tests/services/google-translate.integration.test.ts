import { describe, it, expect } from "vitest";
import { GoogleTranslateService } from "../../src/services/google-translate.js";

/**
 * Integration tests for Google Translate API
 * These tests actually hit the Google Translate API to verify the response schema
 *
 * To run these tests, set GOOGLE_TRANSLATE_API_KEY environment variable:
 *   GOOGLE_TRANSLATE_API_KEY=your-key bun test:run tests/services/google-translate.integration.test.ts
 */
describe("GoogleTranslateService Integration", () => {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY ?? "";

  // Skip all tests if API key is not configured
  const testFn = apiKey ? it : it.skip;

  testFn("should translate English to German", async () => {
    const service = new GoogleTranslateService({ apiKey });

    const result = await service.translate("Hello", "en", "de");

    expect(result.success).toBe(true);
    expect(result.translation).toBeDefined();
    expect(typeof result.translation).toBe("string");
    expect(result.translation!.length).toBeGreaterThan(0);
    // "Hello" in German is typically "Hallo"
    expect(result.translation!.toLowerCase()).toContain("hallo");
  });

  testFn("should translate English to French", async () => {
    const service = new GoogleTranslateService({ apiKey });

    const result = await service.translate("Good morning", "en", "fr");

    expect(result.success).toBe(true);
    expect(result.translation).toBeDefined();
    expect(typeof result.translation).toBe("string");
    expect(result.translation!.length).toBeGreaterThan(0);
  });

  testFn("should translate English to Spanish", async () => {
    const service = new GoogleTranslateService({ apiKey });

    const result = await service.translate("Thank you", "en", "es");

    expect(result.success).toBe(true);
    expect(result.translation).toBeDefined();
    expect(typeof result.translation).toBe("string");
    // "Thank you" in Spanish is "Gracias"
    expect(result.translation!.toLowerCase()).toContain("gracias");
  });

  testFn("should translate English to Japanese", async () => {
    const service = new GoogleTranslateService({ apiKey });

    const result = await service.translate("Hello", "en", "ja");

    expect(result.success).toBe(true);
    expect(result.translation).toBeDefined();
    expect(typeof result.translation).toBe("string");
    expect(result.translation!.length).toBeGreaterThan(0);
  });

  testFn("should translate English to Simplified Chinese", async () => {
    const service = new GoogleTranslateService({ apiKey });

    const result = await service.translate("Hello", "en", "zh");

    expect(result.success).toBe(true);
    expect(result.translation).toBeDefined();
    expect(typeof result.translation).toBe("string");
    expect(result.translation!.length).toBeGreaterThan(0);
  });

  testFn("should handle special characters and placeholders", async () => {
    const service = new GoogleTranslateService({ apiKey });

    const result = await service.translate(
      "Hello {name}, you have {count} messages",
      "en",
      "de"
    );

    expect(result.success).toBe(true);
    expect(result.translation).toBeDefined();
    // Placeholders should be preserved
    expect(result.translation).toContain("{name}");
    expect(result.translation).toContain("{count}");
  });

  testFn("should handle multiline text", async () => {
    const service = new GoogleTranslateService({ apiKey });

    const result = await service.translate("Hello\nWorld", "en", "de");

    expect(result.success).toBe(true);
    expect(result.translation).toBeDefined();
    expect(typeof result.translation).toBe("string");
  });

  testFn("should return error for invalid API key", async () => {
    const service = new GoogleTranslateService({ apiKey: "invalid-key" });

    const result = await service.translate("Hello", "en", "de");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  testFn(
    "should verify response schema matches expected structure",
    async () => {
      const service = new GoogleTranslateService({ apiKey });

      // This test verifies the API response structure hasn't changed
      const result = await service.translate("Test", "en", "de");

      // The result should follow our TranslationResult interface
      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");

      if (result.success) {
        expect(result).toHaveProperty("translation");
        expect(typeof result.translation).toBe("string");
      } else {
        // If failed, should have error info
        expect(
          result.error !== undefined || result.skipped !== undefined
        ).toBe(true);
      }
    }
  );
});
