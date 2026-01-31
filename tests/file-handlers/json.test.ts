import { describe, it, expect, afterEach } from "vitest";
import { JsonHandler } from "../../src/file-handlers/json.js";
import { readFileSync, unlinkSync, existsSync, rmSync } from "fs";
import { resolve } from "path";

describe("JsonHandler", () => {
  const handler = new JsonHandler();
  const fixturesDir = resolve(__dirname, "../fixtures");
  const sampleFile = resolve(fixturesDir, "sample.json");
  const tempFile = resolve(fixturesDir, "temp.json");

  afterEach(() => {
    if (existsSync(tempFile)) unlinkSync(tempFile);
  });

  it("should have type 'json'", () => {
    expect(handler.type).toBe("json");
  });

  it("should read and parse JSON files", async () => {
    const entries = await handler.read(sampleFile);

    expect(entries.find((e) => e.key === "hello_world")?.value).toBe("Hello World");
    expect(entries.find((e) => e.key === "greeting")?.value).toBe("Hello, {name}!");
    expect(entries.find((e) => e.key === "with_quotes")?.value).toBe('He said "Hello"');
    expect(entries.find((e) => e.key === "multiline")?.value).toBe("Line 1\\nLine 2");
  });

  it("should return empty array for non-existent file or empty object", async () => {
    expect(await handler.read("/non/existent/file.json")).toEqual([]);
    expect(handler.parse("{}")).toEqual([]);
  });

  it("should throw error for invalid JSON", () => {
    expect(() => handler.parse("{ invalid json }")).toThrow("Failed to parse JSON");
  });

  it("should write entries as formatted JSON", async () => {
    const entries = [
      { key: "test_key", value: "Test Value" },
      { key: "another", value: "Another Value" },
    ];

    await handler.write(tempFile, entries);
    const content = readFileSync(tempFile, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed.test_key).toBe("Test Value");
    expect(parsed.another).toBe("Another Value");
    expect(content).toContain("{\n");
    expect(content.endsWith("\n")).toBe(true);
  });

  it("should create parent directories if needed", async () => {
    const uniqueDir = `nested-json-${Date.now()}`;
    const nestedFile = resolve(fixturesDir, `${uniqueDir}/deep/test.json`);

    try {
      await handler.write(nestedFile, [{ key: "test", value: "value" }]);
      expect(existsSync(nestedFile)).toBe(true);
    } finally {
      if (existsSync(resolve(fixturesDir, uniqueDir))) {
        rmSync(resolve(fixturesDir, uniqueDir), { recursive: true });
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

    expect(readEntries.find((e) => e.key === "japanese")?.value).toBe("こんにちは");
    expect(readEntries.find((e) => e.key === "emoji")?.value).toBe("Hello 👋");
  });

  it("should roundtrip escape sequences without accumulation", async () => {
    const original = { key: "test", value: 'line1\\nline2\\t"quote"' };

    // Multiple write-read cycles should not accumulate escapes
    await handler.write(tempFile, [original]);
    let entries = await handler.read(tempFile);
    expect(entries[0].value).toBe(original.value);

    await handler.write(tempFile, entries);
    entries = await handler.read(tempFile);
    expect(entries[0].value).toBe(original.value);

    await handler.write(tempFile, entries);
    entries = await handler.read(tempFile);
    expect(entries[0].value).toBe(original.value);
  });

  it("should handle all escape types", async () => {
    const entries = [
      { key: "quotes", value: 'He said "Hello"' },
      { key: "newline", value: "Line 1\\nLine 2" },
      { key: "backslash", value: "folder\\\\subfolder" },
      { key: "placeholder", value: "Hello {name}!" },
      { key: "empty", value: "" },
    ];

    await handler.write(tempFile, entries);
    const readEntries = await handler.read(tempFile);

    for (const entry of entries) {
      expect(readEntries.find((e) => e.key === entry.key)?.value).toBe(entry.value);
    }
  });
});
