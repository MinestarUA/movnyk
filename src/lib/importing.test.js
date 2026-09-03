import { describe, expect, it } from "vitest";
import { mergeLangFile, parseLangContent } from "./importing";

const rows = [
  { key: "a", original: "Apple", translated: "", confirmed: false },
  { key: "b", original: "Bread", translated: "старий", confirmed: false },
  { key: "c", original: "Cake", translated: "Торт", confirmed: true },
];

describe("mergeLangFile", () => {
  it("applies matching keys, marks them confirmed, ignores unknown keys", () => {
    const { next, applied, skipped } = mergeLangFile(rows, { a: "Яблуко", zzz: "x" });
    expect(applied).toBe(1);
    expect(skipped).toBe(0);
    expect(next[0]).toEqual({ key: "a", original: "Apple", translated: "Яблуко", confirmed: true });
    expect(next[1].translated).toBe("старий");
  });

  it("skips already approved (confirmed) translations when skipApproved is true", () => {
    const { next, applied, skipped } = mergeLangFile(
      rows,
      { a: "Яблуко", c: "Новий торт" },
      { skipApproved: true }
    );
    expect(applied).toBe(1);
    expect(skipped).toBe(1);
    expect(next[0].translated).toBe("Яблуко");
    expect(next[2].translated).toBe("Торт");
    expect(next[2].confirmed).toBe(true);
  });

  it("overwrites approved translations when skipApproved is false", () => {
    const { next, applied, skipped } = mergeLangFile(
      rows,
      { c: "Новий торт" },
      { skipApproved: false }
    );
    expect(applied).toBe(1);
    expect(skipped).toBe(0);
    expect(next[2].translated).toBe("Новий торт");
  });

  it("skips values identical to the original when skipIdentical is on (default)", () => {
    const { next, applied, skipped } = mergeLangFile(rows, { a: "Apple", b: "Хліб" });
    expect(applied).toBe(1);
    expect(skipped).toBe(1);
    expect(next[0].translated).toBe("");
    expect(next[0].confirmed).toBe(false);
    expect(next[1]).toMatchObject({ translated: "Хліб", confirmed: true });
  });

  it("applies identical values when skipIdentical is off", () => {
    const { applied, skipped, next } = mergeLangFile(rows, { a: "Apple" }, { skipIdentical: false });
    expect(applied).toBe(1);
    expect(skipped).toBe(0);
    expect(next[0]).toMatchObject({ translated: "Apple", confirmed: true });
  });

  it("leaves imported rows unconfirmed when confirmImported is off", () => {
    const { next, applied } = mergeLangFile(rows, { a: "Яблуко" }, { confirmImported: false });
    expect(applied).toBe(1);
    expect(next[0]).toMatchObject({ translated: "Яблуко", confirmed: false });
  });

  it("coerces non-string values and ignores null/undefined", () => {
    const { next, applied } = mergeLangFile(rows, { a: 5, b: null });
    expect(applied).toBe(1);
    expect(next[0].translated).toBe("5");
    expect(next[1].translated).toBe("старий");
  });
});

describe("parseLangContent", () => {
  it("parses valid JSON string", () => {
    const result = parseLangContent('{"item.apple": "Яблуко"}');
    expect(result).toEqual({ "item.apple": "Яблуко" });
  });

  it("parses Minecraft .lang format (key=value)", () => {
    const langText = `
# Comment line
item.apple=Яблуко
item.bread=Хліб

item.cake=Торт=з кремом
`;
    const result = parseLangContent(langText);
    expect(result).toEqual({
      "item.apple": "Яблуко",
      "item.bread": "Хліб",
      "item.cake": "Торт=з кремом",
    });
  });

  it("strips separator padding in .lang format but keeps trailing spaces", () => {
    const langText = `
item.apple = Яблуко 
item.bread =   Хліб
gui.prefix=Рівень: 
`;
    const result = parseLangContent(langText);
    expect(result).toEqual({
      "item.apple": "Яблуко ",
      "item.bread": "Хліб",
      "gui.prefix": "Рівень: ",
    });
  });

  it("throws on invalid content", () => {
    expect(() => parseLangContent("")).toThrow();
    expect(() => parseLangContent("invalid text without equals")).toThrow();
  });
});
