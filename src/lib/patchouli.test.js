import { describe, expect, it } from "vitest";
import {
  applyPatchouliTranslations,
  bookRowLabel,
  extractPatchouliUnits,
  findPatchouliBooks,
  rowInScope,
} from "./patchouli";

const ENTRY_PATH = "assets/a/patchouli_books/b/en_us/entries/x/y.json";
const CATEGORY_PATH = "assets/a/patchouli_books/b/en_us/categories/c.json";
const pointersOf = (units) => units.map(({ key }) => key.slice(key.lastIndexOf("#") + 1));

describe("extractPatchouliUnits", () => {
  it.each([
    ["category name and description", CATEGORY_PATH, { name: "N", description: "D", icon: "a:b" }, ["/name", "/description"]],
    [
      "entry name and the text fields of pages at their real index",
      ENTRY_PATH,
      {
        name: "E",
        pages: [
          { type: "patchouli:spotlight", item: "minecraft:stone" },
          { type: "patchouli:text", title: "T", text: "Body $(br) x" },
        ],
      },
      ["/name", "/pages/1/title", "/pages/1/text"],
    ],
    ["a blank value", ENTRY_PATH, { name: "  " }, []],
    ["a resource id", ENTRY_PATH, { name: "mymod:some_id" }, []],
  ])("%s", (_name, path, json, pointers) => {
    expect(pointersOf(extractPatchouliUnits(path, json))).toEqual(pointers);
  });

  it("skips a value that is a lang key", () => {
    const units = extractPatchouliUnits(ENTRY_PATH, { name: "book.entry.name" }, new Set(["book.entry.name"]));
    expect(units).toEqual([]);
  });
});

describe("applyPatchouliTranslations", () => {
  const json = { name: "E", icon: "a:b", pages: [{ type: "patchouli:text", text: "Body", anchor: "z" }] };

  it("replaces only the given fields and keeps key order", () => {
    const out = applyPatchouliTranslations(json, [["/pages/0/text", "Тіло"], ["/name", "Е"]]);
    const expected = { name: "Е", icon: "a:b", pages: [{ type: "patchouli:text", text: "Тіло", anchor: "z" }] };
    expect(JSON.stringify(out)).toBe(JSON.stringify(expected));
  });

  it("ignores pointers to missing or non-string fields", () => {
    const out = applyPatchouliTranslations({ ...json, sortnum: 3 }, [["/sortnum", "x"], ["/pages/5/text", "x"]]);
    expect(out).toEqual({ ...json, sortnum: 3 });
  });
});

describe("findPatchouliBooks", () => {
  const root = "assets/a/patchouli_books/b";
  it.each([
    [
      "categories before entries, other languages and templates excluded",
      [
        `${root}/en_us/entries/z.json`,
        `${root}/en_us/categories/c.json`,
        `${root}/uk_ua/entries/y.json`,
        `${root}/en_us/templates/t.json`,
      ],
      { books: [{ root, id: "a:b", files: [`${root}/en_us/categories/c.json`, `${root}/en_us/entries/z.json`] }], unsupported: [] },
    ],
    [
      "a book with only data/ content is unsupported",
      ["data/a/patchouli_books/old/book.json", "data/a/patchouli_books/old/en_us/entries/x.json"],
      { books: [], unsupported: ["a:old"] },
    ],
    [
      "a book with data/book.json and assets content is supported",
      ["data/a/patchouli_books/b/book.json", `${root}/en_us/entries/x.json`],
      { books: [{ root, id: "a:b", files: [`${root}/en_us/entries/x.json`] }], unsupported: [] },
    ],
  ])("%s", (_name, paths, expected) => {
    expect(findPatchouliBooks(paths)).toEqual(expected);
  });
});

describe("bookRowLabel", () => {
  const key = (file, pointer) => `book:assets/a/patchouli_books/b/en_us/${file}#${pointer}`;
  it.each([
    ["an entry name", key("entries/x/y.json", "/name"), "entries/x/y · назва"],
    ["a page title (pages are 1-based)", key("entries/x/y.json", "/pages/0/title"), "entries/x/y · с. 1 · заголовок"],
    ["a category description", key("categories/c.json", "/description"), "categories/c · опис"],
  ])("labels %s", (_name, rowKey, label) => {
    expect(bookRowLabel(rowKey)).toBe(label);
  });

  it.each([
    ["a guide block (1-based)", "book:assets/ae2/ae2guide/items-blocks-machines/inscriber.md#7", "items-blocks-machines/inscriber · блок 8"],
    ["a guide navigation title", "book:assets/ae2/ae2guide/items-blocks-machines/inscriber.md#title", "items-blocks-machines/inscriber · заголовок у навігації"],
  ])("labels %s", (_name, rowKey, label) => {
    expect(bookRowLabel(rowKey)).toBe(label);
  });

  it("prefixes the book name when given", () => {
    expect(bookRowLabel(key("entries/x.json", "/name"), "Гід")).toBe("Гід · entries/x · назва");
  });
});

describe("rowInScope", () => {
  const bookRow = "book:assets/a/patchouli_books/guide/en_us/entries/x.json#/name";
  const siblingRow = "book:assets/a/patchouli_books/guide_extra/en_us/entries/x.json#/name";
  it.each([
    ["all", "item.apple", "all", true],
    ["lang", "item.apple", "lang", true],
    ["lang", bookRow, "lang", false],
    ["its own book", bookRow, "assets/a/patchouli_books/guide", true],
    ["a lang row in a book scope", "item.apple", "assets/a/patchouli_books/guide", false],
    ["a sibling book whose id starts the same", siblingRow, "assets/a/patchouli_books/guide", false],
  ])("%s", (_name, key, scope, expected) => {
    expect(rowInScope(key, scope)).toBe(expected);
  });
});
