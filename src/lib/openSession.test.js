import { describe, expect, it } from "vitest";
import { openSessionRows } from "./openSession";

const NAME = "mod.jar · assets/a/lang/en_us.json";
const ROOT = "assets/a/patchouli_books/guide";
const ENTRY = `${ROOT}/en_us/entries/e.json`;
const bookOf = (pages) => ({
  books: [{ root: ROOT, id: "a:guide", files: [ENTRY], nameKey: null }],
  bookJson: { [ENTRY]: { name: "Entry", pages: pages.map((text) => ({ type: "patchouli:text", text })) } },
});
const row = (key, original, translated = "", confirmed = false) => ({ key, original, translated, confirmed });
const saved = (translations) => [{ id: "s1", name: NAME, translations, savedAt: 1 }];

describe("openSessionRows", () => {
  it("resumes a lang-only saved session when the jar brings a large book", () => {
    const langRows = [row("k1", "One", "Один", true), row("k2", "Two", "Два", true)];
    const pages = Array.from({ length: 20 }, (_, i) => `Page ${i}`);
    const result = openSessionRows({
      savedSessions: saved(langRows),
      name: NAME,
      content: { k1: "One", k2: "Two" },
      ...bookOf(pages),
    });
    expect(result.existing?.id).toBe("s1");
    expect(result.next.slice(0, 2)).toEqual(langRows);
    expect(result.next).toHaveLength(2 + 1 + 20);
  });

  it("does not move a removed lang key's translation onto a book field with the same text", () => {
    const result = openSessionRows({
      savedSessions: saved([row("keep", "Keep", "Лишити", true), row("old", "Hello", "Привіт", true)]),
      name: NAME,
      content: { keep: "Keep" },
      ...bookOf(["Hello"]),
    });
    const helloRow = result.next.find((r) => r.original === "Hello");
    expect(helloRow.translated).toBe("");
    expect(result.removed.map((r) => r.key)).toEqual(["old"]);
  });

  it("is a no-op when the same jar is dropped again", () => {
    const content = { k1: "One" };
    const first = openSessionRows({ savedSessions: [], name: NAME, content, ...bookOf(["Page"]) });
    const edited = first.next.map((r) => ({ ...r, translated: `T ${r.original}`, confirmed: true }));
    const again = openSessionRows({ savedSessions: saved(edited), name: NAME, content, ...bookOf(["Page"]) });
    expect(again.next).toEqual(edited);
    expect(again.removed).toEqual([]);
    expect(again.stats).toEqual({ unchanged: edited.length, changed: 0, renamed: 0, added: 0, removed: 0 });
  });
});
