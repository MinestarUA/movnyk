import { describe, expect, it } from "vitest";
import { mergeLangFile } from "./importing";

const rows = [
  { key: "a", original: "Apple", translated: "", confirmed: false },
  { key: "b", original: "Bread", translated: "старий", confirmed: false },
  { key: "c", original: "Cake", translated: "", confirmed: false },
];

describe("mergeLangFile", () => {
  it("applies matching keys, marks them confirmed, ignores unknown keys", () => {
    const { next, applied, skipped } = mergeLangFile(rows, { a: "Яблуко", zzz: "x" });
    expect(applied).toBe(1);
    expect(skipped).toBe(0);
    expect(next[0]).toEqual({ key: "a", original: "Apple", translated: "Яблуко", confirmed: true });
    expect(next[1].translated).toBe("старий");
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

  it("coerces non-string values and ignores null/undefined", () => {
    const { next, applied } = mergeLangFile(rows, { a: 5, b: null });
    expect(applied).toBe(1);
    expect(next[0].translated).toBe("5");
    expect(next[1].translated).toBe("старий");
  });
});
