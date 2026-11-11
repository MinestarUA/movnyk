import { beforeEach, describe, expect, it } from "vitest";
import { deleteSession, loadSessions, saveSession } from "./sessions";

const store = new Map();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

const template = { a: "Apple" };
const translations = [{ key: "a", original: "Apple", translated: "Яблуко", confirmed: true }];
const session = (id, name = id) => ({ id, name, template, translations });
const ids = () => loadSessions().map((s) => s.id);

describe("sessions", () => {
  it("round-trips a saved session with a timestamp", () => {
    expect(saveSession(session("one", "en_us.json"))).toBe(true);
    const [saved] = loadSessions();
    expect(saved).toMatchObject(session("one", "en_us.json"));
    expect(typeof saved.savedAt).toBe("number");
  });

  it("lists the most recently saved first and drops the oldest past five", () => {
    ["a", "b", "c", "d", "e", "f"].forEach((id) => saveSession(session(id)));
    expect(ids()).toEqual(["f", "e", "d", "c", "b"]);
  });

  it("replaces a session with the same id and moves it to the front", () => {
    ["a", "b", "c"].forEach((id) => saveSession(session(id)));
    saveSession({ ...session("a"), translations: [] });
    expect(ids()).toEqual(["a", "c", "b"]);
    expect(loadSessions()[0].translations).toEqual([]);
  });

  it("deletes only the requested session", () => {
    ["a", "b", "c"].forEach((id) => saveSession(session(id)));
    deleteSession("b");
    expect(ids()).toEqual(["c", "a"]);
  });

  it("returns false when storage write throws (quota)", () => {
    globalThis.localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(saveSession(session("a"))).toBe(false);
  });

  describe("corrupt storage", () => {
    it("returns an empty list for unparseable or non-list payloads", () => {
      store.set("movnyk.sessions", "{not json");
      expect(loadSessions()).toEqual([]);
      store.set("movnyk.sessions", JSON.stringify({ id: "a" }));
      expect(loadSessions()).toEqual([]);
    });

    it.each([
      ["no id", { ...session("x"), id: undefined }],
      ["no name", { ...session("x"), name: 5 }],
      ["null template", { ...session("x"), template: null }],
      ["translations not a list", { ...session("x"), translations: "x" }],
      ["a null translation row", { ...session("x"), translations: [null] }],
      ["no timestamp", session("x")],
    ])("skips an entry with %s", (_, bad) => {
      const good = { ...session("good"), savedAt: 1 };
      store.set("movnyk.sessions", JSON.stringify([bad, good]));
      expect(ids()).toEqual(["good"]);
    });
  });

  describe("migration of the old single autosave", () => {
    it("converts it into one named session and removes the old key", () => {
      store.set("movnyk.autosave", JSON.stringify({ template, translations, savedAt: 42 }));
      const sessions = loadSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({ name: "Попередня сесія", template, translations, savedAt: 42 });
      expect(store.has("movnyk.autosave")).toBe(false);
      expect(ids()).toEqual([sessions[0].id]);
    });

    it("keeps the old key when it cannot be written to the new store", () => {
      store.set("movnyk.autosave", JSON.stringify({ template, translations, savedAt: 42 }));
      globalThis.localStorage.setItem = () => {
        throw new Error("QuotaExceededError");
      };
      loadSessions();
      expect(store.has("movnyk.autosave")).toBe(true);
    });

    it("discards an unusable old payload", () => {
      store.set("movnyk.autosave", JSON.stringify({ template: 1, translations: "x" }));
      expect(loadSessions()).toEqual([]);
      expect(store.has("movnyk.autosave")).toBe(false);
    });

    it("leaves the old key alone when the new store already has sessions", () => {
      saveSession(session("a"));
      store.set("movnyk.autosave", JSON.stringify({ template, translations, savedAt: 42 }));
      expect(ids()).toEqual(["a"]);
      expect(store.has("movnyk.autosave")).toBe(true);
    });
  });
});
