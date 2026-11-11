import { describe, expect, it } from "vitest";
import { applyPatchouliTranslations, extractPatchouliUnits } from "./patchouli";

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
