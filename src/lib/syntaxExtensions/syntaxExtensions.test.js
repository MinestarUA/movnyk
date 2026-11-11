import { describe, expect, it } from "vitest";
import { formatRuns, MC_COLORS } from "../mcFormatting";
import { extractTokens, tokenizeString } from "../tokens";
import { activeSyntaxIds, detectSyntaxExtensions, getSyntax } from ".";

const codesOf = (text, syntax) =>
  tokenizeString(text, syntax)
    .filter((t) => t.type === "syntax-code")
    .map((t) => t.value);

const styleAt = (text, marker, syntax) => {
  const at = text.indexOf(marker);
  return formatRuns(text, syntax).find((r) => r.start <= at && at < r.end).style;
};

describe("syntax selection", () => {
  it("ignores extension markup with no extension active", () => {
    expect(extractTokens("$(l)Bold$() $iItalic/$ _Hi_ **x**")).toEqual([]);
  });

  it("returns the same compiled syntax for the same set in any order", () => {
    expect(getSyntax(["create", "malum"])).toBe(getSyntax(["malum", "create"]));
  });

  it.each([
    ["auto-detect on adds detected ones", { syntaxExtensions: { malum: true } }, ["create"], ["malum", "create"]],
    ["auto-detect off keeps only enabled ones", { syntaxExtensions: { malum: true }, syntaxAutoDetect: false }, ["create"], ["malum"]],
    ["nothing is active by default", {}, [], []],
  ])("%s", (_, settings, detected, expected) => {
    expect(activeSyntaxIds(settings, detected)).toEqual(expected);
  });
});

describe("Patchouli", () => {
  const PATCHOULI = getSyntax(["patchouli"]);

  it("tokenizes codes, including arguments with spaces", () => {
    const input = "$(l)Bold$() $(l:https://a.b/c)link$(/l) $(t:Some tip)hover$(/t) $(#f80)x";
    expect(codesOf(input, PATCHOULI)).toEqual([
      "$(l)",
      "$()",
      "$(l:https://a.b/c)",
      "$(/l)",
      "$(t:Some tip)",
      "$(/t)",
      "$(#f80)",
    ]);
  });

  it("does not treat a lone dollar sign as a code", () => {
    expect(extractTokens("Costs $5 (cheap)", PATCHOULI)).toEqual([]);
  });

  it("applies colours without clearing decorations", () => {
    expect(styleAt("$(l)$(c)X", "X", PATCHOULI)).toMatchObject({ bold: true, color: MC_COLORS.c });
    expect(styleAt("$(#f80)X", "X", PATCHOULI).color).toBe("#ff8800");
    expect(styleAt("$(#1A2b3C)X", "X", PATCHOULI).color).toBe("#1a2b3c");
  });

  it("distinguishes $(l)/$(k) styles from $(l:...)/$(k:...) codes", () => {
    expect(styleAt("$(l)X", "X", PATCHOULI).bold).toBe(true);
    expect(styleAt("$(k)X", "X", PATCHOULI).obfuscated).toBe(true);
    expect(styleAt("$(l:https://a.b)X", "X", PATCHOULI).bold).toBe(false);
    expect(styleAt("$(k:jump)X", "X", PATCHOULI).obfuscated).toBe(false);
  });

  it("resolves default macros", () => {
    expect(styleAt("$(bold)X", "X", PATCHOULI).bold).toBe(true);
    expect(styleAt("$(italics)X", "X", PATCHOULI).italic).toBe(true);
    expect(styleAt("$(item)X", "X", PATCHOULI).color).toBe("#bb00bb");
    expect(styleAt("$(thing)X", "X", PATCHOULI).color).toBe("#449900");
  });

  it("resets on $() and its aliases", () => {
    for (const reset of ["$()", "$(reset)", "$(clear)"]) {
      expect(styleAt(`$(l)$(c)${reset}X`, "X", PATCHOULI)).toMatchObject({ bold: false, color: null });
    }
  });

  it("keeps the style on structural and unknown codes", () => {
    expect(styleAt("$(c)$(br)$(li)$(/l)X", "X", PATCHOULI).color).toBe(MC_COLORS.c);
    expect(styleAt("$(playername)X", "X", PATCHOULI).color).toBeNull();
  });

  it("exposes chip colours and line breaks", () => {
    const patchouli = PATCHOULI.byId.patchouli;
    expect(patchouli.colorOf("$(thing)")).toBe("#449900");
    expect(patchouli.colorOf("$(br)")).toBeNull();
    expect(patchouli.isLineBreak("$(br2)")).toBe(true);
  });
});

