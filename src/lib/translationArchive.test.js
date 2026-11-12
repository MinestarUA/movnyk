import { describe, expect, it } from "vitest";
import { collectTranslationFiles, translationsFromArchive } from "./translationArchive";

describe("collectTranslationFiles", () => {
  it.each([
    ["a lang file", "assets/ae2/lang/uk_ua.json", true],
    ["a Patchouli entry", "assets/ae2/patchouli_books/guide/uk_ua/entries/a/b.json", true],
    ["a Patchouli category", "assets/ae2/patchouli_books/guide/uk_ua/categories/c.json", true],
    ["a GuideME page", "assets/ae2/ae2guide/_uk_ua/items/inscriber.md", true],
    ["the English lang file", "assets/ae2/lang/en_us.json", false],
    ["another language's lang file", "assets/ae2/lang/zh_cn.json", false],
    ["another language's page", "assets/ae2/ae2guide/_de_de/index.md", false],
    ["Patchouli templates", "assets/ae2/patchouli_books/guide/uk_ua/templates/t.json", false],
    ["a source page", "assets/ae2/ae2guide/index.md", false],
  ])("%s: %s", (_name, path, picked) => {
    expect(collectTranslationFiles([path], "uk_ua")).toEqual(picked ? [path] : []);
  });
});

describe("translationsFromArchive", () => {
  const entry = "assets/a/patchouli_books/g/en_us/entries/e.json";
  const page = "assets/a/guide/index.md";
  const row = (key) => ({ key, original: "x", translated: "", confirmed: false });
  const run = (files, rows) => translationsFromArchive({ files, language: "uk_ua", rows: rows.map(row) });

  it("reads Patchouli values at the pointers of the en_us rows", async () => {
    const translated = JSON.stringify({ name: "Назва", pages: [{ text: "Текст" }] });
    const result = await run({ "assets/a/patchouli_books/g/uk_ua/entries/e.json": translated }, [
      `book:${entry}#/name`,
      `book:${entry}#/pages/0/text`,
      `book:${entry}#/pages/0/title`,
    ]);
    expect(result.values).toEqual({ [`book:${entry}#/name`]: "Назва", [`book:${entry}#/pages/0/text`]: "Текст" });
  });

  it("skips and counts a guide page whose unit count differs from the rows", async () => {
    const files = { "assets/a/guide/_uk_ua/index.md": "Перший.\n\nДругий.\n" };
    const matching = await run(files, [`book:${page}#0`, `book:${page}#1`]);
    expect(matching).toEqual({ values: { [`book:${page}#0`]: "Перший.", [`book:${page}#1`]: "Другий." }, skippedPageCount: 0 });
    const mismatching = await run(files, [`book:${page}#0`, `book:${page}#1`, `book:${page}#2`]);
    expect(mismatching).toEqual({ values: {}, skippedPageCount: 1 });
  });

  it("skips a guide page whose unit kinds differ from the source page's", async () => {
    // Same unit count, but the translation turned the second paragraph into a heading.
    const files = { "assets/a/guide/_uk_ua/index.md": "Перший.\n\n# Другий\n" };
    const rows = [`book:${page}#0`, `book:${page}#1`];
    const sources = { [page]: "First.\n\nSecond.\n" };
    expect(await translationsFromArchive({ files, language: "uk_ua", rows: rows.map(row), sources })).toEqual({
      values: {},
      skippedPageCount: 1,
    });
  });
});
