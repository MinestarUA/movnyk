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
});