describe("Malum", () => {
  const MALUM = getSyntax(["malum"]);

  it("keeps printf specifiers whole", () => {
    expect(tokenizeString("%1$s was slain", MALUM)[0]).toEqual({ type: "placeholder", value: "%1$s" });
  });

  it("styles until /$ clears every decoration but keeps the colour", () => {
    const text = "§c$i$bA/$B";
    expect(styleAt(text, "A", MALUM)).toMatchObject({ italic: true, bold: true });
    expect(styleAt(text, "B", MALUM)).toMatchObject({ italic: false, bold: false, color: MC_COLORS.c });
  });
});

describe("Create", () => {
  const CREATE = getSyntax(["create"]);

  it.each([
    ["_Keeps your notes_ and more", ["_", "_"]],
    ["the _inventory_ _below._ Full?", ["_", "_", "_", "_"]],
    ["uses snake_case and key_bind ids", []],
    ["a lone _ underscore", ["_"]],
    ["§a_Text_ and %s_x_", ["_", "_", "_", "_"]],
  ])("tokenizes %j", (text, expected) => {
    expect(codesOf(text, CREATE)).toEqual(expected);
  });

  it("highlights between markers, even across a colour reset", () => {
    const text = "_A §fB_ C";
    expect(styleAt(text, "A", CREATE).color).toBe("#F1DD79");
    expect(styleAt(text, "B", CREATE).color).toBe("#F1DD79");
    expect(styleAt(text, "C", CREATE).color).toBe(MC_COLORS.f);
  });
});

describe("Modonomicon", () => {
  const MODONOMICON = getSyntax(["modonomicon"]);

  it.each([
    ["***x***", ["***", "***"]],
    ["**a** and *b*", ["**", "**", "*", "*"]],
    ["* bullet, 2 * 3 and 2*3", []],
    ["~~old~~ ++new++", ["~~", "~~", "++", "++"]],
    ["a [#](AA00AA)Foliot[#]() here", ["[#](AA00AA)", "[#]()"]],
    ["the [](item://occultism:gem).", ["[](item://occultism:gem)"]],
    ["a [Magic Lamp](entry://getting_started/magic_lamps).", ["[", "](entry://getting_started/magic_lamps)"]],
    ["line\\\nnext", ["\\"]],
  ])("tokenizes %j", (text, expected) => {
    expect(codesOf(text, MODONOMICON)).toEqual(expected);
  });

  it("styles emphasis and colours", () => {
    const text = "**A** *B* [#](55FF55)C[#]()D";
    expect(styleAt(text, "A", MODONOMICON).bold).toBe(true);
    expect(styleAt(text, "B", MODONOMICON)).toMatchObject({ bold: false, italic: true });
    expect(styleAt(text, "C", MODONOMICON).color).toBe("#55ff55");
    expect(styleAt(text, "D", MODONOMICON).color).toBeNull();
  });
});

describe("detection", () => {
  const many = (count, makeEntry) => Object.fromEntries(Array.from({ length: count }, (_, i) => makeEntry(i)));

  it.each([
    ["patchouli", { "book.x.page": "Hi$(br)there" }],
    [
      "malum",
      {
        "malum.gui.book.entry.page.text.a": "$iSomething/$ spoils.",
        "malum.gui.book.entry.page.text.b": "It is $idirectly/$ caused.",
        "malum.item.c": "Spirit",
      },
    ],
    [
      "create",
      many(10, (i) => [`block.create.b${i}.tooltip.summary`, i < 5 ? `A _uni-directional_ rail ${i}` : "Plain"]),
    ],
    [
      "modonomicon",
      many(3, (i) => [`book.occultism.entry${i}.text`, `Craft a [Lamp](entry://getting_started/lamp${i}).`]),
    ],
  ])("detects %s", (id, template) => {
    expect(detectSyntaxExtensions(template)).toEqual([id]);
  });

  it("finds nothing in a plain lang file", () => {
    expect(
      detectSyntaxExtensions({ "item.mod.key_bind": "Key Bind", "death.attack.x": "%1$s was slain", n: 3 })
    ).toEqual([]);
  });
});
