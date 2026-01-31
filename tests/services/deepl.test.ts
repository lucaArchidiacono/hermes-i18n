import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DeepLService } from "../../src/services/deepl.js";

// Mock the deepl-node module
vi.mock("deepl-node", () => {
  return {
    Translator: vi.fn().mockImplementation(() => ({
      translateText: vi.fn(),
    })),
  };
});

describe("DeepLService", () => {
  const mockConfig = {
    apiKey: "test-api-key",
    formality: "default" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isConfigured", () => {
    it("should return true when API key is provided", () => {
      const service = new DeepLService(mockConfig);
      expect(service.isConfigured()).toBe(true);
    });

    it("should return false when API key is empty", () => {
      const service = new DeepLService({ apiKey: "", formality: "default" });
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe("translate", () => {
    it("should skip when source language is not supported", async () => {
      const service = new DeepLService(mockConfig);

      const result = await service.translate("Hello", "xyz", "de");

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain("Source language 'xyz' not supported");
    });

    it("should skip when target language is not supported", async () => {
      const service = new DeepLService(mockConfig);

      const result = await service.translate("Hello", "en", "xyz");

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain("Target language 'xyz' not supported");
    });

    it("should skip when source and target languages are the same", async () => {
      const service = new DeepLService(mockConfig);

      const result = await service.translate("Hello", "en", "en");

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("Source and target languages are the same");
    });

    it("should successfully translate text", async () => {
      const { Translator } = await import("deepl-node");
      const mockTranslateText = vi.fn().mockResolvedValue({ text: "Hallo Welt" });
      (Translator as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        translateText: mockTranslateText,
      }));

      const service = new DeepLService(mockConfig);
      const result = await service.translate("Hello World", "en", "de");

      expect(result.success).toBe(true);
      expect(result.translation).toBe("Hallo Welt");
    });

    it("should handle API errors gracefully", async () => {
      const { Translator } = await import("deepl-node");
      const mockTranslateText = vi.fn().mockRejectedValue(new Error("API Error"));
      (Translator as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        translateText: mockTranslateText,
      }));

      const service = new DeepLService(mockConfig);
      const result = await service.translate("Hello", "en", "de");

      expect(result.success).toBe(false);
      expect(result.error).toBe("API Error");
    });
  });

  describe("language mapping", () => {
    it("should map en to en-US for target language", async () => {
      const { Translator } = await import("deepl-node");
      const mockTranslateText = vi.fn().mockResolvedValue({ text: "Test" });
      (Translator as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        translateText: mockTranslateText,
      }));

      const service = new DeepLService(mockConfig);
      await service.translate("Test", "de", "en");

      expect(mockTranslateText).toHaveBeenCalledWith(
        "Test",
        "de",
        "en-US",
        expect.any(Object)
      );
    });

    it("should map pt to pt-PT for target language", async () => {
      const { Translator } = await import("deepl-node");
      const mockTranslateText = vi.fn().mockResolvedValue({ text: "Teste" });
      (Translator as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        translateText: mockTranslateText,
      }));

      const service = new DeepLService(mockConfig);
      await service.translate("Test", "en", "pt");

      expect(mockTranslateText).toHaveBeenCalledWith(
        "Test",
        "en",
        "pt-PT",
        expect.any(Object)
      );
    });

    it("should map zh-hans correctly", async () => {
      const { Translator } = await import("deepl-node");
      const mockTranslateText = vi.fn().mockResolvedValue({ text: "测试" });
      (Translator as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        translateText: mockTranslateText,
      }));

      const service = new DeepLService(mockConfig);
      await service.translate("Test", "en", "zh-hans");

      expect(mockTranslateText).toHaveBeenCalledWith(
        "Test",
        "en",
        "zh-HANS",
        expect.any(Object)
      );
    });

    it("should handle case-insensitive language codes", async () => {
      const { Translator } = await import("deepl-node");
      const mockTranslateText = vi.fn().mockResolvedValue({ text: "Bonjour" });
      (Translator as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        translateText: mockTranslateText,
      }));

      const service = new DeepLService(mockConfig);
      await service.translate("Hello", "EN", "FR");

      expect(mockTranslateText).toHaveBeenCalledWith(
        "Hello",
        "en",
        "fr",
        expect.any(Object)
      );
    });
  });

  describe("formality settings", () => {
    it.each([
      ["default", "default"],
      ["more", "more"],
      ["less", "less"],
      ["prefer_more", "prefer_more"],
      ["prefer_less", "prefer_less"],
    ] as const)("should use formality '%s'", async (input, expected) => {
      const { Translator } = await import("deepl-node");
      const mockTranslateText = vi.fn().mockResolvedValue({ text: "Test" });
      (Translator as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        translateText: mockTranslateText,
      }));

      const service = new DeepLService({ apiKey: "test-key", formality: input });
      await service.translate("Test", "en", "de");

      expect(mockTranslateText).toHaveBeenCalledWith(
        "Test",
        "en",
        "de",
        expect.objectContaining({ formality: expected })
      );
    });
  });
});
