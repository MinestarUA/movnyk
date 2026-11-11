import { describe, expect, it } from "vitest";
import {
  buildResourcePackFiles,
  guessNamespace,
  inferMinecraftVersion,
  packMcmeta,
  validatePack,
  versionRowFor,
} from "./resourcePack";

describe("versionRowFor", () => {
  it.each([
    ["1.20", 15],
    ["1.21.10", 69],
    ["26.1.2", 84],
    ["1.12.2", null],
  ])("%s -> format %s", (version, format) => {
    expect(versionRowFor(version)?.format ?? null).toBe(format);
  });
});

describe("packMcmeta", () => {
  it.each([
    ["before 1.21.9: only pack_format", 34, { pack_format: 34, description: "d" }],
    ["the last pack_format-only format", 64, { pack_format: 64, description: "d" }],
    ["the first min/max_format format", 65, { description: "d", min_format: 65, max_format: 65 }],
    ["from 1.21.9: min/max_format", 69, { description: "d", min_format: 69, max_format: 69 }],
    [
      "a format with a minor part: [major, minor] arrays",
      [97, 1],
      { description: "d", min_format: [97, 1], max_format: [97, 1] },
    ],
  ])("%s", (_name, format, pack) => {
    expect(packMcmeta(format, "d").pack).toEqual(pack);
  });
});

describe("inferMinecraftVersion", () => {
  const neoforgeToml = `
[[dependencies.mymod]]
modId = "neoforge"
versionRange = "[21.1.1,)"

[[dependencies.mymod]]
modId = "minecraft"
versionRange = "[1.21.1,1.21.2)"
`;
  const fabric = (minecraft) => JSON.stringify({ depends: { minecraft } });

  it.each([
    ["neoforge block before the minecraft block", { modsToml: neoforgeToml }, "1.21.1"],
    ["fabric tilde range", { fabricModJson: fabric("~1.20.1") }, "1.20.1"],
    ["fabric array range", { fabricModJson: fabric([">=1.21"]) }, "1.21.1"],
    ["fabric wildcard", { fabricModJson: fabric("1.21.x") }, "1.21.1"],
    ["a Forge range with no lower bound", { modsToml: '[[dependencies.m]]\nmodId="minecraft"\nversionRange="[,1.20.2)"\n' }, null],
    ["a fabric range with no lower bound", { fabricModJson: fabric("<1.21") }, null],
    ["no metadata", {}, null],
  ])("%s", (_name, input, expected) => {
    expect(inferMinecraftVersion(input)).toBe(expected);
  });
});

describe("guessNamespace", () => {
  it.each([
    ["the jar lang path", "x.jar · assets/foo/lang/en_us.json", ["item.ae2.a"], "foo"],
    [
      "the most common key namespace",
      "en_us.json",
      ["item.ae2.a", "block.ae2.b", "itemGroup.minecraft"],
      "ae2",
    ],
    ["minecraft for dotless keys", "en_us.json", ["apple", "sword"], "minecraft"],
    [
      "minecraft when only book keys have dots",
      "x.jar",
      ["book:assets/a/patchouli_books/b/en_us/entries/x.json#/name"],
      "minecraft",
    ],
  ])("uses %s", (_name, source, keys, expected) => {
    expect(guessNamespace(source, keys)).toBe(expected);
  });
});

describe("buildResourcePackFiles", () => {
  it("writes only translated keys to the target language path, never en_us", () => {
    const translations = [
      { key: "item.ae2.a", original: "A", translated: "А" },
      { key: "item.ae2.b", original: "B", translated: "" },
    ];
    const pack = { namespace: "ae2", mcVersion: "1.20.1", language: "uk_ua" };
    const { files } = buildResourcePackFiles({ translations, pack, description: "d" });
    expect(Object.keys(files).sort()).toEqual(["assets/ae2/lang/uk_ua.json", "pack.mcmeta"]);
    expect(JSON.parse(files["assets/ae2/lang/uk_ua.json"])).toEqual({ "item.ae2.a": "А" });
    expect(JSON.parse(files["pack.mcmeta"]).pack.pack_format).toBe(15);
  });
});

describe("validatePack", () => {
  it.each([
    ["a valid pack", { namespace: "ae2", language: "uk_ua" }, []],
    ["en_us, which would overwrite the English original", { namespace: "ae2", language: "en_us" }, ["language"]],
    ["a malformed language code", { namespace: "ae2", language: "ukua" }, ["language"]],
    ["a namespace with uppercase or spaces", { namespace: "My Mod", language: "uk_ua" }, ["namespace"]],
  ])("%s", (_name, pack, invalidFields) => {
    expect(Object.keys(validatePack(pack))).toEqual(invalidFields);
  });
});

describe("buildResourcePackFiles with books", () => {
  const entryPath = "assets/a/patchouli_books/b/en_us/entries/x.json";
  const otherPath = "assets/a/patchouli_books/b/en_us/entries/y.json";
  const pack = { namespace: "a", mcVersion: "1.20.1", language: "uk_ua" };
  const bookRow = (path, pointer, translated) => ({
    key: `book:${path}#${pointer}`,
    original: "x",
    translated,
  });
  const sources = {
    [entryPath]: JSON.stringify({ name: "E", pages: [{ type: "patchouli:text", text: "One" }, { type: "patchouli:text", text: "Two" }] }),
    [otherPath]: JSON.stringify({ name: "Other" }),
  };
  const build = (translations, bookSources) =>
    buildResourcePackFiles({ translations, pack, description: "d", bookSources });

  it("counts a fully translated file as not partial and reports no missing sources", () => {
    const translations = [bookRow(otherPath, "/name", "Інший")];
    const result = build(translations, sources);
    expect([result.bookFileCount, result.partialBookFileCount]).toEqual([1, 0]);
    expect(result.bookSourcesMissing).toBe(false);
    expect(result.missingBookFileCount).toBe(0);
  });

  it("counts a translated file whose source is absent from the stored sources", () => {
    const result = build([bookRow(otherPath, "/name", "Інший")], { [entryPath]: sources[entryPath] });
    expect([result.bookFileCount, result.missingBookFileCount]).toEqual([0, 1]);
    expect(result.bookSourcesMissing).toBe(false);
  });

  it("writes a full copy under the target language with only translated fields replaced", () => {
    const translations = [
      bookRow(entryPath, "/name", "Е"),
      bookRow(entryPath, "/pages/0/text", "Один"),
      bookRow(entryPath, "/pages/1/text", ""),
      bookRow(otherPath, "/name", ""),
    ];
    const result = build(translations, sources);
    const written = JSON.parse(result.files["assets/a/patchouli_books/b/uk_ua/entries/x.json"]);
    expect(written.pages.map((page) => page.text)).toEqual(["Один", "Two"]);
    expect(written.name).toBe("Е");
    expect(Object.keys(result.files)).not.toContain("assets/a/patchouli_books/b/uk_ua/entries/y.json");
    expect([result.bookFileCount, result.partialBookFileCount]).toEqual([1, 1]);
  });

  it("still exports the lang file but flags missing sources when translated book rows have none", () => {
    const translations = [
      { key: "item.a", original: "A", translated: "А" },
      bookRow(entryPath, "/name", "Е"),
    ];
    const result = build(translations, null);
    expect(Object.keys(result.files).sort()).toEqual(["assets/a/lang/uk_ua.json", "pack.mcmeta"]);
    expect(result.bookSourcesMissing).toBe(true);
    expect(result.bookFileCount).toBe(0);
  });
});
