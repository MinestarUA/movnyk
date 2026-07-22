import { beforeEach, describe, expect, it } from "vitest";
import { loadAutosave, saveAutosave } from "./autosave";

const store = new Map();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

describe("autosave", () => {
  const template = { a: "Apple" };
  const translations = [{ key: "a", original: "Apple", translated: "Яблуко", confirmed: true }];

  it("round-trips a saved slot with a timestamp", () => {
    expect(saveAutosave({ template, translations })).toBe(true);
    const slot = loadAutosave();
    expect(slot.template).toEqual(template);
    expect(slot.translations).toEqual(translations);
    expect(typeof slot.savedAt).toBe("number");
  });

  it("returns null when nothing is saved", () => {
    expect(loadAutosave()).toBeNull();
  });

  it("returns null for corrupt or malformed payloads", () => {
    store.set("movnyk.autosave", "{not json");
    expect(loadAutosave()).toBeNull();
    store.set("movnyk.autosave", JSON.stringify({ template: 1, translations: "x" }));
    expect(loadAutosave()).toBeNull();
  });

  it("returns false when storage write throws (quota)", () => {
    globalThis.localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(saveAutosave({ template, translations })).toBe(false);
  });
});
