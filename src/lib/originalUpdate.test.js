import { describe, expect, it } from "vitest";
import { applyNewOriginal } from "./originalUpdate";

const row = (key, original, translated = "", confirmed = false) => ({
  key,
  original,
  translated,
  confirmed,
});

describe("applyNewOriginal", () => {
  it("keeps rows whose original is unchanged, approval included", () => {
    const rows = [row("a", "Apple", "Яблуко", true)];
    const { next, removed, stats } = applyNewOriginal(rows, { a: "Apple" });
    expect(next).toEqual(rows);
    expect(removed).toEqual([]);
    expect(stats.unchanged).toBe(1);
  });

  it("keeps the translation but drops approval when the original text changed", () => {
    const rows = [row("a", "Apple", "Яблуко", true)];
    const { next, stats } = applyNewOriginal(rows, { a: "Green apple" });
    expect(next).toEqual([row("a", "Green apple", "Яблуко", false)]);
    expect(stats.changed).toBe(1);
  });

  it("carries translation and approval over to a uniquely renamed key", () => {
    const rows = [row("old.key", "Apple", "Яблуко", true), row("b", "Bread", "Хліб", true)];
    const { next, removed, stats } = applyNewOriginal(rows, {
      "new.key": "Apple",
      b: "Bread",
    });
    expect(next).toEqual([row("new.key", "Apple", "Яблуко", true), row("b", "Bread", "Хліб", true)]);
    expect(removed).toEqual([]);
    expect(stats.renamed).toBe(1);
  });

  it("does not guess a rename when several rows share the same original", () => {
    const rows = [row("x1", "Stone", "Камінь", true), row("x2", "Stone", "Камінь", true)];
    const { next, removed, stats } = applyNewOriginal(rows, { y1: "Stone", y2: "Stone" });
    expect(next).toEqual([row("y1", "Stone"), row("y2", "Stone")]);
    expect(removed.map((r) => r.key)).toEqual(["x1", "x2"]);
    expect(stats.renamed).toBe(0);
    expect(stats.added).toBe(2);
  });

  it("adds new keys as empty unapproved rows", () => {
    const { next, stats } = applyNewOriginal([row("a", "Apple")], { a: "Apple", c: "Cake" });
    expect(next[1]).toEqual(row("c", "Cake"));
    expect(stats.added).toBe(1);
  });

  it("removes deleted rows from the result and flags them for the reference panel", () => {
    const rows = [row("a", "Apple", "Яблуко", true), row("gone", "Old", "Старе", true)];
    const { next, removed, stats } = applyNewOriginal(rows, { a: "Apple" });
    expect(next.map((r) => r.key)).toEqual(["a"]);
    expect(removed).toEqual([{ ...row("gone", "Old", "Старе", true), removed: true }]);
    expect(stats.removed).toBe(1);
  });

  it("orders rows in the order of the new original", () => {
    const rows = [row("a", "A"), row("b", "B")];
    const { next } = applyNewOriginal(rows, { b: "B", a: "A" });
    expect(next.map((r) => r.key)).toEqual(["b", "a"]);
  });
});
