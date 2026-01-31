import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { GoogleTranslateService } from "../../src/services/google-translate.js";

describe("GoogleTranslateService", () => {
  const mockConfig = { apiKey: "test-api-key" };
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: Mock;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should return configured status based on API key", () => {
    expect(new GoogleTranslateService(mockConfig).isConfigured()).toBe(true);
    expect(new GoogleTranslateService({ apiKey: "" }).isConfigured()).toBe(false);
  });

  it("should successfully translate text", async () => {
    const service = new GoogleTranslateService(mockConfig);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { translations: [{ translatedText: "Hallo Welt" }] },
      }),
    });

    const result = await service.translate("Hello World", "en", "de");

    expect(result.success).toBe(true);
    expect(result.translation).toBe("Hallo Welt");
  });

  it("should skip unsupported languages and same source/target", async () => {
    const service = new GoogleTranslateService(mockConfig);

    // Unsupported source
    let result = await service.translate("Hello", "xyz", "de");
    expect(result.skipped).toBe(true);

    // Unsupported target
    result = await service.translate("Hello", "en", "xyz");
    expect(result.skipped).toBe(true);

    // Same language
    result = await service.translate("Hello", "en", "en");
    expect(result.skipped).toBe(true);
  });

  it("should handle API and network errors", async () => {
    const service = new GoogleTranslateService(mockConfig);

    // API error
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });
    let result = await service.translate("Hello", "en", "de");
    expect(result.success).toBe(false);
    expect(result.error).toContain("401");

    // Network error
    mockFetch.mockRejectedValue(new Error("Network error"));
    result = await service.translate("Hello", "en", "de");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");

    // Invalid response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    result = await service.translate("Hello", "en", "de");
    expect(result.success).toBe(false);
  });

  it("should map language codes correctly", async () => {
    const service = new GoogleTranslateService(mockConfig);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { translations: [{ translatedText: "test" }] },
      }),
    });

    // zh -> zh-CN
    await service.translate("Hello", "en", "zh");
    let url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get("target")).toBe("zh-CN");

    // Case insensitive
    mockFetch.mockClear();
    await service.translate("Hello", "EN", "FR");
    url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get("source")).toBe("en");
    expect(url.searchParams.get("target")).toBe("fr");
  });
});
