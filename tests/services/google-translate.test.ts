import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { GoogleTranslateService } from "../../src/services/google-translate.js";

describe("GoogleTranslateService", () => {
  const mockConfig = {
    apiKey: "test-api-key",
  };

  let originalFetch: typeof globalThis.fetch;
  let mockFetch: Mock;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("isConfigured", () => {
    it("should return true when API key is provided", () => {
      const service = new GoogleTranslateService(mockConfig);
      expect(service.isConfigured()).toBe(true);
    });

    it("should return false when API key is empty", () => {
      const service = new GoogleTranslateService({ apiKey: "" });
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe("translate", () => {
    it("should successfully translate text", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: "Hallo Welt" }],
          },
        }),
      });

      const result = await service.translate("Hello World", "en", "de");

      expect(result.success).toBe(true);
      expect(result.translation).toBe("Hallo Welt");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should skip when source language is not supported", async () => {
      const service = new GoogleTranslateService(mockConfig);

      const result = await service.translate("Hello", "xyz", "de");

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain(
        "Source language 'xyz' not supported",
      );
    });

    it("should skip when target language is not supported", async () => {
      const service = new GoogleTranslateService(mockConfig);

      const result = await service.translate("Hello", "en", "xyz");

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain(
        "Target language 'xyz' not supported",
      );
    });

    it("should skip when source and target languages are the same", async () => {
      const service = new GoogleTranslateService(mockConfig);

      const result = await service.translate("Hello", "en", "en");

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe(
        "Source and target languages are the same",
      );
    });

    it("should handle API errors gracefully", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const result = await service.translate("Hello", "en", "de");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Google Translate API error");
      expect(result.error).toContain("401");
    });

    it("should handle network errors gracefully", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await service.translate("Hello", "en", "de");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should handle invalid API response", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {},
        }),
      });

      const result = await service.translate("Hello", "en", "de");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid response from Google Translate API");
    });

    it("should handle empty translations array in response", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [],
          },
        }),
      });

      const result = await service.translate("Hello", "en", "de");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid response from Google Translate API");
    });
  });

  describe("language mapping", () => {
    it("should map Chinese variants correctly", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: "你好" }],
          },
        }),
      });

      // Test simplified Chinese
      await service.translate("Hello", "en", "zh");
      expect(mockFetch).toHaveBeenCalled();

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get("target")).toBe("zh-CN");
    });

    it("should map zh-hans to zh-CN", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: "你好" }],
          },
        }),
      });

      await service.translate("Hello", "en", "zh-hans");
      expect(mockFetch).toHaveBeenCalled();

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get("target")).toBe("zh-CN");
    });

    it("should map zh-hant to zh-TW", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: "你好" }],
          },
        }),
      });

      await service.translate("Hello", "en", "zh-hant");
      expect(mockFetch).toHaveBeenCalled();

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get("target")).toBe("zh-TW");
    });

    it("should handle case-insensitive language codes", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: "Bonjour" }],
          },
        }),
      });

      await service.translate("Hello", "EN", "FR");
      expect(mockFetch).toHaveBeenCalled();

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get("source")).toBe("en");
      expect(url.searchParams.get("target")).toBe("fr");
    });

    it("should map English variants correctly", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: "Hallo" }],
          },
        }),
      });

      await service.translate("Hello", "en-us", "de");

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get("source")).toBe("en");
    });

    it("should map Portuguese variants correctly", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: "Olá" }],
          },
        }),
      });

      await service.translate("Hello", "en", "pt-br");

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get("target")).toBe("pt");
    });
  });

  describe("API request format", () => {
    it("should send correct request parameters", async () => {
      const service = new GoogleTranslateService(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: "Hallo" }],
          },
        }),
      });

      await service.translate("Hello World", "en", "de");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const url = new URL(callArgs[0]);

      expect(url.origin + url.pathname).toBe(
        "https://translation.googleapis.com/language/translate/v2",
      );
      expect(url.searchParams.get("key")).toBe("test-api-key");
      expect(url.searchParams.get("q")).toBe("Hello World");
      expect(url.searchParams.get("source")).toBe("en");
      expect(url.searchParams.get("target")).toBe("de");
      expect(url.searchParams.get("format")).toBe("text");

      expect(callArgs[1]).toEqual({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    });
  });
});
