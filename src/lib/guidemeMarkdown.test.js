import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";
import { extractGuideUnits, hasSameStructure, rewriteGuidePage } from "./guidemeMarkdown";

const PATH = "assets/ae2/ae2guide/items/inscriber.md";
const pairs = (text) => extractGuideUnits(PATH, text).map(({ kind, original }) => [kind, original]);

describe("extractGuideUnits", () => {
  it.each([
    [
      "frontmatter: only the navigation title",
      "---\nnavigation:\n  title: Inscriber\n  icon: ae2:inscriber\n  position: 10\nitem_ids:\n  - ae2:inscriber\n---\n",
      [["title", "Inscriber"]],
    ],
    ["heading without the marker", "# The Inscriber\n", [["heading", "The Inscriber"]]],
    [
      "soft break collapsed, tags kept",
      'The inscriber makes\n<ItemLink id="x" /> presses.\n',
      [["paragraph", 'The inscriber makes <ItemLink id="x" /> presses.']],
    ],
    ["JSX flow elements without text", '<GameScene zoom="4">\n<ImportStructure src="a.snbt" />\n</GameScene>\n', []],
    [
      "text directly inside a JSX flow element",
      '<div class="notification is-info">\n  Text here\n</div>\n',
      [["paragraph", "Text here"]],
    ],
    ["list item with indented continuation", "- First line\n  second line\n", [["paragraph", "First line second line"]]],
    [
      "one unit per table cell",
      "| Name | Use |\n|------|-----|\n| Press | Make parts |\n",
      [
        ["cell", "Name"],
        ["cell", "Use"],
        ["cell", "Press"],
        ["cell", "Make parts"],
      ],
    ],
    ["backslash hard break splits units", "First line\\\nSecond line\n", [["paragraph", "First line"], ["paragraph", "Second line"]]],
    [
      "a reference link stays inside its paragraph and its definition is not a unit",
      "See [the label][ref] now.\n\n[ref]: page.md\n",
      [["paragraph", "See [the label][ref] now."]],
    ],
    ["fenced code", "```\ncode here\n```\n", []],
    ["letterless units", "---\n\n12 34\n\n![alt](a.png)\n", []],
  ])("%s", (_, text, expected) => {
    expect(pairs(text)).toEqual(expected);
  });

  it("numbers body units in document order and keys the title apart", () => {
    const keys = extractGuideUnits(PATH, "---\nnavigation:\n  title: T\n---\n\n# A\n\nB\n").map(({ key }) => key);
    expect(keys).toEqual([`book:${PATH}#title`, `book:${PATH}#0`, `book:${PATH}#1`]);
  });
});

describe("rewriteGuidePage", () => {
  const PAGE = "---\r\nnavigation:\r\n  title: Inscriber\r\n  icon: ae2:inscriber\r\n---\r\n\r\n# Head\r\n\r\n| A | B |\r\n|---|---|\r\n| x | y |\r\n\r\nBody text.\r\n";
  const keyOf = (original) => extractGuideUnits(PATH, PAGE).find((unit) => unit.original === original).key;
  const rewrite = (text, entries) => rewriteGuidePage(PATH, text, new Map(entries));

  it("is byte-identical with nothing translated, CRLF included", () => {
    expect(rewrite(PAGE, [])).toBe(PAGE);
  });

  it("escapes a pipe in a table cell", () => {
    expect(rewrite(PAGE, [[keyOf("x"), "a | b"]])).toContain("| a \\| b | y |");
  });

  it("quotes a title that is not a safe plain scalar and keeps the rest of the frontmatter", () => {
    const out = rewrite(PAGE, [[keyOf("Inscriber"), "Інскрайбер: основи"]]);
    expect(out).toContain('title: "Інскрайбер: основи"');
    expect(out).toContain("icon: ae2:inscriber");
    expect(hasSameStructure(PAGE, out)).toBe(true);
    expect(pairs(out)[0]).toEqual(["title", "Інскрайбер: основи"]);
  });

  it.each([
    ["a number", "2024", '"2024"'],
    ["a date", "2024-01-31", '"2024-01-31"'],
    ["a YAML boolean", "Yes", '"Yes"'],
    ["plain text starting with a digit", "3 способи", "3 способи"],
  ])("writes %s as a title that stays a string", (_name, title, written) => {
    const out = rewrite(PAGE, [[keyOf("Inscriber"), title]]);
    expect(out).toContain(`title: ${written}\r\n`);
  });

  it("collapses newlines in a translation without changing the structure", () => {
    const out = rewrite(PAGE, [[keyOf("Body text."), "Перший.\n\nДругий."]]);
    expect(out).toContain("Перший. Другий.");
    expect(hasSameStructure(PAGE, out)).toBe(true);
  });

  it("detects a translation that turns a paragraph into a list", () => {
    const out = rewrite(PAGE, [[keyOf("Body text."), "- Список"]]);
    expect(hasSameStructure(PAGE, out)).toBe(false);
  });
});

describe("a page with a byte order mark", () => {
  const PAGE = "\uFEFF---\nnavigation:\n  title: Inscriber\n---\n\n# Head\n\nBody text.\n";

  it("extracts the same units and rewrites without shifting offsets", () => {
    expect(pairs(PAGE)).toEqual([["title", "Inscriber"], ["heading", "Head"], ["paragraph", "Body text."]]);
    expect(rewriteGuidePage(PATH, PAGE, new Map())).toBe(PAGE);
    const out = rewriteGuidePage(PATH, PAGE, new Map([[`book:${PATH}#0`, "Голова"], [`book:${PATH}#1`, "Текст."]]));
    expect(out).toBe("\uFEFF---\nnavigation:\n  title: Inscriber\n---\n\n# Голова\n\nТекст.\n");
    expect(hasSameStructure(PAGE, out)).toBe(true);
  });
});

describe.skipIf(!process.env.MOVNYK_GUIDE_CORPUS)("local GuideME corpus", () => {
  const pages = [];
  const collect = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (entry.name.endsWith(".md")) pages.push([path, readFileSync(path, "utf8")]);
    }
  };
  if (process.env.MOVNYK_GUIDE_CORPUS) collect(process.env.MOVNYK_GUIDE_CORPUS);

  it.each(pages)("%s survives extraction and rewriting", (path, text) => {
    const units = extractGuideUnits(path, text);
    expect(rewriteGuidePage(path, text, new Map())).toBe(text);
    const marked = rewriteGuidePage(path, text, new Map(units.map(({ key }, n) => [key, `Ü${n}`])));
    expect(hasSameStructure(text, marked)).toBe(true);
    expect(extractGuideUnits(path, marked).map(({ kind, original }) => [kind, original])).toEqual(
      units.map(({ kind }, n) => [kind, `Ü${n}`])
    );
  });
});
