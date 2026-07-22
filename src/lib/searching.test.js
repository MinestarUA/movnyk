import { describe, expect, it } from "vitest";
import {
  compileQuery,
  itemMatches,
  translationMatches,
  replaceInTranslation,
} from "./searching";

const item = { key: "block.mod.copper_door", original: "Copper Door", translated: "Мідні двері" };

describe("compileQuery", () => {
  it("returns null re for empty query", () => {
    expect(compileQuery("")).toEqual({ re: null, error: null });
    expect(compileQuery("   ")).toEqual({ re: null, error: null });
  });

  it("compiles a literal query case-insensitively and escapes metacharacters", () => {
    const { re, error } = compileQuery("copper (door");
    expect(error).toBeNull();
    expect(re.test("COPPER (DOOR")).toBe(true);
    expect(re.test("copper door")).toBe(false);
  });

  it("compiles a regex query when regex mode is on", () => {
    const { re, error } = compileQuery("copper.*door", { regex: true });
    expect(error).toBeNull();
    expect(re.test("Copper Iron Door")).toBe(true);
  });

  it("reports invalid regex without throwing", () => {
    const { re, error } = compileQuery("([", { regex: true });
    expect(re).toBeNull();
    expect(typeof error).toBe("string");
  });
});

describe("itemMatches", () => {
  it("matches on key, original, and translated", () => {
    expect(itemMatches(item, compileQuery("copper_door").re)).toBe(true);
    expect(itemMatches(item, compileQuery("Copper Door").re)).toBe(true);
    expect(itemMatches(item, compileQuery("мідні").re)).toBe(true);
    expect(itemMatches(item, compileQuery("nope").re)).toBe(false);
  });

  it("coerces non-string originals", () => {
    const numeric = { key: "a", original: 42, translated: "" };
    expect(itemMatches(numeric, compileQuery("42").re)).toBe(true);
  });
});

describe("translationMatches", () => {
  it("matches only the translated text", () => {
    expect(translationMatches(item, compileQuery("мідні").re)).toBe(true);
    expect(translationMatches(item, compileQuery("copper").re)).toBe(false);
  });
});

describe("replaceInTranslation", () => {
  it("replaces all literal occurrences case-insensitively", () => {
    expect(replaceInTranslation("Мідь і мідь", "мідь", "залізо")).toBe("залізо і залізо");
  });

  it("treats replacement as literal text in literal mode ($ is not special)", () => {
    expect(replaceInTranslation("ціна", "ціна", "$100")).toBe("$100");
  });

  it("supports $1 backreferences in regex mode", () => {
    expect(
      replaceInTranslation("Item: Sword", "Item: (\\w+)", "$1!", { regex: true })
    ).toBe("Sword!");
  });

  it("returns text unchanged for empty or invalid patterns", () => {
    expect(replaceInTranslation("text", "", "x")).toBe("text");
    expect(replaceInTranslation("text", "([", "x", { regex: true })).toBe("text");
  });
});
