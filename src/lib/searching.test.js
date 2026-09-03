import { describe, expect, it } from "vitest";
import {
  compileQuery,
  isFindShortcut,
  itemMatches,
  translationMatches,
  replaceInTranslation,
} from "./searching";

const item = { key: "block.mod.copper_door", original: "Copper Door", translated: "Мідні двері" };

describe("compileQuery", () => {
  it("returns null re for empty query", () => {
    expect(compileQuery("")).toEqual({ re: null, error: null });
    expect(compileQuery(null)).toEqual({ re: null, error: null });
  });

  it("preserves whitespace by default", () => {
    const { re } = compileQuery("   ");
    expect(re).not.toBeNull();
    expect(re.test("a   b")).toBe(true);
    expect(re.test("a b")).toBe(false);

    const spaceQuery = compileQuery(" ");
    expect(spaceQuery.re.test("hello world")).toBe(true);
    expect(spaceQuery.re.test("helloworld")).toBe(false);
  });

  it("compiles a literal query case-insensitively by default and escapes metacharacters", () => {
    const { re, error } = compileQuery("copper (door");
    expect(error).toBeNull();
    expect(re.test("COPPER (DOOR")).toBe(true);
    expect(re.test("copper door")).toBe(false);
  });

  it("supports case-sensitive search", () => {
    const { re: insensitive } = compileQuery("Мідь", { caseSensitive: false });
    expect(insensitive.test("мідь")).toBe(true);
    expect(insensitive.test("Мідь")).toBe(true);

    const { re: sensitive } = compileQuery("Мідь", { caseSensitive: true });
    expect(sensitive.test("мідь")).toBe(false);
    expect(sensitive.test("Мідь")).toBe(true);
  });

  it("supports whole-word search for Ukrainian and English", () => {
    const { re: ua } = compileQuery("слово", { wholeWord: true });
    expect(ua.test("це слово тут")).toBe(true);
    expect(ua.test("слово")).toBe(true);
    expect(ua.test("це словодрук тут")).toBe(false);
    expect(ua.test("переслово")).toBe(false);

    const { re: en } = compileQuery("door", { wholeWord: true });
    expect(en.test("iron door open")).toBe(true);
    expect(en.test("trapdoor")).toBe(false);
    expect(en.test("doors")).toBe(false);
  });

  it("compiles a regex query when regex mode is on without enforcing strict u flag unless wholeWord", () => {
    const { re, error } = compileQuery("copper.*door", { regex: true });
    expect(error).toBeNull();
    expect(re.test("Copper Iron Door")).toBe(true);

    // Queries that would fail under strict Unicode mode compile without error
    const braceQuery = compileQuery("a{", { regex: true });
    expect(braceQuery.error).toBeNull();
    expect(braceQuery.re.test("a{")).toBe(true);

    const escapeQuery = compileQuery("\\-", { regex: true });
    expect(escapeQuery.error).toBeNull();
    expect(escapeQuery.re.test("-")).toBe(true);
  });

  it("supports whole-word search in regex mode", () => {
    const { re: digitRe } = compileQuery("\\d+", { regex: true, wholeWord: true });
    expect(digitRe.test("abc 123 def")).toBe(true);
    expect(digitRe.test("abc123def")).toBe(false);

    const { re: doorRe } = compileQuery("[Dd]oor", { regex: true, wholeWord: true });
    expect(doorRe.test("iron Door")).toBe(true);
    expect(doorRe.test("trapdoor")).toBe(false);
    expect(doorRe.test("doors")).toBe(false);
  });

  it("keeps legacy regexes compiling when whole-word is toggled on", () => {
    // \p{...} boundaries need the u flag, which would reject these patterns;
    // they must fall back to ASCII boundaries instead of erroring.
    const braceQuery = compileQuery("a{", { regex: true, wholeWord: true });
    expect(braceQuery.error).toBeNull();
    expect(braceQuery.re.test("a{")).toBe(true);

    const escapeQuery = compileQuery("\\-", { regex: true, wholeWord: true });
    expect(escapeQuery.error).toBeNull();
    expect(escapeQuery.re.test("-")).toBe(true);
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
  it("replaces all literal occurrences case-insensitively by default", () => {
    expect(replaceInTranslation("Мідь і мідь", "мідь", "залізо")).toBe("залізо і залізо");
  });

  it("supports case-sensitive replacement", () => {
    expect(replaceInTranslation("Мідь і мідь", "мідь", "залізо", { caseSensitive: true })).toBe("Мідь і залізо");
  });

  it("supports whole-word replacement", () => {
    expect(replaceInTranslation("слово і словодрук", "слово", "текст", { wholeWord: true })).toBe("текст і словодрук");
  });

  it("supports preserve-case replacement (upper, lower, title)", () => {
    expect(
      replaceInTranslation("ЯБЛУКО яблуко Яблуко", "яблуко", "груша", { preserveCase: true })
    ).toBe("ГРУША груша Груша");

    expect(
      replaceInTranslation("APPLE apple Apple", "apple", "orange", { preserveCase: true })
    ).toBe("ORANGE orange Orange");
  });

  it("keeps capitals typed into a multi-word replacement for a title-cased match", () => {
    expect(
      replaceInTranslation("The Sword", "sword", "Iron Blade", { preserveCase: true })
    ).toBe("The Iron Blade");

    expect(
      replaceInTranslation("Sword of fire", "sword", "Меч Короля", { preserveCase: true })
    ).toBe("Меч Короля of fire");

    // An all-lowercase replacement still picks up the match's title casing
    expect(
      replaceInTranslation("Sword", "sword", "iron blade", { preserveCase: true })
    ).toBe("Iron blade");
  });

  it("keeps capitals typed into the replacement for a lower-cased match", () => {
    expect(
      replaceInTranslation("the sword", "sword", "Меч Короля", { preserveCase: true })
    ).toBe("the Меч Короля");

    // A caseless replacement still follows the match down to lower case
    expect(
      replaceInTranslation("APPLE apple", "apple", "груша", { preserveCase: true })
    ).toBe("ГРУША груша");
  });

  it("preserves whitespace in search and replacement", () => {
    expect(replaceInTranslation("foo bar baz", "foo ", "new ")).toBe("new bar baz");
  });

  it("treats replacement as literal text in literal mode ($ is not special)", () => {
    expect(replaceInTranslation("ціна", "ціна", "$100")).toBe("$100");
  });

  it("supports $1 backreferences in regex mode", () => {
    expect(
      replaceInTranslation("Item: Sword", "Item: (\\w+)", "$1!", { regex: true })
    ).toBe("Sword!");
  });

  it("handles backreferences and special replacement tokens accurately with preserveCase", () => {
    // $n bounds with named groups
    expect(
      replaceInTranslation("abc", "(?<x>a)", "[$2]", { regex: true, preserveCase: true })
    ).toBe("[$2]bc");

    // $` (preceding string) in regex mode matches native replace
    expect(
      replaceInTranslation("abc", "b", "[$`]", { regex: true, preserveCase: true })
    ).toBe("a[a]c");
    expect(
      replaceInTranslation("abc", "b", "[$`]", { regex: true, preserveCase: false })
    ).toBe("a[a]c");

    // $' (following string) in regex mode matches native replace
    expect(
      replaceInTranslation("abc", "b", "[$']", { regex: true, preserveCase: true })
    ).toBe("a[c]c");
    expect(
      replaceInTranslation("abc", "b", "[$']", { regex: true, preserveCase: false })
    ).toBe("a[c]c");

    // Multi-digit tokens shrink to a real group like the engine does, so the
    // "AB" toggle cannot change the output
    expect(
      replaceInTranslation("abc", "(a)", "[$12]", { regex: true, preserveCase: true })
    ).toBe("[a2]bc");
    expect(
      replaceInTranslation("abc", "(a)", "[$12]", { regex: true, preserveCase: false })
    ).toBe("[a2]bc");

    // Named groups $<name>
    expect(
      replaceInTranslation("abc", "(?<part>b)", "[$<part>]", { regex: true, preserveCase: true })
    ).toBe("a[b]c");
  });

  it("returns text unchanged for empty or invalid patterns", () => {
    expect(replaceInTranslation("text", "", "x")).toBe("text");
    expect(replaceInTranslation("text", null, "x")).toBe("text");
    expect(replaceInTranslation("text", "([", "x", { regex: true })).toBe("text");
  });
});

describe("isFindShortcut", () => {
  const ev = (props) => ({ ctrlKey: false, metaKey: false, key: "", code: "", ...props });

  it("matches Ctrl+F and Cmd+F on a Latin layout", () => {
    expect(isFindShortcut(ev({ ctrlKey: true, key: "f", code: "KeyF" }))).toBe(true);
    expect(isFindShortcut(ev({ metaKey: true, key: "F", code: "KeyF" }))).toBe(true);
  });

  it("matches on a non-Latin layout via the physical key position", () => {
    // Ukrainian layout: the physical F key produces "а"
    expect(isFindShortcut(ev({ ctrlKey: true, key: "а", code: "KeyF" }))).toBe(true);
  });

  it("matches on non-QWERTY Latin layouts via e.key", () => {
    // Dvorak: the letter F lives on the physical KeyY position
    expect(isFindShortcut(ev({ ctrlKey: true, key: "f", code: "KeyY" }))).toBe(true);
  });

  it("rejects other keys and bare F without a modifier", () => {
    expect(isFindShortcut(ev({ ctrlKey: true, key: "g", code: "KeyG" }))).toBe(false);
    expect(isFindShortcut(ev({ key: "f", code: "KeyF" }))).toBe(false);
  });
});
