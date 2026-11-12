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

  it("returns the saved rows themselves when nothing changed", () => {
    const saved = savedRows(OLD_PATH, TEXTS).map((row) => ({ ...row, unsynced: true }));
    expect(rebindBookRows(saved, unitsOf(OLD_PATH, TEXTS)).next).toEqual(saved);
  });

  it("counts a changed text as added when its old row had no translation", () => {
    const saved = savedRows(OLD_PATH, TEXTS);
    saved[1].translated = "";
    const { next, stats } = rebindBookRows(saved, unitsOf(OLD_PATH, ["alpha", "beta 2", "gamma", "delta"]));
    expect(next[1]).toMatchObject({ original: "beta 2", translated: "", confirmed: false });
    expect(stats).toMatchObject({ added: 1, changed: 0, removed: 0 });
  });

  it("resolves a text moved within its file as renamed", () => {
    const { next, removed, stats } = rebindBookRows(
      savedRows(OLD_PATH, TEXTS),
      unitsOf(OLD_PATH, ["beta", "gamma", "delta", "alpha"])
    );
    expect(next.map((row) => row.translated)).toEqual(["T beta", "T gamma", "T delta", "T alpha"]);
    expect(removed).toEqual([]);
    expect(stats).toEqual({ unchanged: 3, changed: 0, renamed: 1, added: 0, removed: 0 });
  });
});
