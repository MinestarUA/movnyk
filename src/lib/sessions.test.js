import { beforeEach, describe, expect, it } from "vitest";
import { deleteSession, findResumableSession, loadSessions, saveSession } from "./sessions";

const store = new Map();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

const translations = [{ key: "a", original: "Apple", translated: "Яблуко", confirmed: true }];
const session = (id, name = id) => ({ id, name, translations });
const ids = () => loadSessions().map((s) => s.id);
const legacyPayload = (savedAt = 42) => JSON.stringify({ template: { a: "Apple" }, translations, savedAt });

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

  describe("resource pack settings", () => {
    const pack = { namespace: "ae2", mcVersion: "1.20.1", language: "uk_ua" };

    it("round-trips the pack", () => {
      saveSession({ ...session("a"), pack });
      expect(loadSessions()[0].pack).toEqual(pack);
    });

    it("drops a malformed pack but keeps the session and its rows", () => {
      store.set("movnyk.sessions", JSON.stringify([{ ...session("a"), savedAt: 1, pack: "x" }]));
      const [loaded] = loadSessions();
      expect(loaded.pack).toBeUndefined();
      expect(loaded.translations).toEqual(translations);
    });
  });

  describe("guidebook list", () => {
    const books = [{ root: "assets/a/patchouli_books/b", name: "Книга" }];

    it("round-trips the books", () => {
      saveSession({ ...session("a"), books });
      expect(loadSessions()[0].books).toEqual(books);
    });

    it("drops malformed books but keeps the session and its rows", () => {
      store.set("movnyk.sessions", JSON.stringify([{ ...session("a"), savedAt: 1, books: [{ root: 1 }] }]));
      const [loaded] = loadSessions();
      expect(loaded.books).toBeUndefined();
      expect(loaded.translations).toEqual(translations);
    });
  });

  describe("quota", () => {
    // Pretends the browser can hold at most `limit` sessions.
    const limitSessions = (limit) => {
      const realSetItem = globalThis.localStorage.setItem;
      globalThis.localStorage.setItem = (k, v) => {
        if (k === "movnyk.sessions" && JSON.parse(v).length > limit) {
          throw new Error("QuotaExceededError");
        }
        realSetItem(k, v);
      };
    };

    it("evicts the oldest other sessions until the current one fits", () => {
      ["a", "b", "c", "d"].forEach((id) => saveSession(session(id)));
      limitSessions(2);
      expect(saveSession(session("e"))).toBe(true);
      expect(ids()).toEqual(["e", "d"]);
    });

    it("returns false and keeps the stored sessions when the current one alone does not fit", () => {
      ["a", "b"].forEach((id) => saveSession(session(id)));
      limitSessions(0);
      expect(saveSession(session("c"))).toBe(false);
      expect(ids()).toEqual(["b", "a"]);
    });
  });

  describe("corrupt storage", () => {
    it("returns an empty list for unparseable or non-list payloads", () => {
      store.set("movnyk.sessions", "{not json");
      expect(loadSessions()).toEqual([]);
      store.set("movnyk.sessions", JSON.stringify({ id: "a" }));
      expect(loadSessions()).toEqual([]);
    });

    it("returns an empty list when reading storage throws", () => {
      globalThis.localStorage.getItem = () => {
        throw new Error("SecurityError");
      };
      expect(loadSessions()).toEqual([]);
    });

    it.each([
      ["no id", { ...session("x"), id: undefined }],
      ["no name", { ...session("x"), name: 5 }],
      ["translations not a list", { ...session("x"), translations: "x" }],
      ["a null translation row", { ...session("x"), translations: [null] }],
      ["a row without a string key", { ...session("x"), translations: [{ key: 1 }] }],
      ["no timestamp", session("x")],
    ])("skips an entry with %s", (_, bad) => {
      const good = { ...session("good"), savedAt: 1 };
      store.set("movnyk.sessions", JSON.stringify([bad, good]));
      expect(ids()).toEqual(["good"]);
    });

    it("keeps only the first entry of a duplicated id", () => {
      const first = { ...session("dup", "first"), savedAt: 2 };
      const second = { ...session("dup", "second"), savedAt: 1 };
      store.set("movnyk.sessions", JSON.stringify([first, second]));
      expect(loadSessions().map((s) => s.name)).toEqual(["first"]);
    });
  });

  describe("migration of the old single autosave", () => {
    it("merges it into the list under a fixed id and removes the old key", () => {
      saveSession(session("a"));
      store.set("movnyk.autosave", legacyPayload());
      const sessions = loadSessions();
      expect(sessions.map((s) => s.id)).toEqual(["a", "legacy"]);
      expect(sessions[1]).toMatchObject({ name: "Попередня сесія", translations, savedAt: 42 });
      expect(store.has("movnyk.autosave")).toBe(false);
      expect(ids()).toEqual(["a", "legacy"]);
    });

    it("respects the cap, dropping the oldest entry", () => {
      ["a", "b", "c", "d", "e"].forEach((id) => saveSession(session(id)));
      store.set("movnyk.autosave", legacyPayload());
      expect(ids()).toEqual(["e", "d", "c", "b", "a"]);
      expect(store.has("movnyk.autosave")).toBe(false);
    });

    it("keeps the old key and still lists the session when the write fails", () => {
      store.set("movnyk.autosave", legacyPayload());
      globalThis.localStorage.setItem = () => {
        throw new Error("QuotaExceededError");
      };
      expect(ids()).toEqual(["legacy"]);
      expect(store.has("movnyk.autosave")).toBe(true);
    });

    it("never overwrites an already migrated session that was edited since", () => {
      store.set("movnyk.autosave", legacyPayload());
      loadSessions();
      saveSession({ id: "legacy", name: "Попередня сесія", translations: [] });
      store.set("movnyk.autosave", legacyPayload());
      expect(loadSessions()[0].translations).toEqual([]);
      expect(store.has("movnyk.autosave")).toBe(false);
    });

    it("discards an unusable old payload", () => {
      store.set("movnyk.autosave", JSON.stringify({ template: 1, translations: "x" }));
      expect(loadSessions()).toEqual([]);
      expect(store.has("movnyk.autosave")).toBe(false);
    });
  });
});

describe("findResumableSession", () => {
  const rows = (...keys) => keys.map((key) => ({ key, original: key }));
  const saved = [
    { id: "old", name: "en_us.json", translations: rows("a", "b", "c", "d"), savedAt: 1 },
  ];
  const content = (...keys) => Object.fromEntries(keys.map((key) => [key, key]));

  it.each([
    ["the same file", ["a", "b", "c", "d"], "old"],
    ["an edited file that mostly overlaps", ["a", "b", "c", "x"], "old"],
    ["exactly half of the keys shared", ["a", "b", "x", "y"], "old"],
    ["an unrelated file with the same name", ["x", "y", "z", "a"], undefined],
    ["an empty file", [], undefined],
  ])("%s", (_, keys, expectedId) => {
    expect(findResumableSession(saved, "en_us.json", content(...keys))?.id).toBe(expectedId);
  });

  it("ignores sessions with another name", () => {
    expect(findResumableSession(saved, "other.json", content("a", "b"))).toBeNull();
  });

  it("picks the same-name session that matches among several", () => {
    const sessions = [
      { id: "mod-b", name: "en_us.json", translations: rows("x", "y"), savedAt: 2 },
      ...saved,
    ];
    expect(findResumableSession(sessions, "en_us.json", content("a", "b"))?.id).toBe("old");
  });
});
