import { beforeEach, describe, expect, it } from "vitest";
import { loadSettings, saveSettings } from "./settings";

const store = new Map();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

describe("settings", () => {
  it("defaults skipIdenticalImport to true", () => {
    expect(loadSettings().skipIdenticalImport).toBe(true);
  });

  it("round-trips skipIdenticalImport", () => {
    saveSettings({ apiKey: "k", model: "gemini-2.5-flash", skipIdenticalImport: false });
    expect(loadSettings()).toMatchObject({ apiKey: "k", skipIdenticalImport: false });
  });

  it("defaults unconfirmOnEdit to true and round-trips it", () => {
    expect(loadSettings().unconfirmOnEdit).toBe(true);
    saveSettings({ apiKey: "", model: "gemini-2.5-flash", unconfirmOnEdit: false });
    expect(loadSettings().unconfirmOnEdit).toBe(false);
  });

  it("defaults skipApprovedImport to true and round-trips it", () => {
    expect(loadSettings().skipApprovedImport).toBe(true);
    saveSettings({ apiKey: "", model: "gemini-2.5-flash", skipApprovedImport: false });
    expect(loadSettings().skipApprovedImport).toBe(false);
  });

  it("defaults focusSearchOnFind to true and round-trips it", () => {
    expect(loadSettings().focusSearchOnFind).toBe(true);
    saveSettings({ apiKey: "", model: "gemini-2.0-flash", focusSearchOnFind: false });
    expect(loadSettings().focusSearchOnFind).toBe(false);
  });

  it("normalizes non-existent gemini-2.5-flash model to gemini-2.0-flash", () => {
    saveSettings({ apiKey: "", model: "gemini-2.5-flash" });
    expect(loadSettings().model).toBe("gemini-2.0-flash");
  });

  it("defaults syncIdenticalTranslations to true and round-trips it", () => {
    expect(loadSettings().syncIdenticalTranslations).toBe(true);
    saveSettings({ syncIdenticalTranslations: false });
    expect(loadSettings().syncIdenticalTranslations).toBe(false);
  });

  it("round-trips aiProvider and DeepL settings", () => {
    expect(loadSettings().aiProvider).toBe("gemini");
    saveSettings({
      aiProvider: "deepl",
      deeplApiKey: "key:fx",
      useDeeplProxy: true,
      deeplProxyUrl: "https://proxy.example.com",
    });
    const loaded = loadSettings();
    expect(loaded.aiProvider).toBe("deepl");
    expect(loaded.deeplApiKey).toBe("key:fx");
    expect(loaded.useDeeplProxy).toBe(true);
    expect(loaded.deeplProxyUrl).toBe("https://proxy.example.com");
  });
});
