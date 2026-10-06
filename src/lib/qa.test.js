import { describe, expect, it } from "vitest";
import { checkTranslationQA } from "./qa";

describe("qa linter", () => {
  it("returns no issues for clean matching translations", () => {
    const issues = checkTranslationQA("Hello world.", "Привіт світ.");
    expect(issues).toEqual([]);
  });

  it("detects missing trailing punctuation", () => {
    const issues = checkTranslationQA("Hello world.", "Привіт світ");
    expect(issues.some((i) => i.id === "missing-trailing-punct")).toBe(true);
  });

  it("detects extra trailing punctuation", () => {
    const issues = checkTranslationQA("Hello world", "Привіт світ.");
    expect(issues.some((i) => i.id === "extra-trailing-punct")).toBe(true);
  });

  it("detects mismatched trailing punctuation", () => {
    const issues = checkTranslationQA("Warning:", "Попередження!");
    expect(issues.some((i) => i.id === "mismatched-trailing-punct")).toBe(true);
  });

  it("detects leading and trailing whitespace mismatches", () => {
    const issues1 = checkTranslationQA("  leading", "leading");
    expect(issues1.some((i) => i.id === "missing-leading-ws")).toBe(true);

    const issues2 = checkTranslationQA("trailing\n", "trailing");
    expect(issues2.some((i) => i.id === "missing-trailing-ws")).toBe(true);
  });

  it("detects capitalization mismatches", () => {
    const issues = checkTranslationQA("Start", "початок");
    expect(issues.some((i) => i.id === "capitalization-should-be-upper")).toBe(true);

    const issues2 = checkTranslationQA("start", "Початок");
    expect(issues2.some((i) => i.id === "capitalization-should-be-lower")).toBe(true);
  });

  it("detects missing formatting tokens and variables", () => {
    const issues = checkTranslationQA("Give %s §a%d items", "Дати предмети");
    expect(issues.some((i) => i.token === "%s")).toBe(true);
    expect(issues.some((i) => i.token === "§a")).toBe(true);
    expect(issues.some((i) => i.token === "%d")).toBe(true);
  });

  it("detects mixed Latin and Cyrillic script typos", () => {
    // 'p' and 'e' in 'рeдстоун' are latin characters
    const mixedWord = "р\u0065дстоун";
    const issues = checkTranslationQA("Redstone", mixedWord);
    expect(issues.some((i) => i.id.startsWith("mixed-scripts"))).toBe(true);
  });
});
