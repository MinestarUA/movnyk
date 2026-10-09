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

  const ids = (original, translated) => checkTranslationQA(original, translated).map((i) => i.id);
  const applyFix = (original, translated, id) =>
    checkTranslationQA(original, translated)
      .find((i) => i.id === id)
      .fix(translated);

  it("does not flag tokens glued to Cyrillic words as mixed scripts", () => {
    expect(ids("%s blocks", "%sблоків")).toEqual([]);
    expect(ids("§aGreen text", "§aЗелений текст")).toEqual([]);
    expect(ids("Level %1$sup", "Рівень %1$sвгору")).toEqual([]);
  });

  it("ignores letters inside tokens when checking capitalization", () => {
    expect(ids("§aHello", "§aПривіт")).toEqual([]);
    expect(ids("%s items", "%s предметів")).toEqual([]);
    expect(applyFix("§aHello", "§aпривіт", "capitalization-should-be-upper")).toBe("§aПривіт");
  });

  it("detects and fixes inner double spaces only", () => {
    expect(ids("A b", "А  б")).toContain("double-space");
    expect(ids("A  b", "А  б")).not.toContain("double-space");
    expect(applyFix(" A b c", " А  б   в", "double-space")).toBe(" А б в");
  });

  it("fixes trailing punctuation before trailing whitespace", () => {
    expect(applyFix("Done.\n", "Готово\n", "missing-trailing-punct")).toBe("Готово.\n");
    expect(applyFix("Done", "Готово!", "extra-trailing-punct")).toBe("Готово");
    expect(applyFix("Warning:", "Увага!", "mismatched-trailing-punct")).toBe("Увага:");
  });

  it("fixes leading and trailing whitespace", () => {
    expect(applyFix("  lead", "лід", "missing-leading-ws")).toBe("  лід");
    expect(applyFix("trail", "слід \n", "extra-trailing-ws")).toBe("слід");
  });

  it("suggests the ellipsis character instead of three dots", () => {
    expect(ids("Loading...", "Завантаження...")).toEqual(["three-dots"]);
    expect(applyFix("Loading...", "Зачекайте... завантаження...", "three-dots")).toBe(
      "Зачекайте… завантаження…"
    );
    expect(ids("Loading…", "Завантаження…")).toEqual([]);
  });

  it("detects special characters missing from the translation", () => {
    expect(ids("Speed → fast", "Швидкість швидко")).toContain("missing-special-char-→");
    expect(ids("Speed → fast", "Швидкість → швидко")).toEqual([]);
    expect(ids("Wait…", "Зачекайте...")).not.toContain("missing-special-char-…");
    expect(ids("“Quote” don’t", "«Цитата» не")).toEqual([]);
    expect(ids("A – b", "А — б")).toEqual([]);
  });

  it("reads trailing punctuation past trailing tokens", () => {
    expect(ids("Done.§r", "Готово.§r")).toEqual([]);
    expect(ids("Got %s!", "Отримано %s!")).toEqual([]);
    expect(applyFix("Done.§r", "Готово§r", "missing-trailing-punct")).toBe("Готово.§r");
  });

  it("leaves longer dot runs alone", () => {
    expect(ids("Hmm....", "Хмм....")).not.toContain("three-dots");
  });
});

