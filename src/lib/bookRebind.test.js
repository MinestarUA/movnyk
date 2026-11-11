import { describe, expect, it } from "vitest";
import { rebindBookRows } from "./bookRebind";

const OLD_PATH = "assets/a/ae2guide/x.md";
const TEXTS = ["alpha", "beta", "gamma", "delta"];
const keyOf = (path, n) => `book:${path}#${n}`;
const savedRows = (path, texts) =>
  texts.map((text, n) => ({ key: keyOf(path, n), original: text, translated: `T ${text}`, confirmed: true }));
const unitsOf = (path, texts) => texts.map((original, n) => ({ key: keyOf(path, n), original }));

describe("rebindBookRows", () => {
  const T = TEXTS.map((text) => `T ${text}`);
  it.each([
    ["nothing changed", OLD_PATH, TEXTS, T, [true, true, true, true], { unchanged: 4, changed: 0, renamed: 0, added: 0, removed: 0 }],
    [
      "a page inserted at the start",
      OLD_PATH,
      ["new", ...TEXTS],
      ["", ...T],
      [false, true, true, true, true],
      { unchanged: 4, changed: 0, renamed: 0, added: 1, removed: 0 },
    ],
    [
      "one text edited",
      OLD_PATH,
      ["alpha", "beta 2", "gamma", "delta"],
      T,
      [true, false, true, true],
      { unchanged: 3, changed: 1, renamed: 0, added: 0, removed: 0 },
    ],
    [
      "one deleted and two inserted in the same gap",
      OLD_PATH,
      ["alpha", "x", "y", "gamma", "delta"],
      ["T alpha", "", "", "T gamma", "T delta"],
      [true, false, false, true, true],
      { unchanged: 3, changed: 0, renamed: 0, added: 2, removed: 1 },
    ],
    [
      "a renamed file with unique texts",
      "assets/a/ae2guide/y.md",
      TEXTS,
      T,
      [true, true, true, true],
      { unchanged: 0, changed: 0, renamed: 4, added: 0, removed: 0 },
    ],
  ])("%s", (_name, path, texts, translated, confirmed, stats) => {
    const { next, removed, stats: actual } = rebindBookRows(savedRows(OLD_PATH, TEXTS), unitsOf(path, texts));
    expect(next.map(({ key, original, translated, confirmed }) => ({ key, original, translated, confirmed }))).toEqual(
      unitsOf(path, texts).map(({ key, original }, n) => ({ key, original, translated: translated[n], confirmed: confirmed[n] }))
    );
    expect(actual).toEqual(stats);
    expect(removed).toHaveLength(stats.removed);
  });
});
