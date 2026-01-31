import { describe, it, expect, afterEach } from "vitest";
import { StringsHandler } from "../../src/file-handlers/strings.js";
import { readFileSync, unlinkSync, existsSync, rmSync } from "fs";
import { resolve } from "path";

describe("StringsHandler", () => {
  const handler = new StringsHandler();
  const fixturesDir = resolve(__dirname, "../fixtures");
  const sampleFile = resolve(fixturesDir, "sample.strings");
  const tempFile = resolve(fixturesDir, "temp.strings");

  afterEach(() => {
    if (existsSync(tempFile)) unlinkSync(tempFile);
  });

  it("should have type 'strings'", () => {
    expect(handler.type).toBe("strings");
  });

  it("should read and parse .strings files", async () => {
    const entries = await handler.read(sampleFile);

    expect(entries.find((e) => e.key === "Hello World")?.value).toBe("Hello World");
    expect(entries.find((e) => e.key === "Hello, %@!")?.value).toBe("Hello, %@!");
    expect(entries.find((e) => e.key === "Line 1\\nLine 2")?.value).toBe("Line 1\\nLine 2");
  });

  it("should return empty array for non-existent file", async () => {
    expect(await handler.read("/non/existent/file.strings")).toEqual([]);
  });

  it("should write entries in correct format", async () => {
    const entries = [
      { key: "Test", value: "Test Value" },
      { key: "Line 1\\nLine 2", value: "Line 1\\nLine 2" },
    ];

    await handler.write(tempFile, entries);
    const content = readFileSync(tempFile, "utf-8");

    expect(content).toContain('"Test" = "Test Value";');
    expect(content).toContain('"Line 1\\nLine 2" = "Line 1\\nLine 2";');
  });

  it("should create parent directories if needed", async () => {
    const uniqueDir = `nested-strings-${Date.now()}`;
    const nestedFile = resolve(fixturesDir, `${uniqueDir}/deep/test.strings`);

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
    const original = { key: "test", value: "line1\\nline2\\ttab" };

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
      { key: "newline", value: "before\\nafter" },
      { key: "tab", value: "before\\tafter" },
      { key: "cr", value: "before\\rafter" },
      { key: "backslash", value: "folder\\\\subfolder" },
      { key: "empty", value: "" },
    ];

    await handler.write(tempFile, entries);
    const readEntries = await handler.read(tempFile);

    for (const entry of entries) {
      expect(readEntries.find((e) => e.key === entry.key)?.value).toBe(entry.value);
    }
  });
});
