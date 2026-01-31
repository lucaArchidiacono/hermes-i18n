import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeepLService } from "../../src/services/deepl.js";

vi.mock("deepl-node", () => ({
  Translator: vi.fn().mockImplementation(() => ({
    translateText: vi.fn(),
  })),
}));

describe("DeepLService", () => {
  const mockConfig = { apiKey: "test-api-key", formality: "default" as const };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return configured status based on API key", () => {
    expect(new DeepLService(mockConfig).isConfigured()).toBe(true);
    expect(new DeepLService({ apiKey: "", formality: "default" }).isConfigured()).toBe(false);
  });

  it("should skip unsupported languages and same source/target", async () => {
    const service = new DeepLService(mockConfig);

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

  it("should translate text and map languages correctly", async () => {
    const { Translator } = await import("deepl-node");
    const mockTranslateText = vi.fn().mockResolvedValue({ text: "Hallo Welt" });
    (Translator as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      translateText: mockTranslateText,
    }));

    const service = new DeepLService(mockConfig);
    const result = await service.translate("Hello World", "en", "de");

    expect(result.success).toBe(true);
    expect(result.translation).toBe("Hallo Welt");
    // en -> en-US for target
    expect(mockTranslateText).toHaveBeenCalledWith("Hello World", "en", "de", expect.any(Object));
  });

  it("should handle API errors", async () => {
    const { Translator } = await import("deepl-node");
    (Translator as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      translateText: vi.fn().mockRejectedValue(new Error("API Error")),
    }));

    const service = new DeepLService(mockConfig);
    const result = await service.translate("Hello", "en", "de");

    expect(result.success).toBe(false);
    expect(result.error).toBe("API Error");
  });
});
